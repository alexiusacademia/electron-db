const path = require('path');
const fs = require('fs');
const os = require('os');

// The default location is the app's folder in the OS user data directory,
// named after the app's package.json (productName, then name).
let pack = null;
try {
    pack = require('../../package.json');
} catch (e) {
    // Not installed inside an app; the app name stays empty.
}

const platform = os.platform();

let appName = '';
if (pack !== null) {
    appName = pack.productName ? pack.productName : pack.name;
}

let userData = '';

if (platform === 'win32') {
    userData = path.join(process.env.APPDATA || '', appName);
} else if (platform === 'darwin') {
    userData = path.join(process.env.HOME || os.homedir(), 'Library', 'Application Support', appName);
} else {
    userData = path.join('var', 'local', appName);
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const noop = () => {};

// ---------------------------------------------------------------------------
// Table cache
//
// A table is parsed once and kept in memory. Each call checks the file's
// modification time and size, and reads it again only when another program
// changed it. Callback functions write the file at once; promise functions
// change the cached table and write it once per tick, so many changes in a
// row cost one write.
// ---------------------------------------------------------------------------

const tables = new Map(); // file name -> entry

function makeEntry(fname, tableName, table) {
    return {
        fname,
        tableName,
        table,
        mtimeMs: -1,
        size: -1,
        dirty: false,      // changed in memory, not yet written
        scheduled: false,  // a promise write is queued
        waiters: [],       // promise writes waiting for the next save
        byId: null,        // id -> rows, built on first use
        maxId: -Infinity   // largest numeric id, kept with byId
    };
}

function rowsOf(entry) {
    return entry.table[entry.tableName];
}

/**
 * Get the cached table, reading the file when it is new or changed.
 * Returns { entry } or { error }.
 */
function openTable(fname, tableName) {
    const cached = tables.get(fname);
    if (cached && cached.dirty) {
        return { entry: cached };
    }

    let stat;
    try {
        stat = fs.statSync(fname);
    } catch (e) {
        tables.delete(fname);
        return { error: 'Table file does not exist!' };
    }

    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return { entry: cached };
    }

    let table;
    try {
        table = JSON.parse(fs.readFileSync(fname, 'utf-8'));
    } catch (e) {
        tables.delete(fname);
        return { error: 'Table file is not valid JSON. ' + e.toString() };
    }

    if (table === null || typeof table !== 'object' || !Array.isArray(table[tableName])) {
        tables.delete(fname);
        return { error: `Table '${tableName}' was not found in its json file.` };
    }

    const entry = makeEntry(fname, tableName, table);
    entry.mtimeMs = stat.mtimeMs;
    entry.size = stat.size;
    tables.set(fname, entry);
    return { entry };
}

/**
 * Write a table. The data goes to a temporary file first and is then
 * renamed over the table, so a crash mid-write cannot leave broken JSON.
 */
function writeEntry(entry) {
    const tmp = entry.fname + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(entry.table, null, 2));
    fs.renameSync(tmp, entry.fname);
    const stat = fs.statSync(entry.fname);
    entry.mtimeMs = stat.mtimeMs;
    entry.size = stat.size;
    entry.dirty = false;
}

/**
 * Write a changed table now. Promise writes waiting on the same table are
 * saved too. Returns an error message, or null.
 */
function saveNow(entry) {
    const waiters = entry.waiters;
    entry.waiters = [];
    try {
        writeEntry(entry);
    } catch (e) {
        // The file still holds the old data; drop the unsaved changes.
        entry.dirty = false;
        tables.delete(entry.fname);
        waiters.forEach((w) => w.reject(e));
        return e.toString();
    }
    waiters.forEach((w) => w.resolve());
    return null;
}

/**
 * Mark a table changed and write it at the end of the current tick.
 * Resolves once the change is on disk.
 */
function saveSoon(entry) {
    entry.dirty = true;
    const done = new Promise((resolve, reject) => entry.waiters.push({ resolve, reject }));
    if (!entry.scheduled) {
        entry.scheduled = true;
        setImmediate(() => {
            entry.scheduled = false;
            if (entry.dirty && tables.get(entry.fname) === entry) {
                saveNow(entry);
            }
        });
    }
    return done;
}

// Save queued promise writes if the process exits before they run.
process.on('exit', () => {
    for (const entry of tables.values()) {
        if (entry.dirty) {
            try {
                writeEntry(entry);
            } catch (e) {
                // Nothing more can be done while exiting.
            }
        }
    }
});

// ---------------------------------------------------------------------------
// id index
// ---------------------------------------------------------------------------

function idIndex(entry) {
    if (entry.byId === null) {
        const index = new Map();
        let maxId = -Infinity;
        for (const row of rowsOf(entry)) {
            if (row && hasOwn(row, 'id')) {
                if (typeof row.id === 'number' && row.id > maxId) {
                    maxId = row.id;
                }
                const bucket = index.get(row.id);
                if (bucket) {
                    bucket.push(row);
                } else {
                    index.set(row.id, [row]);
                }
            }
        }
        entry.byId = index;
        entry.maxId = maxId;
    }
    return entry.byId;
}

function indexAdd(entry, row) {
    if (entry.byId !== null) {
        if (typeof row.id === 'number' && row.id > entry.maxId) {
            entry.maxId = row.id;
        }
        const bucket = entry.byId.get(row.id);
        if (bucket) {
            bucket.push(row);
        } else {
            entry.byId.set(row.id, [row]);
        }
    }
}

function indexRemove(entry, row) {
    if (entry.byId !== null && row && hasOwn(row, 'id')) {
        const bucket = entry.byId.get(row.id);
        if (bucket) {
            const left = bucket.filter((r) => r !== row);
            if (left.length > 0) {
                entry.byId.set(row.id, left);
            } else {
                entry.byId.delete(row.id);
            }
        }
    }
}

/**
 * The rows worth testing against a WHERE clause: the id index bucket when
 * the clause names a plain id, otherwise every row.
 */
function candidates(entry, where) {
    if (hasOwn(where, 'id') && typeof where.id !== 'function') {
        return idIndex(entry).get(where.id) || [];
    }
    return rowsOf(entry);
}

/**
 * A timestamp id that no row has yet. When the clock is not ahead of the
 * largest id (several inserts in one millisecond), it is that id plus one.
 */
function newId(entry) {
    const index = idIndex(entry);
    let id = Math.max(Date.now(), entry.maxId + 1);
    while (index.has(id)) {
        id++;
    }
    return id;
}

// ---------------------------------------------------------------------------
// Argument and value helpers
// ---------------------------------------------------------------------------

/**
 * Split the arguments of a call into table name, file name, the middle
 * parameters and the callback. `count` is the number of arguments the call
 * takes without a location (table name and callback included); one more
 * argument means the second one is the location.
 */
function parseArgs(args, count) {
    const list = Array.prototype.slice.call(args);
    const tableName = list[0];
    let location = userData;
    let rest = list.slice(1);

    if (list.length === count + 1) {
        location = list[1];
        rest = list.slice(2);
    }

    const last = rest[rest.length - 1];
    const callback = typeof last === 'function' ? last : noop;

    let error = null;
    if (list.length !== count && list.length !== count + 1) {
        error = `Wrong number of arguments. Expected ${count} or ${count + 1} arguments including the callback function.`;
    } else if (typeof tableName !== 'string' || tableName.trim() === '') {
        error = 'Table name must be a non-empty string.';
    } else if (typeof location !== 'string') {
        error = 'Location must be a string.';
    }

    return {
        tableName,
        location,
        fname: error ? '' : path.join(location, tableName + '.json'),
        params: rest.slice(0, -1),
        callback,
        error
    };
}

function checkWhere(where) {
    if (Object.prototype.toString.call(where) !== '[object Object]') {
        return 'WHERE clause should be an object.';
    }
    if (Object.keys(where).length === 0) {
        return 'There are no conditions passed to the WHERE clause.';
    }
    return null;
}

/**
 * True when a row meets every condition of the WHERE clause. A condition is
 * either a value, which must equal the row's value, or a function, which gets
 * the row's value (and the whole row) and returns true to accept it.
 */
function matches(row, where) {
    if (row === null || typeof row !== 'object') {
        return false;
    }
    return Object.keys(where).every((key) => {
        const condition = where[key];
        if (typeof condition === 'function') {
            return Boolean(condition(row[key], row));
        }
        return hasOwn(row, key) && row[key] === condition;
    });
}

function isRow(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

// Rows handed to the caller are copies, so changing them does not change
// the cached table.
function copyRows(rows) {
    return rows.map((row) => (row && typeof row === 'object' ? Object.assign({}, row) : row));
}

function uniqueFieldList(uniqueKeys) {
    const list = typeof uniqueKeys === 'string' ? [uniqueKeys] : uniqueKeys;
    if (!Array.isArray(list) || list.length === 0 || !list.every((k) => typeof k === 'string')) {
        return null;
    }
    return list;
}

/**
 * The first unique field whose value in `candidate` is already used by a row
 * of `rows`, skipping the rows in `ignore`. Null when there is no clash.
 */
function findDuplicate(rows, candidate, uniqueKeys, ignore) {
    for (const key of uniqueKeys) {
        if (!hasOwn(candidate, key)) {
            continue;
        }
        const clash = rows.some((row) =>
            row && !ignore.has(row) && hasOwn(row, key) && row[key] === candidate[key]);
        if (clash) {
            return key;
        }
    }
    return null;
}

function uniqueViolation(key) {
    return `UNIQUE constraint violation: another row already has this value for '${key}'.`;
}

const BAD_UNIQUE = 'Unique fields must be a field name or an array of field names.';

// ---------------------------------------------------------------------------
// Operations
//
// Each operation works on the cached table and returns one of:
//   { ok: true, msg, extra, value, entry }  entry is set when the table changed
//   { ok: false, msg }                      failure
//   { ok: false, msg, empty }               nothing matched; promises resolve `empty`
// `msg` and `extra` go to callbacks; `value` is what promises resolve with.
// ---------------------------------------------------------------------------

function fail(msg) {
    return { ok: false, msg };
}

function opCreateTable(a) {
    if (fs.existsSync(a.fname)) {
        return fail(a.tableName + '.json already exists!');
    }
    try {
        fs.mkdirSync(a.location, { recursive: true });
        const table = {};
        table[a.tableName] = [];
        tables.delete(a.fname);
        const entry = makeEntry(a.fname, a.tableName, table);
        writeEntry(entry);
        tables.set(a.fname, entry);
        return { ok: true, msg: 'Success!', value: undefined };
    } catch (e) {
        return fail(e.toString());
    }
}

function insertRows(a, newRows, uniqueKeys, many) {
    if (!newRows.every(isRow)) {
        return fail(many ? 'All rows must be objects.' : 'Row must be an object.');
    }

    let unique = null;
    if (uniqueKeys !== null) {
        unique = uniqueFieldList(uniqueKeys);
        if (unique === null) {
            return fail(BAD_UNIQUE);
        }
    }

    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const entry = opened.entry;
    const rows = rowsOf(entry);

    if (unique !== null) {
        const key = findDuplicate(rows, newRows[0], unique, new Set());
        if (key !== null) {
            return fail(uniqueViolation(key));
        }
    }

    const ids = newRows.map((row) => {
        // The id is also written onto the caller's object.
        if (row.id === undefined || row.id === null) {
            row.id = newId(entry);
        }
        const stored = Object.assign({}, row);
        rows.push(stored);
        indexAdd(entry, stored);
        return row.id;
    });

    if (many) {
        return { ok: true, msg: 'Objects written successfully!', extra: ids, value: ids, entry };
    }
    return { ok: true, msg: 'Object written successfully!', extra: ids[0], value: ids[0], entry };
}

function opInsert(a) {
    return insertRows(a, [a.params[0]], null, false);
}

function opInsertUnique(a) {
    return insertRows(a, [a.params[0]], a.params[1], false);
}

function opInsertMany(a) {
    const rows = a.params[0];
    if (!Array.isArray(rows) || rows.length === 0) {
        return fail('Rows must be a non-empty array of objects.');
    }
    return insertRows(a, rows, null, true);
}

function opGetAll(a) {
    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const rows = copyRows(rowsOf(opened.entry));
    return { ok: true, msg: rows, value: rows };
}

function opGetRows(a) {
    const where = a.params[0];
    const problem = checkWhere(where);
    if (problem) {
        return fail(problem);
    }
    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    try {
        const rows = copyRows(candidates(opened.entry, where).filter((row) => matches(row, where)));
        return { ok: true, msg: rows, value: rows };
    } catch (e) {
        return fail(e.toString());
    }
}

function updateRows(a, where, set, uniqueKeys) {
    const problem = checkWhere(where) || (isRow(set) ? null : 'SET clause should be an object.');
    if (problem) {
        return fail(problem);
    }

    let unique = null;
    if (uniqueKeys !== null) {
        unique = uniqueFieldList(uniqueKeys);
        if (unique === null) {
            return fail(BAD_UNIQUE);
        }
    }

    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const entry = opened.entry;

    let matched;
    try {
        matched = candidates(entry, where).filter((row) => matches(row, where));
    } catch (e) {
        return fail(e.toString());
    }

    if (matched.length === 0) {
        return { ok: false, msg: 'Cannot find the specified record.', empty: 0 };
    }

    if (unique !== null) {
        const changed = unique.filter((key) => hasOwn(set, key));
        if (changed.length > 0 && matched.length > 1) {
            return fail(uniqueViolation(changed[0]) + ' The update would give it to several rows.');
        }
        const key = findDuplicate(rowsOf(entry), set, changed, new Set(matched));
        if (key !== null) {
            return fail(uniqueViolation(key));
        }
    }

    for (const row of matched) {
        Object.assign(row, set);
    }
    if (hasOwn(set, 'id')) {
        entry.byId = null;
    }

    return { ok: true, msg: 'Success!', extra: matched.length, value: matched.length, entry };
}

function opUpdate(a) {
    return updateRows(a, a.params[0], a.params[1], null);
}

function opUpdateUnique(a) {
    return updateRows(a, a.params[0], a.params[1], a.params[2]);
}

function opDelete(a) {
    const where = a.params[0];
    const problem = checkWhere(where);
    if (problem) {
        return fail(problem);
    }

    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const entry = opened.entry;
    const rows = rowsOf(entry);

    if (rows.length === 0) {
        return { ok: false, msg: 'Table is empty!', empty: 0 };
    }

    let doomed;
    try {
        doomed = candidates(entry, where).filter((row) => matches(row, where));
    } catch (e) {
        return fail(e.toString());
    }

    if (doomed.length === 0) {
        return { ok: false, msg: 'Row does not exist!', empty: 0 };
    }

    const gone = new Set(doomed);
    entry.table[entry.tableName] = rows.filter((row) => !gone.has(row));
    doomed.forEach((row) => indexRemove(entry, row));

    return { ok: true, msg: 'Row(s) deleted successfully!', extra: doomed.length, value: doomed.length, entry };
}

function opSearch(a) {
    const field = a.params[0];
    const keyword = String(a.params[1]).toLowerCase();
    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const rows = copyRows(rowsOf(opened.entry).filter((row) =>
        row && hasOwn(row, field) && row[field] !== null && row[field] !== undefined &&
        String(row[field]).toLowerCase().includes(keyword)));
    return { ok: true, msg: rows, value: rows };
}

function opGetField(a) {
    const key = a.params[0];
    if (!fs.existsSync(a.fname)) {
        return fail('The table you are trying to access does not exist.');
    }
    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const rows = rowsOf(opened.entry).filter((row) => row && hasOwn(row, key));
    if (rows.length === 0) {
        return fail('The key/field given does not exist.');
    }
    const values = rows.map((row) => row[key]);
    return { ok: true, msg: values, value: values };
}

function opClearTable(a) {
    if (!fs.existsSync(a.fname)) {
        return fail('The table you are trying to clear does not exist.');
    }
    // Works on a broken file too: clearing replaces its content.
    let entry = tables.get(a.fname);
    if (!entry) {
        entry = makeEntry(a.fname, a.tableName, {});
        tables.set(a.fname, entry);
    }
    entry.table = {};
    entry.table[a.tableName] = [];
    entry.byId = null;
    return { ok: true, msg: 'Table cleared successfully!', value: undefined, entry };
}

function opCount(a) {
    const opened = openTable(a.fname, a.tableName);
    if (opened.error) {
        return fail(opened.error);
    }
    const n = rowsOf(opened.entry).length;
    return { ok: true, msg: n, value: n };
}

// ---------------------------------------------------------------------------
// Callback and promise front ends
// ---------------------------------------------------------------------------

/**
 * Callback form: (succ, msg[, extra]). Changes are written before the
 * callback runs. Insert functions return the new id(s).
 */
function withCallback(op, count) {
    return function () {
        const a = parseArgs(arguments, count);
        if (a.error) {
            a.callback(false, a.error);
            return undefined;
        }
        const r = op(a);
        if (!r.ok) {
            a.callback(false, r.msg);
            return undefined;
        }
        if (r.entry) {
            const error = saveNow(r.entry);
            if (error !== null) {
                a.callback(false, error);
                return undefined;
            }
        }
        if (r.extra === undefined) {
            a.callback(true, r.msg);
        } else {
            a.callback(true, r.msg, r.extra);
        }
        return r.extra;
    };
}

/**
 * Promise form: same arguments without the callback. Resolves with the
 * result once any change is on disk; rejects with an Error.
 */
function withPromise(op, count) {
    return function () {
        const args = Array.prototype.slice.call(arguments);
        args.push(noop);
        const a = parseArgs(args, count);
        if (a.error) {
            return Promise.reject(new Error(a.error));
        }
        let r;
        try {
            r = op(a);
        } catch (e) {
            return Promise.reject(e);
        }
        if (!r.ok) {
            return hasOwn(r, 'empty') ? Promise.resolve(r.empty) : Promise.reject(new Error(r.msg));
        }
        return r.entry ? saveSoon(r.entry).then(() => r.value) : Promise.resolve(r.value);
    };
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Check that a table file exists and holds valid JSON.
 * valid(tableName, [location]) -> boolean
 */
function valid(tableName, location) {
    const fname = path.join(location || userData, tableName + '.json');
    try {
        JSON.parse(fs.readFileSync(fname, 'utf-8'));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check whether a table file exists.
 * tableExists(tableName, [location]) -> boolean
 */
function tableExists(tableName, location) {
    return fs.existsSync(path.join(location || userData, tableName + '.json'));
}

// Argument counts without a location, table name and callback included.
const operations = {
    // createTable(tableName, [location], callback)            (succ, msg)
    createTable: [opCreateTable, 2],
    // insertTableContent(tableName, [location], row, callback) (succ, msg, id)
    insertTableContent: [opInsert, 3],
    // insertTableContents(tableName, [location], rows, callback) (succ, msg, ids)
    insertTableContents: [opInsertMany, 3],
    // insertWithUniqueCheck(tableName, [location], row, uniqueFields, callback) (succ, msg, id)
    insertWithUniqueCheck: [opInsertUnique, 4],
    // getAll(tableName, [location], callback)                  (succ, rows)
    getAll: [opGetAll, 2],
    // getRows(tableName, [location], where, callback)          (succ, rows)
    getRows: [opGetRows, 3],
    // updateRow(tableName, [location], where, set, callback)   (succ, msg, count)
    updateRow: [opUpdate, 4],
    // updateWithUniqueCheck(tableName, [location], where, set, uniqueFields, callback) (succ, msg, count)
    updateWithUniqueCheck: [opUpdateUnique, 5],
    // search(tableName, [location], field, keyword, callback)  (succ, rows)
    search: [opSearch, 4],
    // deleteRow(tableName, [location], where, callback)        (succ, msg, count)
    deleteRow: [opDelete, 3],
    // getField(tableName, [location], field, callback)         (succ, values)
    getField: [opGetField, 3],
    // clearTable(tableName, [location], callback)              (succ, msg)
    clearTable: [opClearTable, 2],
    // count(tableName, [location], callback)                   (succ, count)
    count: [opCount, 2]
};

const callbackApi = {};
const promiseApi = {
    valid: (tableName, location) => Promise.resolve(valid(tableName, location)),
    tableExists: (tableName, location) => Promise.resolve(tableExists(tableName, location))
};

for (const name of Object.keys(operations)) {
    const [op, count] = operations[name];
    callbackApi[name] = withCallback(op, count);
    // Promise functions take one argument less: no callback.
    promiseApi[name] = withPromise(op, count);
}

module.exports = Object.assign(callbackApi, {
    valid,
    tableExists,
    promises: promiseApi,
    _getInternals: () => ({ userData, tables }) // For tests
});
