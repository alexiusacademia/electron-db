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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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
    const callback = typeof last === 'function' ? last : () => {};

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

/**
 * Read a table file. Returns { table, rows } or { error }.
 */
function loadTable(fname, tableName) {
    if (!fs.existsSync(fname)) {
        return { error: 'Table file does not exist!' };
    }

    let table;
    try {
        table = JSON.parse(fs.readFileSync(fname, 'utf-8'));
    } catch (e) {
        return { error: 'Table file is not valid JSON. ' + e.toString() };
    }

    if (table === null || typeof table !== 'object' || !Array.isArray(table[tableName])) {
        return { error: `Table '${tableName}' was not found in its json file.` };
    }

    return { table, rows: table[tableName] };
}

/**
 * Write a table file. The data goes to a temporary file first and is then
 * renamed over the table, so a crash mid-write cannot leave broken JSON.
 */
function saveTable(fname, table) {
    const tmp = fname + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(table, null, 2));
    fs.renameSync(tmp, fname);
}

/**
 * Check a WHERE clause. Returns an error message or null.
 */
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

/**
 * A timestamp id that no row in `usedIds` has yet. Inserts within the same
 * millisecond get the next free number instead of a duplicate.
 */
function newId(usedIds) {
    let id = Date.now();
    while (usedIds.has(id)) {
        id++;
    }
    usedIds.add(id);
    return id;
}

function idsOf(rows) {
    return new Set(rows.filter((row) => row && hasOwn(row, 'id')).map((row) => row.id));
}

function isRow(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Normalise the unique field list: a string or an array of strings.
 * Returns an array, or null when invalid.
 */
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

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Create a table (a json file holding an empty list).
 *
 * createTable(tableName, [location], callback)
 * @param {string}   tableName  Name of the table and of its json file.
 * @param {string}   [location] Folder for the json file. Created if missing.
 * @param {Function} callback   (succ, msg)
 */
function createTable() {
    const { tableName, location, fname, callback, error } = parseArgs(arguments, 2);
    if (error) {
        callback(false, error);
        return;
    }

    if (fs.existsSync(fname)) {
        callback(false, tableName + '.json already exists!');
        return;
    }

    try {
        fs.mkdirSync(location, { recursive: true });
        const obj = {};
        obj[tableName] = [];
        saveTable(fname, obj);
        callback(true, 'Success!');
    } catch (e) {
        callback(false, e.toString());
    }
}

/**
 * Check that a table file exists and holds valid JSON.
 *
 * valid(tableName, [location])
 * @param  {string}  tableName
 * @param  {string}  [location]
 * @return {boolean} true when the file exists and parses.
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
 *
 * tableExists(tableName, [location])
 * @param  {string}  tableName
 * @param  {string}  [location]
 * @return {boolean}
 */
function tableExists(tableName, location) {
    return fs.existsSync(path.join(location || userData, tableName + '.json'));
}

/**
 * Insert a row. A row without an `id` gets a timestamp id, which is also
 * written onto the object passed in.
 *
 * insertTableContent(tableName, [location], row, callback)
 * @param  {string}   tableName
 * @param  {string}   [location]
 * @param  {Object}   row
 * @param  {Function} callback  (succ, msg, id)
 * @return {(number|undefined)} id of the inserted row, undefined on failure.
 */
function insertTableContent() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 3);
    return insertRows(tableName, fname, [params[0]], null, callback, error, false);
}

/**
 * Insert a row, refusing it when one of the unique fields already holds the
 * same value in another row (like a UNIQUE constraint in SQL).
 *
 * insertWithUniqueCheck(tableName, [location], row, uniqueFields, callback)
 * @param  {string}          tableName
 * @param  {string}          [location]
 * @param  {Object}          row
 * @param  {string|string[]} uniqueFields  Field or fields that must be unique.
 * @param  {Function}        callback      (succ, msg, id)
 * @return {(number|undefined)} id of the inserted row, undefined on failure.
 */
function insertWithUniqueCheck() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 4);
    return insertRows(tableName, fname, [params[0]], params[1], callback, error, false);
}

/**
 * Insert several rows with one write.
 *
 * insertTableContents(tableName, [location], rows, callback)
 * @param  {string}   tableName
 * @param  {string}   [location]
 * @param  {Object[]} rows
 * @param  {Function} callback  (succ, msg, ids)
 * @return {(number[]|undefined)} ids of the inserted rows, undefined on failure.
 */
function insertTableContents() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 3);
    const rows = params[0];
    if (!error && (!Array.isArray(rows) || rows.length === 0)) {
        callback(false, 'Rows must be a non-empty array of objects.');
        return undefined;
    }
    return insertRows(tableName, fname, rows, null, callback, error, true);
}

function insertRows(tableName, fname, newRows, uniqueKeys, callback, error, many) {
    if (error) {
        callback(false, error);
        return undefined;
    }
    if (!newRows.every(isRow)) {
        callback(false, many ? 'All rows must be objects.' : 'Row must be an object.');
        return undefined;
    }

    let unique = null;
    if (uniqueKeys !== null) {
        unique = uniqueFieldList(uniqueKeys);
        if (unique === null) {
            callback(false, 'Unique fields must be a field name or an array of field names.');
            return undefined;
        }
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return undefined;
    }

    if (unique !== null) {
        const key = findDuplicate(loaded.rows, newRows[0], unique, new Set());
        if (key !== null) {
            callback(false, uniqueViolation(key));
            return undefined;
        }
    }

    const used = idsOf(loaded.rows);
    const ids = newRows.map((row) => {
        if (row.id === undefined || row.id === null) {
            row.id = newId(used);
        } else {
            used.add(row.id);
        }
        return row.id;
    });

    loaded.rows.push(...newRows);

    try {
        saveTable(fname, loaded.table);
    } catch (e) {
        callback(false, 'Error writing object. ' + e.toString());
        return undefined;
    }

    if (many) {
        callback(true, 'Objects written successfully!', ids);
        return ids;
    }
    callback(true, 'Object written successfully!', ids[0]);
    return ids[0];
}

/**
 * Get all rows of a table.
 *
 * getAll(tableName, [location], callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Function} callback  (succ, rows) — on failure, rows is a message.
 */
function getAll() {
    const { tableName, fname, callback, error } = parseArgs(arguments, 2);
    if (error) {
        callback(false, error);
        return;
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }
    callback(true, loaded.rows);
}

/**
 * Get the rows that meet every condition of the WHERE clause.
 *
 * getRows(tableName, [location], where, callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Object}   where     { field: value } pairs; a value may be a
 *                             function (value, row) => boolean.
 * @param {Function} callback  (succ, rows)
 */
function getRows() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 3);
    const where = params[0];
    const problem = error || checkWhere(where);
    if (problem) {
        callback(false, problem);
        return;
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }

    try {
        callback(true, loaded.rows.filter((row) => matches(row, where)));
    } catch (e) {
        callback(false, e.toString());
    }
}

/**
 * Update every row that meets the WHERE clause with the fields of SET.
 *
 * updateRow(tableName, [location], where, set, callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Object}   where     Conditions, as in getRows.
 * @param {Object}   set       { field: newValue } pairs.
 * @param {Function} callback  (succ, msg, count) — count of updated rows.
 */
function updateRow() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 4);
    updateRows(tableName, fname, params[0], params[1], null, callback, error);
}

/**
 * updateRow that refuses the update when it would give a unique field a
 * value another row already has, or the same value to several rows.
 *
 * updateWithUniqueCheck(tableName, [location], where, set, uniqueFields, callback)
 * @param {string}          tableName
 * @param {string}          [location]
 * @param {Object}          where
 * @param {Object}          set
 * @param {string|string[]} uniqueFields
 * @param {Function}        callback  (succ, msg, count)
 */
function updateWithUniqueCheck() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 5);
    updateRows(tableName, fname, params[0], params[1], params[2], callback, error);
}

function updateRows(tableName, fname, where, set, uniqueKeys, callback, error) {
    const problem = error || checkWhere(where) || (isRow(set) ? null : 'SET clause should be an object.');
    if (problem) {
        callback(false, problem);
        return;
    }

    let unique = null;
    if (uniqueKeys !== null) {
        unique = uniqueFieldList(uniqueKeys);
        if (unique === null) {
            callback(false, 'Unique fields must be a field name or an array of field names.');
            return;
        }
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }

    let matched;
    try {
        matched = loaded.rows.filter((row) => matches(row, where));
    } catch (e) {
        callback(false, e.toString());
        return;
    }

    if (matched.length === 0) {
        callback(false, 'Cannot find the specified record.');
        return;
    }

    if (unique !== null) {
        const changed = unique.filter((key) => hasOwn(set, key));
        if (changed.length > 0 && matched.length > 1) {
            callback(false, uniqueViolation(changed[0]) + ' The update would give it to several rows.');
            return;
        }
        const key = findDuplicate(loaded.rows, set, changed, new Set(matched));
        if (key !== null) {
            callback(false, uniqueViolation(key));
            return;
        }
    }

    for (const row of matched) {
        Object.assign(row, set);
    }

    try {
        saveTable(fname, loaded.table);
        callback(true, 'Success!', matched.length);
    } catch (e) {
        callback(false, e.toString());
    }
}

/**
 * Delete every row that meets the WHERE clause.
 *
 * deleteRow(tableName, [location], where, callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Object}   where     Conditions, as in getRows.
 * @param {Function} callback  (succ, msg, count) — count of deleted rows.
 */
function deleteRow() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 3);
    const where = params[0];
    const problem = error || checkWhere(where);
    if (problem) {
        callback(false, problem);
        return;
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }

    if (loaded.rows.length === 0) {
        callback(false, 'Table is empty!');
        return;
    }

    let kept;
    try {
        kept = loaded.rows.filter((row) => !matches(row, where));
    } catch (e) {
        callback(false, e.toString());
        return;
    }

    const deleted = loaded.rows.length - kept.length;
    if (deleted === 0) {
        callback(false, 'Row does not exist!');
        return;
    }

    loaded.table[tableName] = kept;
    try {
        saveTable(fname, loaded.table);
        callback(true, 'Row(s) deleted successfully!', deleted);
    } catch (e) {
        callback(false, e.toString());
    }
}

/**
 * Find rows whose field contains the keyword (case-insensitive). Rows
 * without the field are skipped.
 *
 * search(tableName, [location], field, keyword, callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {string}   field
 * @param {*}        keyword   Compared as text.
 * @param {Function} callback  (succ, rows)
 */
function search() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 4);
    if (error) {
        callback(false, error);
        return;
    }
    const field = params[0];
    const keyword = String(params[1]).toLowerCase();

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }

    const found = loaded.rows.filter((row) =>
        row && hasOwn(row, field) && row[field] !== null && row[field] !== undefined &&
        String(row[field]).toLowerCase().includes(keyword));
    callback(true, found);
}

/**
 * Get the values of one field from every row that has it.
 *
 * getField(tableName, [location], field, callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {string}   field
 * @param {Function} callback  (succ, values)
 */
function getField() {
    const { tableName, fname, params, callback, error } = parseArgs(arguments, 3);
    if (error) {
        callback(false, error);
        return;
    }
    const key = params[0];

    if (!fs.existsSync(fname)) {
        callback(false, 'The table you are trying to access does not exist.');
        return;
    }
    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }

    const rows = loaded.rows.filter((row) => row && hasOwn(row, key));
    if (rows.length === 0) {
        callback(false, 'The key/field given does not exist.');
        return;
    }
    callback(true, rows.map((row) => row[key]));
}

/**
 * Remove every row, leaving an empty table.
 *
 * clearTable(tableName, [location], callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Function} callback  (succ, msg)
 */
function clearTable() {
    const { tableName, fname, callback, error } = parseArgs(arguments, 2);
    if (error) {
        callback(false, error);
        return;
    }

    if (!fs.existsSync(fname)) {
        callback(false, 'The table you are trying to clear does not exist.');
        return;
    }

    try {
        const obj = {};
        obj[tableName] = [];
        saveTable(fname, obj);
        callback(true, 'Table cleared successfully!');
    } catch (e) {
        callback(false, e.toString());
    }
}

/**
 * Count the rows of a table.
 *
 * count(tableName, [location], callback)
 * @param {string}   tableName
 * @param {string}   [location]
 * @param {Function} callback  (succ, count)
 */
function count() {
    const { tableName, fname, callback, error } = parseArgs(arguments, 2);
    if (error) {
        callback(false, error);
        return;
    }

    const loaded = loadTable(fname, tableName);
    if (loaded.error) {
        callback(false, loaded.error);
        return;
    }
    callback(true, loaded.rows.length);
}

module.exports = {
    createTable,
    insertTableContent,
    insertTableContents,
    insertWithUniqueCheck,
    getAll,
    getRows,
    updateRow,
    updateWithUniqueCheck,
    search,
    deleteRow,
    valid,
    clearTable,
    getField,
    count,
    tableExists,
    _getInternals: () => ({ userData }) // For tests
};
