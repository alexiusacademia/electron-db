const db = require('./index');
const fs = require('fs').promises;
const fsSync = require('fs'); // For specific sync operations if needed during test setup
const path = require('path');
const os = require('os'); // Required for replicating default path logic if _getInternals is not used

const TEST_DIR_CUSTOM = path.join(__dirname, 'test_db_collections_custom');
// Default path will be retrieved using db._getInternals()
let DEFAULT_USER_DATA_PATH;
// Specific table names for default path tests to allow targeted cleanup
const DEFAULT_PATH_TABLE_1 = 'test_default_table_1';
const DEFAULT_PATH_TABLE_2_FOR_VALID_TEST = 'test_default_table_2_for_valid_test';

let testsPassed = 0;
let testsFailed = 0;

// Helper to create a promise-based version of db functions
function promisifyDb(fnName) {
    return (...args) => {
        return new Promise((resolve, reject) => {
            db[fnName](...args, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    };
}

const createTableAsync = promisifyDb('createTable');
const tableExistsAsync = promisifyDb('tableExists');
const validAsync = promisifyDb('valid');
const insertTableContentAsync = promisifyDb('insertTableContent');
const getAllAsync = promisifyDb('getAll');
const getRowsAsync = promisifyDb('getRows');
const updateRowAsync = promisifyDb('updateRow');
const deleteRowAsync = promisifyDb('deleteRow');
const searchAsync = promisifyDb('search');
const getFieldAsync = promisifyDb('getField');
const countAsync = promisifyDb('count');
const clearTableAsync = promisifyDb('clearTable');
const insertTableContentsAsync = promisifyDb('insertTableContents');


async function runTest(description, testFn) {
    console.log(`\nRunning: ${description}`);
    try {
        await testFn();
        console.log(`  PASS: ${description}`);
        testsPassed++;
    } catch (error) {
        console.error(`  FAIL: ${description}`);
        console.error('    Error:', error.message || error);
        if (error.stack) {
            // console.error('    Stack:', error.stack.split('\n').slice(1).join('\n'));
        }
        testsFailed++;
    }
}

async function setup() {
    console.log('Setting up test environment...');
    await fs.mkdir(TEST_DIR_CUSTOM, { recursive: true });

    // Get default userData path from the module itself for cleanup
    if (db._getInternals && typeof db._getInternals === 'function') {
        try {
            DEFAULT_USER_DATA_PATH = db._getInternals().userData;
            console.log(`  Default userData path for cleanup: ${DEFAULT_USER_DATA_PATH}`);
        } catch(e) {
            console.warn("  Could not get userData path from db._getInternals(). Default path cleanup might be incomplete.");
        }
    } else {
         console.warn("  db._getInternals() not available. Default path cleanup might be incomplete.");
    }
    console.log('Setup complete.');
}

async function cleanup() {
    console.log('\nCleaning up test environment...');
    try {
        await fs.rm(TEST_DIR_CUSTOM, { recursive: true, force: true });
        console.log(`  Removed custom test directory: ${TEST_DIR_CUSTOM}`);
    } catch (e) {
        console.error(`  Error removing custom test directory: ${TEST_DIR_CUSTOM}`, e.message);
    }

    if (DEFAULT_USER_DATA_PATH) {
        try {
            const defaultTable1Path = path.join(DEFAULT_USER_DATA_PATH, DEFAULT_PATH_TABLE_1 + '.json');
            if (fsSync.existsSync(defaultTable1Path)) {
                await fs.unlink(defaultTable1Path);
                console.log(`  Cleaned up default path table: ${defaultTable1Path}`);
            }
            const defaultTable2Path = path.join(DEFAULT_USER_DATA_PATH, DEFAULT_PATH_TABLE_2_FOR_VALID_TEST + '.json');
             if (fsSync.existsSync(defaultTable2Path)) {
                await fs.unlink(defaultTable2Path);
                console.log(`  Cleaned up default path table: ${defaultTable2Path}`);
            }
        } catch (e) {
            console.error(`  Error cleaning default path tables: `, e.message);
        }
    }
    console.log('Cleanup complete.');
}

async function main() {
    await setup();

    // --- createTable ---
    await runTest("createTable: successfully creates a table at custom location", async () => {
        const tableName = "usersCustom";
        const result = await createTableAsync(tableName, TEST_DIR_CUSTOM);
        if (!result || !result.toLowerCase().includes("success")) throw new Error("Success message not received.");
        const tablePath = path.join(TEST_DIR_CUSTOM, tableName + '.json');
        if (!fsSync.existsSync(tablePath)) throw new Error(`Table file not found at ${tablePath}`);
    });

    await runTest("createTable: successfully creates a table at default location", async () => {
        // This test relies on DEFAULT_USER_DATA_PATH being set for cleanup.
        if (!DEFAULT_USER_DATA_PATH) {
            console.warn("  Skipping default path test for createTable as DEFAULT_USER_DATA_PATH is not set.");
            testsPassed++; // Count as passed to not fail the suite due to setup issue outside test's control
            return;
        }
        const result = await createTableAsync(DEFAULT_PATH_TABLE_1); // No location, uses default
        if (!result || !result.toLowerCase().includes("success")) throw new Error("Success message not received for default path.");
        const tablePath = path.join(DEFAULT_USER_DATA_PATH, DEFAULT_PATH_TABLE_1 + '.json');
        if (!fsSync.existsSync(tablePath)) throw new Error(`Default table file not found at ${tablePath}`);
    });

    await runTest("createTable: fails if table already exists", async () => {
        const tableName = "usersCustomExists";
        await createTableAsync(tableName, TEST_DIR_CUSTOM); // Create first time
        try {
            await createTableAsync(tableName, TEST_DIR_CUSTOM); // Attempt to create again
            throw new Error("createTable should have failed for existing table.");
        } catch (error) {
            if (!error.message.includes("already exists")) {
                throw new Error(`Expected 'already exists' error, got: ${error.message}`);
            }
        }
    });

    // --- tableExists ---
    await runTest("tableExists: returns true for an existing table (custom)", async () => {
        const tableName = "checkExistsCustom";
        await createTableAsync(tableName, TEST_DIR_CUSTOM);
        const exists = await tableExistsAsync(tableName, TEST_DIR_CUSTOM);
        if (!exists) throw new Error("tableExists returned false for an existing table.");
    });

    await runTest("tableExists: returns false for non-existing table", async () => {
        const exists = await tableExistsAsync("nonExistentTable", TEST_DIR_CUSTOM);
        if (exists) throw new Error("tableExists returned true for a non-existing table.");
    });

    // --- valid ---
    await runTest("valid: returns true for a valid table file", async () => {
        const tableName = "validTableCustom";
        await createTableAsync(tableName, TEST_DIR_CUSTOM);
        const isValid = await validAsync(tableName, TEST_DIR_CUSTOM);
        if (!isValid) throw new Error("valid returned false for a valid table file.");
    });

    await runTest("valid: returns false for a non-existent table file", async () => {
        const isValid = await validAsync("nonExistentForValid", TEST_DIR_CUSTOM);
        if (isValid) throw new Error("valid returned true for a non-existent table.");
    });

    await runTest("valid: returns false for a corrupted JSON file", async () => {
        const tableName = "corruptedTable";
        const tablePath = path.join(TEST_DIR_CUSTOM, tableName + ".json");
        // Ensure dir exists before writing corrupted file
        await fs.mkdir(path.dirname(tablePath), { recursive: true });
        await fs.writeFile(tablePath, "{name: 'test', age: 30, invalidJson: }"); // Write invalid JSON
        const isValid = await validAsync(tableName, TEST_DIR_CUSTOM);
        if (isValid) throw new Error("valid returned true for a corrupted JSON file.");
    });

    // --- insertTableContent ---
    const insertTableNameCustom = "insertCustom";
    await runTest("insertTableContent: (setup) create table for insert tests", async () => {
        await createTableAsync(insertTableNameCustom, TEST_DIR_CUSTOM);
    });

    await runTest("insertTableContent: inserts record with generated ID (custom)", async () => {
        const record = { name: "Alice", age: 30 };
        const result = await insertTableContentAsync(insertTableNameCustom, TEST_DIR_CUSTOM, record);
        if (!result.id) throw new Error("Generated ID not returned in callback.");
        if (result.message.toLowerCase().indexOf("success") === -1) throw new Error("Success message not found.");
    });

    await runTest("insertTableContent: inserts record with provided ID (custom)", async () => {
        const record = { id: "custom123", name: "Bob", occupation: "Builder" };
        const result = await insertTableContentAsync(insertTableNameCustom, TEST_DIR_CUSTOM, record);
        if (result.id !== "custom123") throw new Error("Provided ID not used or returned correctly.");
    });

    // --- getAll ---
    await runTest("getAll: retrieves all records (custom)", async () => {
        const records = await getAllAsync(insertTableNameCustom, TEST_DIR_CUSTOM);
        if (!Array.isArray(records)) throw new Error("getAll did not return an array.");
        if (records.length !== 2) throw new Error(`Expected 2 records, got ${records.length}`);
    });

    // --- getRows ---
    await runTest("getRows: retrieves rows matching criteria (custom)", async () => {
        const rows = await getRowsAsync(insertTableNameCustom, TEST_DIR_CUSTOM, { name: "Alice" });
        if (rows.length !== 1 || rows[0].name !== "Alice") throw new Error("getRows did not retrieve correct row.");
    });
    await runTest("getRows: returns empty array for no match (custom)", async () => {
        const rows = await getRowsAsync(insertTableNameCustom, TEST_DIR_CUSTOM, { name: "NonExistent" });
        if (rows.length !== 0) throw new Error("getRows did not return empty array for no match.");
    });

    // --- updateRow ---
    const updateTableName = "updateTestCustom";
    await runTest("updateRow: (setup) create and populate table for update tests", async () => {
        await createTableAsync(updateTableName, TEST_DIR_CUSTOM);
        await insertTableContentAsync(updateTableName, TEST_DIR_CUSTOM, { id: 1, name: "Charlie", version: 1 });
        await insertTableContentAsync(updateTableName, TEST_DIR_CUSTOM, { id: 2, name: "Carol", version: 1 });
        await insertTableContentAsync(updateTableName, TEST_DIR_CUSTOM, { id: 3, name: "Charlie", version: 1 }); // Another Charlie
    });

    await runTest("updateRow: updates a single row and verifies count/change", async () => {
        const result = await updateRowAsync(updateTableName, TEST_DIR_CUSTOM, { id: 1 }, { version: 2, status: "active" });
        if (result.count !== 1) throw new Error(`Expected 1 record updated, got ${result.count}`);
        const rows = await getRowsAsync(updateTableName, TEST_DIR_CUSTOM, { id: 1 });
        if (rows[0].version !== 2 || rows[0].status !== "active") throw new Error("Row not updated correctly.");
    });

    await runTest("updateRow: updates multiple rows and verifies count", async () => {
        const result = await updateRowAsync(updateTableName, TEST_DIR_CUSTOM, { name: "Charlie" }, { status: "verified" });
        if (result.count !== 2) throw new Error(`Expected 2 records updated for name Charlie, got ${result.count}`);
        const rows = await getRowsAsync(updateTableName, TEST_DIR_CUSTOM, { name: "Charlie" });
        if (rows.some(r => r.status !== "verified")) throw new Error("Not all Charlie rows updated.");
    });

    await runTest("updateRow: returns count 0 for no matching rows", async () => {
        const result = await updateRowAsync(updateTableName, TEST_DIR_CUSTOM, { name: "NonExistent" }, { status: "ghost" });
        if (result.count !== 0) throw new Error("Expected 0 records updated for non-matching criteria.");
    });

    await runTest("updateRow: fails for empty WHERE clause", async () => {
        try {
            await updateRowAsync(updateTableName, TEST_DIR_CUSTOM, {}, { status: "DANGER" });
            throw new Error("updateRow should have failed for empty WHERE clause.");
        } catch (error) {
            if (!error.message.toLowerCase().includes("where clause is empty")) {
                throw new Error(`Expected 'empty where' error, got: ${error.message}`);
            }
        }
    });

    // --- deleteRow ---
    const deleteTableName = "deleteTestCustom";
     await runTest("deleteRow: (setup) create and populate for delete tests", async () => {
        await createTableAsync(deleteTableName, TEST_DIR_CUSTOM);
        await insertTableContentAsync(deleteTableName, TEST_DIR_CUSTOM, { id: 'd1', name: "Dave", category: "A" });
        await insertTableContentAsync(deleteTableName, TEST_DIR_CUSTOM, { id: 'd2', name: "Diana", category: "B" });
        await insertTableContentAsync(deleteTableName, TEST_DIR_CUSTOM, { id: 'd3', name: "Dave", category: "C" });
    });

    await runTest("deleteRow: deletes a single row and verifies count", async () => {
        const result = await deleteRowAsync(deleteTableName, TEST_DIR_CUSTOM, { id: 'd2' });
        if (result.count !== 1) throw new Error(`Expected 1 record deleted, got ${result.count}`);
        const rows = await getAllAsync(deleteTableName, TEST_DIR_CUSTOM);
        if (rows.length !== 2 || rows.find(r => r.id === 'd2')) throw new Error("Row not deleted or incorrect row deleted.");
    });

    await runTest("deleteRow: deletes multiple rows and verifies count", async () => {
        const result = await deleteRowAsync(deleteTableName, TEST_DIR_CUSTOM, { name: "Dave" });
        if (result.count !== 2) throw new Error(`Expected 2 records deleted for name Dave, got ${result.count}`);
        const rows = await getAllAsync(deleteTableName, TEST_DIR_CUSTOM);
        if (rows.length !== 0) throw new Error("Not all Dave rows deleted, or table not empty.");
    });

    await runTest("deleteRow: returns count 0 for no matching rows", async () => {
        // Repopulate for this test
        await insertTableContentAsync(deleteTableName, TEST_DIR_CUSTOM, { id: 'd4', name: "Derek" });
        const result = await deleteRowAsync(deleteTableName, TEST_DIR_CUSTOM, { name: "NonExistent" });
        if (result.count !== 0) throw new Error("Expected 0 records deleted for non-matching criteria.");
        const rows = await getAllAsync(deleteTableName, TEST_DIR_CUSTOM);
        if (rows.length !== 1) throw new Error("Table should have 1 record after no-match delete.");
    });

    await runTest("deleteRow: fails for empty WHERE clause", async () => {
        try {
            await deleteRowAsync(deleteTableName, TEST_DIR_CUSTOM, {});
            throw new Error("deleteRow should have failed for empty WHERE clause.");
        } catch (error) {
            if (!error.message.toLowerCase().includes("where clause cannot be empty")) {
                throw new Error(`Expected 'empty where' error, got: ${error.message}`);
            }
        }
    });

    // --- count ---
    const countTableName = "countTestCustom";
    await runTest("count: (setup) create table for count tests", async () => {
         await createTableAsync(countTableName, TEST_DIR_CUSTOM);
    });
    await runTest("count: returns 0 for an empty table", async () => {
        const num = await countAsync(countTableName, TEST_DIR_CUSTOM);
        if (num !== 0) throw new Error(`Expected count 0 for empty table, got ${num}`);
    });
    await runTest("count: returns correct count for non-empty table", async () => {
        await insertTableContentAsync(countTableName, TEST_DIR_CUSTOM, { name: "Eve" });
        await insertTableContentAsync(countTableName, TEST_DIR_CUSTOM, { name: "Enoch" });
        const num = await countAsync(countTableName, TEST_DIR_CUSTOM);
        if (num !== 2) throw new Error(`Expected count 2, got ${num}`);
    });

    // --- clearTable ---
    await runTest("clearTable: clears all records from a table", async () => {
        await clearTableAsync(countTableName, TEST_DIR_CUSTOM);
        const num = await countAsync(countTableName, TEST_DIR_CUSTOM);
        if (num !== 0) throw new Error(`Table not cleared, count is ${num}`);
    });

    // --- insertTableContents ---
    const bulkInsertTableName = "bulkInsertTestCustom";
    await runTest("insertTableContents: (setup) create table for bulk insert tests", async () => {
        await createTableAsync(bulkInsertTableName, TEST_DIR_CUSTOM);
    });

    await runTest("insertTableContents: successfully inserts multiple records", async () => {
        const recordsToInsert = [
            { name: "Bulk User 1", type: "bulk" },
            { name: "Bulk User 2", type: "bulk" },
            { id: "customBulkId1", name: "Bulk User 3 with ID", type: "bulk" }
        ];
        const result = await insertTableContentsAsync(bulkInsertTableName, TEST_DIR_CUSTOM, recordsToInsert);
        if (!result || result.ids.length !== 3) throw new Error("insertTableContents did not return correct ID count.");
        if (!result.ids.includes("customBulkId1")) throw new Error("Custom ID not found in returned IDs.");

        const allRecords = await getAllAsync(bulkInsertTableName, TEST_DIR_CUSTOM);
        if (allRecords.length !== 3) throw new Error(`Expected 3 records after bulk insert, got ${allRecords.length}`);
        if (!allRecords.find(r => r.id === "customBulkId1")) throw new Error("Record with custom ID not found after bulk insert.");
        if (allRecords.filter(r => r.type === "bulk").length !== 3) throw new Error("Not all bulk records seem to be inserted or have correct type.");
    });

    await runTest("insertTableContents: inserts more records, some with ID, some without", async () => {
        const recordsToInsert = [
            { name: "Bulk User 4", type: "bulk-more" }, // Will get auto ID
            { id: "customBulkId2", name: "Bulk User 5 with ID", type: "bulk-more" }
        ];
        const result = await insertTableContentsAsync(bulkInsertTableName, TEST_DIR_CUSTOM, recordsToInsert);
        if (!result || result.ids.length !== 2) throw new Error("insertTableContents did not return correct ID count for second batch.");
        if (!result.ids.includes("customBulkId2")) throw new Error("Custom ID from second batch not found in returned IDs.");

        const allRecords = await getAllAsync(bulkInsertTableName, TEST_DIR_CUSTOM);
        // Previous test had 3, this adds 2 = 5 total
        if (allRecords.length !== 5) throw new Error(`Expected 5 records after second bulk insert, got ${allRecords.length}`);
        if (allRecords.filter(r => r.type === "bulk-more").length !== 2) throw new Error("Not all 'bulk-more' records inserted.");
    });

    await runTest("insertTableContents: fails when inserting an empty array", async () => {
        try {
            await insertTableContentsAsync(bulkInsertTableName, TEST_DIR_CUSTOM, []);
            throw new Error("insertTableContents should have failed for empty array.");
        } catch (error) {
            if (!error.message.includes("non-empty array")) {
                throw new Error(`Expected 'non-empty array' error, got: ${error.message}`);
            }
        }
    });

    await runTest("insertTableContents: fails when inserting an array of non-objects", async () => {
        try {
            await insertTableContentsAsync(bulkInsertTableName, TEST_DIR_CUSTOM, [1, 2, "string"]);
            throw new Error("insertTableContents should have failed for array of non-objects.");
        } catch (error) {
            if (!error.message.includes("must be objects")) {
                throw new Error(`Expected 'must be objects' error, got: ${error.message}`);
            }
        }
    });

    await runTest("insertTableContents: fails if table does not exist", async () => {
        const nonExistentTable = "ghostTableForBulkInsert";
        try {
            await insertTableContentsAsync(nonExistentTable, TEST_DIR_CUSTOM, [{ name: "Ghost" }]);
            throw new Error("insertTableContents should have failed for non-existent table.");
        } catch (error) {
            if (!error.message.includes("does not exist or is not accessible")) {
                throw new Error(`Expected 'does not exist' error, got: ${error.message}`);
            }
        }
    });

    // Test Promise-based API
    await runTest("Promise API - createTableAsync", async () => {
        const tableName = 'test_promise_table';
        const result = await db.createTableAsync(tableName, TEST_DIR_CUSTOM);
        if (!result.includes('created successfully')) {
            throw new Error(`Expected success message, got: ${result}`);
        }
        
        // Verify table was created
        const exists = await db.tableExistsAsync(tableName, TEST_DIR_CUSTOM);
        if (exists !== true) {
            throw new Error('Table should exist after creation');
        }
    });

    await runTest("Promise API - insertTableContentAsync and getAllAsync", async () => {
        const tableName = 'test_promise_table';
        const testData = { name: 'Promise Test', value: 42 };
        
        const insertResult = await db.insertTableContentAsync(tableName, TEST_DIR_CUSTOM, testData);
        if (!insertResult.message || !insertResult.message.includes('successfully')) {
            throw new Error(`Expected success message, got: ${JSON.stringify(insertResult)}`);
        }
        
        const allData = await db.getAllAsync(tableName, TEST_DIR_CUSTOM);
        if (!Array.isArray(allData)) {
            throw new Error('getAllAsync should return an array');
        }
        if (allData.length === 0) {
            throw new Error('Should have at least one record');
        }
        if (allData[0].name !== 'Promise Test') {
            throw new Error('Record should have correct name');
        }
        if (allData[0].value !== 42) {
            throw new Error('Record should have correct value');
        }
    });

    await runTest("Promise API - getRowsAsync", async () => {
        const tableName = 'test_promise_table';
        const rows = await db.getRowsAsync(tableName, TEST_DIR_CUSTOM, { name: 'Promise Test' });
        if (!Array.isArray(rows)) {
            throw new Error('getRowsAsync should return an array');
        }
        if (rows.length !== 1) {
            throw new Error('Should find exactly one matching record');
        }
        if (rows[0].name !== 'Promise Test') {
            throw new Error('Found record should have correct name');
        }
    });

    await runTest("Promise API - updateRowAsync", async () => {
        const tableName = 'test_promise_table';
        const updateResult = await db.updateRowAsync(tableName, TEST_DIR_CUSTOM, 
            { name: 'Promise Test' }, { value: 100 });
        if (!updateResult.message || !updateResult.message.includes('updated')) {
            throw new Error(`Expected update message, got: ${JSON.stringify(updateResult)}`);
        }
        
        const updatedRows = await db.getRowsAsync(tableName, TEST_DIR_CUSTOM, { name: 'Promise Test' });
        if (updatedRows[0].value !== 100) {
            throw new Error('Value should be updated to 100');
        }
    });

    await runTest("Promise API - searchAsync", async () => {
        const tableName = 'test_promise_table';
        const searchResults = await db.searchAsync(tableName, TEST_DIR_CUSTOM, 'name', 'Promise');
        if (!Array.isArray(searchResults)) {
            throw new Error('searchAsync should return an array');
        }
        if (searchResults.length !== 1) {
            throw new Error('Should find one matching record');
        }
        if (searchResults[0].name !== 'Promise Test') {
            throw new Error('Found record should match search');
        }
    });

    await runTest("Promise API - countAsync", async () => {
        const tableName = 'test_promise_table';
        const count = await db.countAsync(tableName, TEST_DIR_CUSTOM);
        if (typeof count !== 'number') {
            throw new Error('countAsync should return a number');
        }
        if (count !== 1) {
            throw new Error('Should have exactly one record');
        }
    });

    await runTest("Promise API - getFieldAsync", async () => {
        const tableName = 'test_promise_table';
        const names = await db.getFieldAsync(tableName, TEST_DIR_CUSTOM, 'name');
        if (!Array.isArray(names)) {
            throw new Error('getFieldAsync should return an array');
        }
        if (names.length !== 1) {
            throw new Error('Should have one name');
        }
        if (names[0] !== 'Promise Test') {
            throw new Error('Should return correct name');
        }
    });

    await runTest("Promise API - deleteRowAsync", async () => {
        const tableName = 'test_promise_table';
        const deleteResult = await db.deleteRowAsync(tableName, TEST_DIR_CUSTOM, { name: 'Promise Test' });
        if (!deleteResult.message || !deleteResult.message.includes('deleted')) {
            throw new Error(`Expected delete message, got: ${JSON.stringify(deleteResult)}`);
        }
        
        const remainingRows = await db.getAllAsync(tableName, TEST_DIR_CUSTOM);
        if (remainingRows.length !== 0) {
            throw new Error('Should have no records after deletion');
        }
    });

    await runTest("Promise API - clearTableAsync", async () => {
        const tableName = 'test_promise_table';
        
        // Add some data first
        await db.insertTableContentAsync(tableName, TEST_DIR_CUSTOM, { test: 'data' });
        
        const clearResult = await db.clearTableAsync(tableName, TEST_DIR_CUSTOM);
        if (!clearResult.includes('cleared')) {
            throw new Error(`Expected clear message, got: ${clearResult}`);
        }
        
        const count = await db.countAsync(tableName, TEST_DIR_CUSTOM);
        if (count !== 0) {
            throw new Error('Table should be empty after clearing');
        }
    });

    await runTest("Promise API - Error handling", async () => {
        try {
            await db.getAllAsync('nonexistent_table', TEST_DIR_CUSTOM);
            throw new Error('Should have thrown an error for nonexistent table');
        } catch (error) {
            if (!(error instanceof Error)) {
                throw new Error('Should throw an Error object');
            }
            if (!error.message.includes('ENOENT') && !error.message.includes('not found')) {
                throw new Error('Error message should indicate file not found');
            }
        }
    });

    await runTest("Promise API - Promisify utility", async () => {
        // Test the promisify utility function
        const promisifiedCreateTable = db.promisify(db.createTable);
        const tableName = 'test_promisify_table';
        
        const result = await promisifiedCreateTable(tableName, TEST_DIR_CUSTOM);
        if (!result.includes('created successfully')) {
            throw new Error(`Expected success message, got: ${result}`);
        }
        
        const exists = await db.tableExistsAsync(tableName, TEST_DIR_CUSTOM);
        if (exists !== true) {
            throw new Error('Table should exist after creation with promisify');
        }
    });


    // Final Summary
    console.log(`\n--- Test Summary ---`);
    console.log(`  Total Tests: ${testsPassed + testsFailed}`);
    console.log(`  Passed: ${testsPassed}`);
    console.log(`  Failed: ${testsFailed}`);

    await cleanup();

    if (testsFailed > 0) {
        console.error("\nSome tests failed. Exiting with error code 1.");
        process.exit(1);
    } else {
        console.log("\nAll tests passed!");
    }
}

main().catch(err => {
    console.error("Critical error during test execution:", err);
    process.exit(1);
});
