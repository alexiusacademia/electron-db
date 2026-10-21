// Tests for electron-db. Run with: npm test
// Every table is created in a temporary folder that is removed at the end.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('./index');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-db-test-'));
const tests = [];
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

// Call a db function and return what it passed to its callback.
function call(fnName, ...args) {
    let result = null;
    const returned = db[fnName](...args, (succ, data, extra) => {
        result = { succ, data, extra };
    });
    assert.ok(result, `${fnName} did not call its callback`);
    result.returned = returned;
    return result;
}

// A fresh table with the given rows, inserted with their own ids.
function freshTable(name, rows) {
    call('createTable', name, dir);
    rows.forEach((row) => call('insertTableContent', name, dir, Object.assign({}, row)));
}

function rowsOf(name) {
    return JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf-8'))[name];
}

// --- createTable, valid, tableExists ---------------------------------------

test('createTable creates an empty table', () => {
    const r = call('createTable', 'customers', dir);
    assert.strictEqual(r.succ, true);
    assert.strictEqual(r.data, 'Success!');
    assert.deepStrictEqual(rowsOf('customers'), []);
});

test('createTable refuses an existing table', () => {
    const r = call('createTable', 'customers', dir);
    assert.strictEqual(r.succ, false);
    assert.strictEqual(r.data, 'customers.json already exists!');
});

test('createTable creates a missing folder', () => {
    const sub = path.join(dir, 'nested', 'folder');
    assert.strictEqual(call('createTable', 'deep', sub).succ, true);
    assert.ok(fs.existsSync(path.join(sub, 'deep.json')));
});

test('valid and tableExists return booleans', () => {
    assert.strictEqual(db.valid('customers', dir), true);
    assert.strictEqual(db.valid('missing', dir), false);
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');
    assert.strictEqual(db.valid('broken', dir), false);
    assert.strictEqual(db.tableExists('customers', dir), true);
    assert.strictEqual(db.tableExists('missing', dir), false);
});

// --- insert (#44, #10) -----------------------------------------------------

test('insertTableContent passes and returns the new id (#44)', () => {
    const row = { name: 'Alexius' };
    const r = call('insertTableContent', 'customers', dir, row);
    assert.strictEqual(r.succ, true);
    assert.strictEqual(r.data, 'Object written successfully!');
    assert.strictEqual(typeof r.extra, 'number');
    assert.strictEqual(r.returned, r.extra);
    assert.strictEqual(row.id, r.extra);
    assert.strictEqual(rowsOf('customers')[0].id, r.extra);
});

test('insertTableContent keeps a given id', () => {
    const r = call('insertTableContent', 'customers', dir, { id: 'abc', name: 'Given' });
    assert.strictEqual(r.extra, 'abc');
});

test('inserts in a loop are all kept, with unique ids (#10)', () => {
    freshTable('loop', []);
    for (let i = 0; i < 50; i++) {
        call('insertTableContent', 'loop', dir, { n: i });
    }
    const rows = rowsOf('loop');
    assert.strictEqual(rows.length, 50);
    assert.strictEqual(new Set(rows.map((r) => r.id)).size, 50);
});

test('insertTableContent fails for a missing table', () => {
    const r = call('insertTableContent', 'missing', dir, { a: 1 });
    assert.strictEqual(r.succ, false);
    assert.strictEqual(r.returned, undefined);
});

test('insertTableContents inserts several rows with one call', () => {
    freshTable('bulk', []);
    const r = call('insertTableContents', 'bulk', dir, [{ a: 1 }, { a: 2, id: 7 }, { a: 3 }]);
    assert.strictEqual(r.succ, true);
    assert.strictEqual(r.extra.length, 3);
    assert.strictEqual(r.extra[1], 7);
    assert.strictEqual(rowsOf('bulk').length, 3);
    assert.strictEqual(call('insertTableContents', 'bulk', dir, []).succ, false);
    assert.strictEqual(call('insertTableContents', 'bulk', dir, [1, 2]).succ, false);
});

// --- unique check (#42) ----------------------------------------------------

test('insertWithUniqueCheck refuses a duplicate value (#42)', () => {
    freshTable('people', [{ name: 'Ann', email: 'ann@x' }]);
    const dup = call('insertWithUniqueCheck', 'people', dir, { name: 'Ann2', email: 'ann@x' }, ['name', 'email']);
    assert.strictEqual(dup.succ, false);
    assert.ok(dup.data.includes("'email'"));
    const ok = call('insertWithUniqueCheck', 'people', dir, { name: 'Bob', email: 'bob@x' }, 'email');
    assert.strictEqual(ok.succ, true);
    assert.strictEqual(typeof ok.extra, 'number');
    assert.strictEqual(rowsOf('people').length, 2);
});

test('updateWithUniqueCheck refuses a value another row has (#42)', () => {
    const r = call('updateWithUniqueCheck', 'people', dir, { name: 'Bob' }, { email: 'ann@x' }, ['email']);
    assert.strictEqual(r.succ, false);
    assert.strictEqual(rowsOf('people')[1].email, 'bob@x');
});

test('updateWithUniqueCheck allows keeping its own value (#42)', () => {
    const r = call('updateWithUniqueCheck', 'people', dir, { name: 'Bob' }, { email: 'bob@x', age: 30 }, ['email']);
    assert.strictEqual(r.succ, true);
    assert.strictEqual(rowsOf('people')[1].age, 30);
});

test('updateWithUniqueCheck refuses one value for several rows (#42)', () => {
    const r = call('updateWithUniqueCheck', 'people', dir, { name: (n) => true }, { email: 'same@x' }, ['email']);
    assert.strictEqual(r.succ, false);
});

// --- getRows (#50) ---------------------------------------------------------

test('getRows matches every condition', () => {
    freshTable('rows', [
        { name: 'A', city: 'X', age: 20 },
        { name: 'B', city: 'X', age: 40 },
        { name: 'C', city: 'Y', age: 60 }
    ]);
    const r = call('getRows', 'rows', dir, { city: 'X', age: 40 });
    assert.strictEqual(r.succ, true);
    assert.deepStrictEqual(r.data.map((x) => x.name), ['B']);
});

test('getRows accepts a function as a condition (#50)', () => {
    const r = call('getRows', 'rows', dir, { age: (age) => age >= 40 });
    assert.deepStrictEqual(r.data.map((x) => x.name), ['B', 'C']);
    const both = call('getRows', 'rows', dir, { age: (age) => age > 10, city: 'Y' });
    assert.deepStrictEqual(both.data.map((x) => x.name), ['C']);
});

test('getRows reports an error thrown by a condition', () => {
    const r = call('getRows', 'rows', dir, { age: () => { throw new Error('boom'); } });
    assert.strictEqual(r.succ, false);
    assert.ok(r.data.includes('boom'));
});

test('getRows refuses an empty or non-object WHERE', () => {
    assert.strictEqual(call('getRows', 'rows', dir, {}).succ, false);
    assert.strictEqual(call('getRows', 'rows', dir, 'x').succ, false);
});

// --- updateRow (#29) -------------------------------------------------------

test('updateRow updates every matching row (#29)', () => {
    freshTable('upd', [
        { name: 'A', group: 1 },
        { name: 'B', group: 1 },
        { name: 'C', group: 1 },
        { name: 'D', group: 2 }
    ]);
    const r = call('updateRow', 'upd', dir, { group: 1 }, { done: true });
    assert.strictEqual(r.succ, true);
    assert.strictEqual(r.extra, 3);
    assert.deepStrictEqual(rowsOf('upd').map((x) => x.done === true), [true, true, true, false]);
});

test('updateRow needs all conditions to match (#29)', () => {
    const r = call('updateRow', 'upd', dir, { name: 'D', group: 1 }, { done: true });
    assert.strictEqual(r.succ, false);
    assert.strictEqual(rowsOf('upd')[3].done, undefined);
});

test('updateRow refuses an empty WHERE', () => {
    assert.strictEqual(call('updateRow', 'upd', dir, {}, { x: 1 }).succ, false);
    assert.ok(rowsOf('upd').every((x) => x.x === undefined));
});

// --- deleteRow (#37, #39) --------------------------------------------------

test('deleteRow removes only rows matching every condition (#37)', () => {
    freshTable('files', [
        { projectName: 'Project1', fileName: 'a.css' },
        { projectName: 'Project2', fileName: 'delete.png' },
        { projectName: 'Project1', fileName: 'delete.png' }
    ]);
    const r = call('deleteRow', 'files', dir, { fileName: 'delete.png', projectName: 'Project2' });
    assert.strictEqual(r.succ, true);
    assert.strictEqual(r.extra, 1);
    assert.deepStrictEqual(rowsOf('files').map((x) => x.projectName + '/' + x.fileName),
        ['Project1/a.css', 'Project1/delete.png']);
});

test('deleteRow removes several matching rows (#39)', () => {
    const r = call('deleteRow', 'files', dir, { projectName: 'Project1' });
    assert.strictEqual(r.extra, 2);
    assert.deepStrictEqual(rowsOf('files'), []);
});

test('deleteRow accepts a function condition and reports no match', () => {
    freshTable('del', [{ n: 1 }, { n: 2 }, { n: 3 }]);
    assert.strictEqual(call('deleteRow', 'del', dir, { n: (n) => n > 1 }).extra, 2);
    const none = call('deleteRow', 'del', dir, { n: 99 });
    assert.strictEqual(none.succ, false);
    assert.strictEqual(none.data, 'Row does not exist!');
    assert.strictEqual(call('deleteRow', 'del', dir, {}).succ, false);
});

// --- the other functions ---------------------------------------------------

test('getAll, count, getField, search, clearTable', () => {
    freshTable('misc', [
        { name: 'John John', tag: 'a.b' },
        { name: 'Mary' },
        { name: null, tag: 'x' }
    ]);
    assert.strictEqual(call('getAll', 'misc', dir).data.length, 3);
    assert.strictEqual(call('count', 'misc', dir).data, 3);
    assert.deepStrictEqual(call('getField', 'misc', dir, 'tag').data, ['a.b', 'x']);
    assert.strictEqual(call('getField', 'misc', dir, 'nope').succ, false);

    const found = call('search', 'misc', dir, 'name', 'OH');
    assert.strictEqual(found.succ, true);
    assert.deepStrictEqual(found.data.map((x) => x.name), ['John John']);
    // The keyword is plain text, not a regular expression.
    assert.deepStrictEqual(call('search', 'misc', dir, 'tag', '.').data.length, 1);

    assert.strictEqual(call('clearTable', 'misc', dir).succ, true);
    assert.strictEqual(call('count', 'misc', dir).data, 0);
});

test('functions report a missing table and wrong arguments', () => {
    assert.strictEqual(call('getAll', 'missing', dir).succ, false);
    assert.strictEqual(call('count', 'missing', dir).succ, false);
    assert.strictEqual(call('clearTable', 'missing', dir).succ, false);
    assert.strictEqual(call('getField', 'missing', dir, 'x').succ, false);
    assert.strictEqual(call('getRows', 'missing', dir, { a: 1 }).succ, false);
    const wrong = call('count', 'a', dir, 'b', 'c');
    assert.strictEqual(wrong.succ, false);
    assert.ok(wrong.data.includes('Wrong number of arguments'));
});

test('writes leave no temporary file behind', () => {
    assert.ok(fs.readdirSync(dir).every((f) => !f.endsWith('.tmp')));
});

// --- run -------------------------------------------------------------------

for (const t of tests) {
    try {
        t.fn();
        console.log(`  pass  ${t.name}`);
    } catch (e) {
        failed++;
        console.log(`  FAIL  ${t.name}\n        ${e.message}`);
    }
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
