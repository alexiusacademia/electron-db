// const electron = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os'); // Corrected: no 'new' for os module

let userData;

try {
    const electron = require('electron');
    // Attempt to get the app object. This might be electron.app or electron.remote.app
    // depending on the context (main vs renderer) and Electron version.
    // electron.remote is deprecated in newer versions.
    // A more robust solution for renderers would be to use ipcRenderer to get path from main.
    // For this library's general purpose, we try common patterns.
    const app = electron.app || (electron.remote ? electron.remote.app : undefined);

    if (!app || typeof app.getPath !== 'function') {
        // This error will be caught by the main try...catch block
        throw new Error("Electron app object or app.getPath method not available.");
    }
    userData = app.getPath('userData');
    // Optional: create a subfolder within userData if desired, e.g.:
    // userData = path.join(app.getPath('userData'), 'electron-db-data');
} catch (e) {
    // Log the error for debugging if needed, but console.warn is for user feedback.
    // console.error("Electron-specific path retrieval failed:", e.message);
    console.warn("electron-db: Electron module not found or Electron app object not available. Using OS-specific default path. For robust behavior, explicitly provide a storage location for your tables, or ensure Electron's 'app' module is accessible if running in an Electron environment.");

    const defaultDirName = 'electron-db-data'; // Changed from 'electron-db-tables' for clarity
    const homeDir = os.homedir();
    const currentPlatform = os.platform(); // Renamed to avoid conflict with 'platform' variable if it existed from old code

    if (currentPlatform === 'win32') {
        // process.env.APPDATA is the roaming app data folder.
        // process.env.LOCALAPPDATA would be for local app data, often preferred.
        // However, to align with Electron's default userData behavior which is typically roaming:
        userData = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), defaultDirName);
    } else if (currentPlatform === 'darwin') {
        userData = path.join(homeDir, 'Library', 'Application Support', defaultDirName);
    } else { // Linux and other POSIX-like
        // Use ~/.config/app-name as per XDG Base Directory Specification
        userData = path.join(homeDir, '.config', defaultDirName);
    }
}

/**
 * Create a table | a json file
 * The second argument is optional, if ommitted, the file
 * will be created at the default location.
 * @param  {[string]} arguments[0] [Table name]
 * @param {[string]} arguments[1] [Location of the database file] (Optional)
 * @param {[function]} arguments[2] [Callbak ]
 */
// function createTable(tableName, callback) {
// function createTable() {
function createTable(tableName, locationOrCallback, callbackIfLocationProvided) {
    let location;
    let callback;

    if (typeof tableName !== 'string' || !tableName.trim()) {
        // Determine the actual callback function to use for error reporting early.
        let cb = null;
        if (typeof locationOrCallback === 'function') cb = locationOrCallback;
        else if (typeof callbackIfLocationProvided === 'function') cb = callbackIfLocationProvided;

        if (typeof tableName !== 'string' || !tableName.trim()) {
            if (cb) cb(new Error("Table name must be a non-empty string."));
            return;
        }
    }

    if (typeof locationOrCallback === 'string') {
        location = locationOrCallback;
        callback = callbackIfLocationProvided;
        if (typeof callback !== 'function') {
            // No reliable callback to notify, and this is a programming error.
            // console.error("Error: createTable called with location but no valid callback.");
            // For a library, throwing might be too disruptive. Silently returning is one option.
            // Or, if a pseudo-callback was passed that's not a function, try to use it (already handled by initial cb check).
            // This case means callbackIfLocationProvided was not a function.
            return;
        }
    } else if (typeof locationOrCallback === 'function') {
        location = userData; // Default location
        callback = locationOrCallback;
    } else {
        // Invalid arguments if neither of the above.
        // cb might have been identified if callbackIfLocationProvided was a function but locationOrCallback was not a string/function.
        if (callbackIfLocationProvided && typeof callbackIfLocationProvided === 'function') { // Check if it was a function initially
             callbackIfLocationProvided(new Error("Invalid arguments for createTable: Expected location string or callback function as second argument."));
        } else if (locationOrCallback && typeof locationOrCallback === 'function') {
             locationOrCallback(new Error("Invalid arguments for createTable: Expected callback function as third argument when location is provided."));
        }
        return;
    }

    // Final check for callback
    if (typeof callback !== 'function') {
        // This should ideally not be reached if logic above is correct.
        // console.error("Error: createTable could not determine a valid callback function.");
        return;
    }

    const fname = path.join(location, tableName + '.json');

    // Ensure the directory exists first
    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            callback(mkdirErr); // Propagate fs error
            return;
        }

        // Check if the file with the tablename.json exists
        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr === null) {
                // File exists
                callback(new Error(`Table '${tableName}' already exists at ${location}.`));
                return;
            } else if (accessErr.code === 'ENOENT') {
                // File does not exist, proceed with creation
                let obj = new Object();
                obj[tableName] = [];

                fs.writeFile(fname, JSON.stringify(obj, null, 2), (writeErr) => {
                    if (writeErr) {
                        callback(writeErr); // Propagate fs error
                    } else {
                        callback(null, `Table '${tableName}' created successfully at ${location}.`);
                    }
                });
            } else {
                // Other access error
                callback(accessErr); // Propagate fs error
            }
        });
    });
}

/**
 * Checks if a json file contains valid JSON string
 */
// function valid(dbName, location) {
function valid(dbName, location, callback) {
    if (typeof callback !== 'function') {
        // console.error("Error: valid called without a valid callback function.");
        return;
    }
    if (typeof dbName !== 'string' || !dbName.trim()) {
        callback(new Error("DB name must be a non-empty string for valid()."));
        return;
    }
    const dbPath = location || userData;
    const fName = path.join(dbPath, dbName + '.json');

    fs.readFile(fName, 'utf-8', (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') { // File does not exist, so not valid in this context
                callback(null, false);
            } else { // Other fs error
                callback(err);
            }
            return;
        }
        try {
            JSON.parse(content);
            callback(null, true); // Valid JSON
        } catch (e_parse) {
            // If it's a parse error, the file content is not valid JSON.
            callback(null, false);
        }
    });
}

/**
 * Insert object to table. The object will be appended with the property, id
 * which uses timestamp as value.
 * There are 3 required arguments.
 * @param  {string} arguments[0]  [Table name]
 * @param  {string} arguments[1] [Location of the database file] (Optional)
 * @param  {string} arguments[2] [Row object]
 * @param  {Function} arguments[3] [Callback function]
 * @returns {(number|undefined)} [ID of the inserted row]
 */
// function insertTableContent(tableName, tableRow, callback) {
// function insertTableContent() {
function insertTableContent(tableName, locationOrTableRow, tableRowOrCallback, callbackIfLocationProvided) {
    let location;
    let tableRow;
    // Removed duplicate declarations of location and tableRow
    let callback;

    // Try to identify the callback first for consistent error reporting
    if (typeof callbackIfLocationProvided === 'function') {
        callback = callbackIfLocationProvided;
    } else if (typeof tableRowOrCallback === 'function' && (typeof locationOrTableRow === 'string' || typeof locationOrTableRow === 'object')) {
        // If 3 args: (tableName, location/tableRow, callback)
        // or 4 args: (tableName, location, tableRow, callback) - this case is caught by callbackIfLocationProvided being the callback
        // This specifically targets the (tableName, tableRow, callback) scenario for tableRowOrCallback
        if(typeof locationOrTableRow === 'object' && locationOrTableRow !== null) callback = tableRowOrCallback;
    } else if (typeof locationOrTableRow === 'function'){
         //This case implies (tableName, callback) which is not a valid signature for insert.
         //but if it was the only function, it might be the callback.
    }


    if (typeof tableName !== 'string' || !tableName.trim()) {
        if (callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        else if (typeof locationOrTableRow === 'function') locationOrTableRow(new Error("Table name must be a non-empty string."));
        else if (typeof tableRowOrCallback === 'function') tableRowOrCallback(new Error("Table name must be a non-empty string."));
        return;
    }

    if (typeof locationOrTableRow === 'string') { // Location is provided: (tableName, location, tableRow, callback)
        location = locationOrTableRow;
        tableRow = tableRowOrCallback;
        // callback is already callbackIfLocationProvided
        if (typeof callback !== 'function') { /* console.error("Callback missing for insertTableContent with location"); */ return; }
        if (typeof tableRow !== 'object' || tableRow === null) {
            callback(new Error("tableRow must be an object when location is provided."));
            return;
        }
    } else if (typeof locationOrTableRow === 'object' && locationOrTableRow !== null) { // Location is NOT provided: (tableName, tableRow, callback)
        location = userData;
        tableRow = locationOrTableRow;
        callback = tableRowOrCallback; // This is the callback
        if (typeof callback !== 'function') { /* console.error("Callback missing for insertTableContent"); */ return; }
    } else {
        const msg = "Invalid arguments for insertTableContent. Expected (tableName, [location], tableRow, callback).";
        if (callback && typeof callback === 'function') callback(new Error(msg));
        // Attempt to call other potential callbacks if the main one isn't a function yet.
        else if (typeof tableRowOrCallback === 'function') tableRowOrCallback(new Error(msg + " Check tableRow."));
        else if (typeof locationOrTableRow === 'function') locationOrTableRow(new Error(msg + " Check location or tableRow."));
        return;
    }

    // Final validation of callback and tableRow
    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for insertTableContent"); */ return; }
    if (typeof tableRow !== 'object' || tableRow === null) { // This might be redundant if covered above but good for safety
        callback(new Error("tableRow must be a valid object."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            callback(mkdirErr);
            return;
        }

        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                callback(new Error(`Table/json file '${fname}' doesn't exist or is not accessible.`));
                return;
            }

            fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
                if (readErr) {
                    callback(readErr);
                    return;
                }

                let table;
                try {
                    table = JSON.parse(fileContent);
                } catch (parseErr) {
                    callback(parseErr);
                    return;
                }

                if (!table[tableName] || !Array.isArray(table[tableName])) {
                    table[tableName] = [];
                }

                let id;
                if (!tableRow['id']) {
                    let date = new Date();
                    id = date.getTime();
                    tableRow['id'] = id;
                } else {
                    id = tableRow['id'];
                }

                table[tableName].push(tableRow);

                fs.writeFile(fname, JSON.stringify(table, null, 2), (writeErr) => {
                    if (writeErr) {
                        callback(writeErr);
                    } else {
                        callback(null, { message: "Object written successfully!", id: id });
                    }
                });
            });
        });
    });
}

/**
 * Get all contents of the table/json file object
 * @param  {string} arguments[0] [Table name]
 * @param  {string} arguments[1] [Location of the database file] (Optional)
 * @param  {Function} arguments[2]  [callback function]
 */
// function getAll(tableName, callback) {
// function getAll() {
function getAll(tableName, locationOrCallback, callbackIfLocationProvided) {
    let location;
    // Removed duplicate declaration of location
    let callback;

    // Argument parsing and callback identification
    if (typeof locationOrCallback === 'string') {
        location = locationOrCallback;
        callback = callbackIfLocationProvided;
        if (typeof callback !== 'function') { /* console.error("Callback missing for getAll with location"); */ return; }
    } else if (typeof locationOrCallback === 'function') {
        location = userData;
        callback = locationOrCallback;
    } else { // Invalid second argument type
        if (typeof callbackIfLocationProvided === 'function') { // If 3rd arg is a func, maybe it was the intended cb
            callbackIfLocationProvided(new Error("Invalid arguments for getAll: Second argument must be location (string) or callback (function)."));
        } else if (typeof locationOrCallback === 'function') { //This should have been caught by the elseif above
             locationOrCallback(new Error("Invalid arguments for getAll: Second argument must be location (string) or callback (function)."));
        }
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for getAll"); */ return; }

    if (typeof tableName !== 'string' || !tableName.trim()) {
        callback(new Error("Table name must be a non-empty string."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.access(fname, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
            // Distinguish between ENOENT and other errors if necessary, or just propagate.
            // For getAll, if file not found, it's a clear case of not being able to get the data.
            callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
            return;
        }

        fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
            if (readErr) {
                callback(readErr); // Propagate fs error
                return;
            }

            try {
                let table = JSON.parse(fileContent);
                if (table && table.hasOwnProperty(tableName)) {
                     callback(null, table[tableName]);
                } else {
                     callback(new Error(`Table '${tableName}' not found in file or file structure is invalid.`));
                }
            } catch (parseErr) {
                callback(parseErr); // Propagate JSON parsing error
            }
        });
    });
}

/**
 * Find rows of a given field/key.
 * @param  {string} arguments[0] Table name
 * @param  {string} arguments[1] Location of the database file (Optional)
 * @param  {string} arguments[2] They fey/field to retrieve.
 */
// function getField() {
function getField(tableName, locationOrKey, keyOrCallback, callbackIfLocationProvided) {
    let location;
    let key;
    // Removed duplicate declarations of location and key
    let callback;

    // Identify callback first
    if (typeof callbackIfLocationProvided === 'function') callback = callbackIfLocationProvided;
    else if (typeof keyOrCallback === 'function' && typeof locationOrKey === 'string') callback = keyOrCallback; // (tableName, key, callback)
    // else if (typeof locationOrKey === 'function') callback = locationOrKey; // This would be (tableName, callback), invalid signature

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if (callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        // Attempt to call other potential callbacks if main one not ID'd
        else if (typeof locationOrKey === 'function') locationOrKey(new Error("Table name must be a non-empty string."));
        else if (typeof keyOrCallback === 'function') keyOrCallback(new Error("Table name must be a non-empty string."));
        return;
    }

    if (typeof locationOrKey === 'string') {
        if (typeof keyOrCallback === 'string' && typeof callbackIfLocationProvided === 'function') { // (tableName, location, key, callback)
            location = locationOrKey;
            key = keyOrCallback;
            callback = callbackIfLocationProvided; // already set
        } else if (typeof keyOrCallback === 'function') { // (tableName, key, callback)
            location = userData;
            key = locationOrKey;
            callback = keyOrCallback; // already set
        } else { // Invalid combination like (tableName, string, string, not_a_function)
            if (callback && typeof callback === 'function') callback(new Error("Invalid arguments for getField: Check key and callback parameters."));
            else if (typeof callbackIfLocationProvided === 'function') callbackIfLocationProvided(new Error("Invalid arguments for getField."));
            else if (typeof keyOrCallback === 'function') keyOrCallback(new Error("Invalid arguments for getField."));
            return;
        }
    } else { // locationOrKey is not a string, implies invalid arguments
         if (callback && typeof callback === 'function') callback(new Error("Invalid arguments for getField: Second argument must be location (string) or key (string)."));
         else if (typeof keyOrCallback === 'function') keyOrCallback(new Error("Invalid arguments for getField: Second argument must be location (string) or key (string)."));
         else if (typeof locationOrKey === 'function') locationOrKey(new Error("Invalid arguments for getField: Second argument must be location (string) or key (string)."));
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for getField"); */ return; }
    if (typeof key !== 'string' || !key.trim()) {
        callback(new Error("Key must be a non-empty string."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.access(fname, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
            callback(new Error(`The table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
            return;
        }

        fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
            if (readErr) {
                callback(readErr);
                return;
            }

            try {
                let table = JSON.parse(fileContent);
                if (!table || !table.hasOwnProperty(tableName) || !Array.isArray(table[tableName])) {
                     callback(new Error(`Table '${tableName}' not found or is invalid in file.`));
                     return;
                }
                const rows = table[tableName];
                let data = [];
                let hasMatch = false;

                for (let i = 0; i < rows.length; i++) {
                    if (rows[i] && rows[i].hasOwnProperty(key)) {
                        data.push(rows[i][key]);
                        hasMatch = true;
                    }
                }

                if (!hasMatch) {
                    callback(new Error(`The key/field '${key}' does not exist in any row of table '${tableName}'.`));
                } else {
                    callback(null, data);
                }
            } catch (parseErr) {
                callback(parseErr);
            }
        });
    });
}

/**
 * Clears an existing table leaving an empty list in the json file.
 * @param  {string} arguments[0] [Table name]
 * @param  {string} arguments[1] [Location of the database file] (Optional)
 * @param  {Function} arguments[2]  [callback function]
 */
// function clearTable() {
function clearTable(tableName, locationOrCallback, callbackIfLocationProvided) {
    let location;
    // Removed duplicate declaration of location
    let callback;

    // Argument parsing and callback identification
    if (typeof locationOrCallback === 'string') {
        location = locationOrCallback;
        callback = callbackIfLocationProvided;
        if (typeof callback !== 'function') { /* console.error("Callback missing for clearTable with location"); */ return; }
    } else if (typeof locationOrCallback === 'function') {
        location = userData;
        callback = locationOrCallback;
    } else {
        if (typeof callbackIfLocationProvided === 'function') {
             callbackIfLocationProvided(new Error("Invalid arguments for clearTable: Second argument must be location (string) or callback (function)."));
        } else if (typeof locationOrCallback === 'function') { // Should be caught by above
            locationOrCallback(new Error("Invalid arguments for clearTable: Second argument must be location (string) or callback (function)."));
        }
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for clearTable"); */ return; }

    if (typeof tableName !== 'string' || !tableName.trim()) {
        callback(new Error("Table name must be a non-empty string."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            callback(mkdirErr);
            return;
        }

        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                callback(new Error(`The table file '${fname}' you are trying to clear does not exist or is not accessible. ${accessErr.message}`));
                return;
            }

            let obj = new Object();
            obj[tableName] = [];

            fs.writeFile(fname, JSON.stringify(obj, null, 2), (writeErr) => {
                if (writeErr) {
                    callback(writeErr);
                } else {
                    callback(null, `Table '${tableName}' cleared successfully at ${location}.`);
                }
            });
        });
    });
}

/**
 * Count the number of rows for a given table.
 * @param {string} FirstArgument Table name
 * @param {string} SecondArgument Location of the database file (Optional)
 * @param {callback} ThirdArgument Function callback
 */
// function count() {
function count(tableName, locationOrCallback, callbackIfLocationProvided) {
    let location;
    let callback;

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if (typeof locationOrCallback === 'function') locationOrCallback(false, "Table name must be a non-empty string.");
        else if (typeof callbackIfLocationProvided === 'function') callbackIfLocationProvided(false, "Table name must be a non-empty string.");
        return;
    }

    // count(tableName, callback)
    // count(tableName, location, callback)
    if (typeof locationOrCallback === 'string') { // location provided
        location = locationOrCallback;
        callback = callbackIfLocationProvided;
        if (typeof callback !== 'function') { /* console.error("Callback missing for count with location"); */ return; }
    } else if (typeof locationOrCallback === 'function') { // location not provided
        // location = userData; // userData will be handled by getAll if location is not passed
        callback = locationOrCallback;
    } else {
        if (typeof callbackIfLocationProvided === 'function') {
            callbackIfLocationProvided(new Error('Invalid arguments for count. Second argument must be location (string) or callback (function).'));
        } else if (typeof locationOrCallback === 'function'){ // Should be caught above
             locationOrCallback(new Error('Invalid arguments for count. Second argument must be location (string) or callback (function).'));
        }
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for count"); */ return; }

    if (typeof tableName !== 'string' || !tableName.trim()) {
        callback(new Error("Table name must be a non-empty string."));
        return;
    }

    const getAllCallback = (err, data) => {
        if (err) {
            // If err is already an Error object from getAll, just pass it.
            // If it was a string message (legacy), wrap it.
            // Based on current getAll refactor, it should be an Error object.
            callback(err);
        } else {
            callback(null, data.length);
        }
    };

    if (typeof location === 'string') { // location was determined to be a string
        getAll(tableName, location, getAllCallback);
    } else { // location was not provided (or determined to be userData by default path in prior logic)
        getAll(tableName, getAllCallback); // Calls getAll(tableName, callback) version
    }
}

/**
 * Get row or rows that matched the given condition(s) in WHERE argument
 * @param {string} FirstArgument Table name
 * @param {string} SecondArgument Location of the database file (Optional)
 * @param {object} ThirdArgument Collection of conditions to be met
 ```
 {
      key1: value1,
      key2: value2,
      ...
 }
 ```
 * @param {callback} FourthArgument Function callback
 */
// function getRows() {
function getRows(tableName, locationOrWhere, whereOrCallback, callbackIfLocationProvided) {
    let location;
    let where;
    // Removed duplicate declarations of location and where
    let callback;

    // Identify callback
    if(typeof callbackIfLocationProvided === 'function') callback = callbackIfLocationProvided;
    else if(typeof whereOrCallback === 'function' && (typeof locationOrWhere === 'string' || typeof locationOrWhere === 'object')) callback = whereOrCallback;
    // else if (typeof locationOrWhere === 'function') // invalid signature

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if (callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        else if(typeof locationOrWhere === 'function') locationOrWhere(new Error("Table name must be a non-empty string."));
        else if(typeof whereOrCallback === 'function') whereOrCallback(new Error("Table name must be a non-empty string."));
        return;
    }

    if (typeof locationOrWhere === 'string') {
        location = locationOrWhere;
        where = whereOrCallback;
        // callback = callbackIfLocationProvided; // already set
    } else if (typeof locationOrWhere === 'object' && locationOrWhere !== null) {
        location = userData;
        where = locationOrWhere;
        // callback = whereOrCallback; // already set
    } else {
        const msg = "Invalid arguments for getRows: Second argument must be location (string) or where (object).";
        if (callback && typeof callback === 'function') callback(new Error(msg));
        else if (typeof whereOrCallback === 'function') whereOrCallback(new Error(msg));
        else if (typeof locationOrWhere === 'function') locationOrWhere(new Error(msg));
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for getRows"); */ return; }
    if (typeof where !== 'object' || where === null) {
        callback(new Error("WHERE clause must be an object."));
        return;
    }

    const whereKeys = Object.keys(where);
    if (whereKeys.length === 0) {
        callback(new Error("There are no conditions passed to the WHERE clause."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.access(fname, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
            callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
            return;
        }

        fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
            if (readErr) {
                callback(readErr);
                return;
            }

            try {
                let table = JSON.parse(fileContent);
                if (!table || !table.hasOwnProperty(tableName) || !Array.isArray(table[tableName])) {
                    callback(new Error(`Table '${tableName}' not found or is invalid in file.`));
                    return;
                }
                const rows = table[tableName];
                let objs = [];

                for (let i = 0; i < rows.length; i++) {
                    let matchedCount = 0;
                    if(rows[i]){
                        for (let j = 0; j < whereKeys.length; j++) {
                            const currentKey = whereKeys[j];
                            if (rows[i].hasOwnProperty(currentKey) && rows[i][currentKey] === where[currentKey]) {
                                matchedCount++;
                            }
                        }
                    }
                    if (matchedCount === whereKeys.length) {
                        objs.push(rows[i]);
                    }
                }
                callback(null, objs);
            } catch (parseErr) {
                callback(parseErr);
            }
        });
    });
}

/**
 * Update a row or record which satisfies the where clause
 * @param  {[string]} arguments[0] [Table name]
 * @param {string} arguments[1] [Location of the database file] (Optional)
 * @param  {[object]} arguments[2]     [Objet for WHERE clause]
 * @param  {[object]} arguments[3]       [Object for SET clause]
 * @param  {Function} arguments[4]  [Callback function]
 */
// function updateRow(tableName, where, set, callback) {
// function updateRow() {
function updateRow(tableName, locationOrWhere, whereOrSet, setOrCallback, callbackIfLocationProvided) {
    let location;
    let where;
    let set;
    // Removed duplicate declarations of location, where, and set
    let callback;

    // Identify callback
    if(typeof callbackIfLocationProvided === 'function') callback = callbackIfLocationProvided;
    else if(typeof setOrCallback === 'function' && (typeof whereOrSet === 'object' || typeof whereOrSet === 'string') && typeof locationOrWhere === 'object') callback = setOrCallback; // (tableName, where, set, callback)
    // More complex cases for callback identification might be needed if signatures are very flexible

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if(callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        // ... attempt other potential callbacks ...
        else if (typeof locationOrWhere === 'function') locationOrWhere(new Error("Table name must be a non-empty string."));
        return;
    }

    if (typeof locationOrWhere === 'string') {
        location = locationOrWhere;
        where = whereOrSet;
        set = setOrCallback;
        // callback = callbackIfLocationProvided; // already set
    } else if (typeof locationOrWhere === 'object' && locationOrWhere !== null) {
        location = userData;
        where = locationOrWhere;
        set = whereOrSet;
        callback = setOrCallback;
    } else {
        const msg = "Invalid arguments for updateRow: Check location, where, or set parameters.";
        if (callback && typeof callback === 'function') callback(new Error(msg));
        // ... attempt other potential callbacks ...
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for updateRow"); */ return; }
    if (typeof where !== 'object' || where === null) {
        callback(new Error("WHERE clause must be an object."));
        return;
    }
    const whereKeys = Object.keys(where); // Define whereKeys early for the check
    if (whereKeys.length === 0) {
        callback(new Error("Aborting update: WHERE clause is empty. Updating all rows is not permitted by this function."));
        return;
    }
    if (typeof set !== 'object' || set === null) {
        callback(new Error("SET clause must be an object."));
        return;
    }

    const fname = path.join(location, tableName + '.json');

    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            callback(mkdirErr);
            return;
        }

        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
                return;
            }

            fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
                if (readErr) {
                    callback(readErr);
                    return;
                }

                let table;
                try {
                    table = JSON.parse(fileContent);
                } catch (parseErr) {
                    callback(parseErr);
                    return;
                }

                if (!table || !table.hasOwnProperty(tableName) || !Array.isArray(table[tableName])) {
                    callback(new Error(`Table '${tableName}' not found or is invalid in file.`));
                    return;
                }

                let rows = table[tableName];
                // const whereKeys = Object.keys(where); // Moved up
                const setKeys = Object.keys(set);
                let recordsUpdatedCount = 0;

                rows.forEach(row => {
                    if (!row) return; // Skip if row is null or undefined

                    let allConditionsMet = true;
                    for (const key of whereKeys) {
                        if (!row.hasOwnProperty(key) || row[key] !== where[key]) {
                            allConditionsMet = false;
                            break;
                        }
                    }

                    if (allConditionsMet) {
                        for (const keyToSet of setKeys) {
                            row[keyToSet] = set[keyToSet];
                        }
                        recordsUpdatedCount++;
                    }
                });

                if (recordsUpdatedCount > 0) {
                    table[tableName] = rows;
                    fs.writeFile(fname, JSON.stringify(table, null, 2), (writeErr) => {
                        if (writeErr) {
                            callback(writeErr);
                        } else {
                            callback(null, { message: `Successfully updated ${recordsUpdatedCount} row(s) in table '${tableName}'.`, count: recordsUpdatedCount });
                        }
                    });
                } else {
                    // No rows matched the criteria, so no file write needed.
                    callback(null, { message: `No rows matched the criteria in table '${tableName}'. Nothing updated.`, count: 0 });
                }
            });
        });
    });
}

/**
 * Searching function
 * @param {string} arguments[0] Name of the table to search for
 * @param {string} arguments[1] [Location of the database file] (Optional)
 * @param {string} arguments[2] Name of the column/key to match
 * @param {object} arguments[3] The part of the value of the key that is being lookup
 * @param {function} arguments[4] Callback function
 */
// function search(tableName, field, keyword, callback) {
// function search() {
function search(tableName, locationOrField, fieldOrKeyword, keywordOrCallback, callbackIfLocationProvided) {
    let location;
    let field;
    let keyword;
    // Removed duplicate declarations of location, field, and keyword
    let callback;

    // Identify callback
    if(typeof callbackIfLocationProvided === 'function') callback = callbackIfLocationProvided;
    else if(typeof keywordOrCallback === 'function') { // Covers (tableName, field, keyword, callback) and (tableName, location, field, callback) - needs more check
        if(typeof fieldOrKeyword === 'string' && typeof locationOrField === 'string') callback = keywordOrCallback; // (tableName, location, field, callback)
        else if (typeof fieldOrKeyword !== 'function' && typeof locationOrField === 'string') callback = keywordOrCallback; // (tableName, field, keyword, callback)
    }

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if(callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        // ... other attempts
        return;
    }

    if (typeof locationOrField === 'string') {
        if (typeof fieldOrKeyword === 'string' && typeof keywordOrCallback !== 'function' && typeof callbackIfLocationProvided === 'function') { // (tableName, location, field, keyword, callback)
            location = locationOrField;
            field = fieldOrKeyword;
            keyword = keywordOrCallback;
            // callback = callbackIfLocationProvided; // already set
        } else if (typeof fieldOrKeyword !== 'function' && typeof keywordOrCallback === 'function') { // (tableName, field, keyword, callback)
            location = userData;
            field = locationOrField;
            keyword = fieldOrKeyword;
            callback = keywordOrCallback;
        } else {
            const msg = "Invalid arguments for search: Structure doesn't match expected (tableName, [location], field, keyword, callback).";
            if (callback && typeof callback === 'function') callback(new Error(msg));
            // ... other attempts
            return;
        }
    } else {
        const msg = "Invalid arguments for search: Second argument (location or field) must be a string.";
        if (callback && typeof callback === 'function') callback(new Error(msg));
         // ... other attempts
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for search"); */ return; }
    if (typeof field !== 'string' || !field.trim()) {
        callback(new Error("Field must be a non-empty string."));
        return;
    }
    // Keyword can be any type, will be converted to string for search.

    const fname = path.join(location, tableName + '.json');

    fs.access(fname, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
            callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
            return;
        }

        fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
            if (readErr) {
                callback(readErr);
                return;
            }

            try {
                let table = JSON.parse(fileContent);
                if (!table || !table.hasOwnProperty(tableName) || !Array.isArray(table[tableName])) {
                    callback(new Error(`Table '${tableName}' not found or is invalid in file.`));
                    return;
                }
                const rows = table[tableName];
                let foundRows = [];
                let fieldMissingInRow = false;

                if (rows.length > 0) {
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i] && rows[i].hasOwnProperty(field)) {
                            const value = String(rows[i][field]).toLowerCase();
                            const searchKeyword = String(keyword).toLowerCase();
                            if (value.includes(searchKeyword)) {
                                foundRows.push(rows[i]);
                            }
                        } else {
                            // Field is missing in at least one row.
                            fieldMissingInRow = true;
                            break;
                        }
                    }
                }

                if (fieldMissingInRow) {
                    callback(new Error(`Field '${field}' not found in one or more rows during search in table '${tableName}'.`));
                } else {
                    callback(null, foundRows);
                }

            } catch (parseErr) {
                callback(parseErr);
            }
        });
    });
}

/**
 * Delete a row specified.
 * @param {*} tableName 
 * @param {string} arguments[1] [Location of the database file] (Optional)
 * @param {*} where 
 * @param {*} callback 
 */
// function deleteRow(tableName, where, callback) {
// function deleteRow() {
function deleteRow(tableName, locationOrWhere, whereOrCallback, callbackIfLocationProvided) {
    let location;
    let where;
    // Removed duplicate declarations of location and where
    let callback;

    // Identify callback
    if(typeof callbackIfLocationProvided === 'function') callback = callbackIfLocationProvided;
    else if(typeof whereOrCallback === 'function' && (typeof locationOrWhere === 'string' || typeof locationOrWhere === 'object')) callback = whereOrCallback;

    if (typeof tableName !== 'string' || !tableName.trim()) {
        if(callback && typeof callback === 'function') callback(new Error("Table name must be a non-empty string."));
        // ... other attempts
        return;
    }

    if (typeof locationOrWhere === 'string') {
        location = locationOrWhere;
        where = whereOrCallback;
        // callback = callbackIfLocationProvided; // already set
    } else if (typeof locationOrWhere === 'object' && locationOrWhere !== null) {
        location = userData;
        where = locationOrWhere;
        // callback = whereOrCallback; // already set
    } else {
        const msg = "Invalid arguments for deleteRow: Second argument must be location (string) or where (object).";
        if(callback && typeof callback === 'function') callback(new Error(msg));
         // ... other attempts
        return;
    }

    if (typeof callback !== 'function') { /* console.error("Unable to determine callback for deleteRow"); */ return; }
    if (typeof where !== 'object' || where === null) {
        callback(new Error("WHERE clause must be an object."));
        return;
    }
    if (Object.keys(where).length === 0) { // Prevent deleting all rows if where is {}
        callback(new Error("WHERE clause cannot be empty for deleteRow operation. Provide conditions or use clearTable."));
        return;
    }


    const fname = path.join(location, tableName + '.json');

    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            callback(mkdirErr);
            return;
        }

        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
                return;
            }

            fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
                if (readErr) {
                    callback(readErr);
                    return;
                }

                let table;
                try {
                    table = JSON.parse(fileContent);
                } catch (parseErr) {
                    callback(parseErr);
                    return;
                }

                if (!table || !table.hasOwnProperty(tableName) || !Array.isArray(table[tableName])) {
                    callback(new Error(`Table '${tableName}' not found or is invalid in file.`));
                    return;
                }

                let rows = table[tableName];
                const whereKeys = Object.keys(where);
                let originalRowCount = rows.length;

                const newRows = rows.filter(row => {
                    if (!row) return true;
                    for (const key of whereKeys) {
                        if (!row.hasOwnProperty(key) || row[key] !== where[key]) {
                            return true;
                        }
                    }
                    return false;
                });

                if (newRows.length < originalRowCount) {
                    table[tableName] = newRows;
                    fs.writeFile(fname, JSON.stringify(table, null, 2), (writeErr) => {
                        if (writeErr) {
                            callback(writeErr);
                        } else {
                            const deletedCount = originalRowCount - newRows.length;
                            callback(null, { message: `Successfully deleted ${deletedCount} row(s) from table '${tableName}'.`, count: deletedCount });
                        }
                    });
                } else {
                    // No rows matched the criteria, so no file write needed.
                    callback(null, { message: `No rows matched the criteria in table '${tableName}'. Nothing deleted.`, count: 0 });
                }
            });
        });
    });
}

/**
 * Check table existence
 * @param {String} dbName - Table name
 * @param {String} dbLocation - Table location path
 * @return {Boolean} checking result
 */
// function tableExists() {
// function tableExists(dbName, location) {
function tableExists(dbName, location, callback) {
    if (typeof callback !== 'function') {
        // console.error("Error: tableExists called without a valid callback function.");
        return; // Cannot proceed or report error without a callback
    }
    if (typeof dbName !== 'string' || !dbName.trim()) {
        callback(new Error("DB name must be a non-empty string for tableExists()."));
        return;
    }
    const dbPath = location || userData;
    const fName = path.join(dbPath, dbName + '.json');

    fs.access(fName, fs.constants.F_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') { // File does not exist
                callback(null, false);
            } else { // Other error, like permission issue
                callback(err);
            }
        } else { // File exists
            callback(null, true);
        }
    });
}


/**
 * Insert an array of objects into a table. Each object will be appended with an 'id' property
 * if it doesn't already have one. The 'id' uses a timestamp plus an index to ensure uniqueness within the batch.
 * @param {string} tableName - The name of the table.
 * @param {string} [locationOrRows] - Optional. The directory location of the table file OR the array of row objects if location is default.
 * @param {Array<Object>} [rowsOrCb] - The array of row objects to insert OR the callback function if location was provided.
 * @param {function} [callbackIfLocation] - The callback function if location and rows array were provided.
 */
function insertTableContents(tableName, locationOrRows, rowsOrCb, callbackIfLocation) {
    let location;
    let tableRowsArray;
    let callback;

    // Argument parsing
    if (typeof locationOrRows === 'string') {
        location = locationOrRows;
        if (!Array.isArray(rowsOrCb)) { // rowsOrCb should be the array
            if (typeof callbackIfLocation === 'function') {
                return callbackIfLocation(new Error("Rows argument must be an array when location is specified."));
            } else if (typeof rowsOrCb === 'function') { // Maybe rowsOrCb was intended as callback
                 return rowsOrCb(new Error("Rows argument must be an array when location is specified."));
            }
            return; // No valid callback to report error
        }
        tableRowsArray = rowsOrCb;
        callback = callbackIfLocation;
    } else if (Array.isArray(locationOrRows)) {
        location = userData;
        tableRowsArray = locationOrRows;
        callback = rowsOrCb;
    } else {
        // Attempt to find a callback for error reporting if arguments are wrong from the start
        let potentialCb = callbackIfLocation || rowsOrCb || locationOrRows;
        if (typeof potentialCb === 'function') {
            potentialCb(new Error("Invalid arguments for insertTableContents. Expected (tableName, [location], rowsArray, callback)."));
        }
        return;
    }

    if (typeof callback !== 'function') {
        // console.error("Callback function is not defined after parsing arguments for insertTableContents.");
        return;
    }

    if (typeof tableName !== 'string' || !tableName.trim()) {
        return callback(new Error("Table name must be a non-empty string."));
    }
    if (!Array.isArray(tableRowsArray) || tableRowsArray.length === 0) {
        return callback(new Error("Input must be a non-empty array of objects."));
    }
    if (!tableRowsArray.every(item => typeof item === 'object' && item !== null)) {
        return callback(new Error("All items in the input array must be objects."));
    }

    const fname = path.join(location, tableName + '.json');

    fs.mkdir(location, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            return callback(mkdirErr);
        }

        fs.access(fname, fs.constants.F_OK, (accessErr) => {
            if (accessErr) { // Assuming table must exist, like insertTableContent
                return callback(new Error(`Table file '${fname}' does not exist or is not accessible. ${accessErr.message}`));
            }

            fs.readFile(fname, 'utf-8', (readErr, fileContent) => {
                if (readErr) {
                    return callback(readErr);
                }

                let table;
                try {
                    table = JSON.parse(fileContent);
                } catch (parseErr) {
                    return callback(parseErr);
                }

                if (!table[tableName] || !Array.isArray(table[tableName])) {
                    return callback(new Error(`Table '${tableName}' structure is invalid or not found in file.`));
                }

                const insertedIds = [];
                const baseTimestamp = new Date().getTime();

                tableRowsArray.forEach((row, index) => {
                    let currentId = row.id;
                    if (currentId === undefined || currentId === null || String(currentId).trim() === "") {
                        currentId = `${baseTimestamp}-${index}`;
                        row.id = currentId;
                    }
                    table[tableName].push(row); // Add to existing table data
                    insertedIds.push(currentId);
                });

                fs.writeFile(fname, JSON.stringify(table, null, 2), (writeErr) => {
                    if (writeErr) {
                        return callback(writeErr);
                    }
                    callback(null, { message: `Successfully inserted ${insertedIds.length} object(s) into table '${tableName}'.`, ids: insertedIds });
                });
            });
        });
    });
}


// Promise wrapper utility function
function promisify(fn) {
    return (...args) => {
        return new Promise((resolve, reject) => {
            // Find the callback position - it's always the last argument
            const callback = (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            };
            
            // Call the original function with the callback
            fn(...args, callback);
        });
    };
}

// Create Promise versions of all functions
const createTableAsync = promisify(createTable);
const insertTableContentAsync = promisify(insertTableContent);
const insertTableContentsAsync = promisify(insertTableContents);
const getAllAsync = promisify(getAll);
const getRowsAsync = promisify(getRows);
const updateRowAsync = promisify(updateRow);
const searchAsync = promisify(search);
const deleteRowAsync = promisify(deleteRow);
const validAsync = promisify(valid);
const clearTableAsync = promisify(clearTable);
const getFieldAsync = promisify(getField);
const countAsync = promisify(count);
const tableExistsAsync = promisify(tableExists);

// Export the public available functions
module.exports = {
    // Legacy callback-based API (maintained for backward compatibility)
    createTable,
    insertTableContent,
    getAll,
    getRows,
    updateRow,
    search,
    deleteRow,
    valid,
    clearTable,
    getField,
    count,
    tableExists,
    insertTableContents,
    
    // Modern Promise-based API
    createTableAsync,
    insertTableContentAsync,
    insertTableContentsAsync,
    getAllAsync,
    getRowsAsync,
    updateRowAsync,
    searchAsync,
    deleteRowAsync,
    validAsync,
    clearTableAsync,
    getFieldAsync,
    countAsync,
    tableExistsAsync,
    
    // Utility functions
    _getInternals: () => ({ userData }), // Added for testing
    promisify // Export promisify for users who want to wrap other functions
};
