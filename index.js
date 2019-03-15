// Load required modules
const jsonfile = require('jsonfile');
// const electron = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// const app = electron.app || electron.remote.app;
// const userData = app.getPath('userData');

const platform = os.platform();

let appName = '';
if (JSON.parse(fs.readFileSync('package.json', 'utf-8')).productName) {
  appName = JSON.parse(fs.readFileSync('package.json', 'utf-8')).productName;
}else{
  appName = JSON.parse(fs.readFileSync('package.json', 'utf-8')).name;
}

let userData = '';

if (platform === 'win32') {
  userData = path.join(process.env.APPDATA, appName);
} else if (platform === 'darwin') {
  userData = path.join(process.env.HOME, 'Library', 'Application Support', appName);
} else {
  userData = path.join('var', 'local', appName);
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
function createTable() {
  tableName = arguments[0];
  var fname = '';
  var callback;
  if (arguments.length === 2){
    
    callback = arguments[1];
    fname = path.join(userData, tableName + '.json');
  } else if (arguments.length === 3) {
    fname = arguments[1] + arguments[0] + '.json';
    callback = arguments[2];
  }

  // Check if the file with the tablename.json exists
  let exists = fs.existsSync(fname);

  if (exists) {
    // The file exists, do not recreate the table/json file
    callback(false, tableName + '.json already exists!');
    return;
  }else{
    // Create an empty object and pass an empty array as value
    let obj = new Object();
    obj[tableName] = [];

    // Write the object to json file
    try {
      jsonfile.writeFileSync(fname, obj, {spaces: 2}, function (err){
        // console.log(err);
      });
      callback(true, "Success!")
      return;
    } catch (e) {
      callback(false, e.toString());
    }

  }
}

/**
 * Insert object to table. The object will be appended with the property, id
 * which uses timestamp as value.
 * There are 3 required arguments.
 * @param  {string} arguments[0]  [Table name]
 * @param  {string} arguments[1] [Location of the database file] (Optional)
 * @param  {string} arguments[2] [Row object]
 * @param  {Function} arguments[3] [Callback function]
 */
// function insertTableContent(tableName, tableRow, callback) {
function insertTableContent() {
  let tableName = arguments[0];
  var fname = '';
  var callback;
  var tableRow;
  if (arguments.length === 3) {
    callback = arguments[2];
    fname = path.join(userData, arguments[0] + '.json');
    tableRow = arguments[1];
  } else if (arguments.length === 4) {
    fname = arguments[1] + arguments[0] + '.json';
    callback = arguments[3];
    tableRow = arguments[2];
  }

  let exists = fs.existsSync(fname);

  if (exists) {
    // Table | json parsed
    let table = JSON.parse(fs.readFileSync(fname));

    let date = new Date();
    let id = date.getTime();
    tableRow['id'] = id;

    table[tableName].push(tableRow);

    try {
      jsonfile.writeFileSync(fname, table, {spaces: 2}, function (err){
        // console.log("Error: " + err);
      });
      callback(true, "Object written successfully!");
      return;
    } catch (e) {
      callback(false, "Error writing object.");
      return;
    }
  }
  callback(false, "Table/json file doesn't exist!");
  return;
}

/**
 * Get all contents of the table/json file object
 * @param  {string} arguments[0] [Table name]
 * @param  {string} arguments[1] [Location of the database file] (Optional)
 * @param  {Function} arguments[2]  [callback function]
 */
// function getAll(tableName, callback) {
function getAll() {
  var fname = '';
  var callback;
  var tableName = arguments[0];

  if (arguments.length === 2) {
    fname = path.join(userData, tableName + '.json');
    callback = arguments[1];
  } else if (arguments.length === 3) {
    fname = arguments[1] + arguments[0] + '.json';
    callback = arguments[2];
  }

  let exists = fs.existsSync(fname);

  if (exists) {
    try {
      let table = JSON.parse(fs.readFileSync(fname));
      callback(true, table[tableName]);
      return;
    } catch (e) {
      callback(false, []);
      return;
    }
  } else {
    callback(false, 'Table file does not exist!');
    return;
  }
}

/**
 * Get row or rows that matched the given condition(s) in WHERE argument
 * @param {string} arguments[0] Table name
 * @param {string} arguments[1] [Location of the database file] (Optional)
 * @param {object} arguments[2] Collection of conditions to be met
 * @param {callback} arguments[3] Function callback
 */
// function getRows(tableName, where, callback) {
function getRows() {

  let tableName = arguments[0];
  var fname = '';
  var callback;
  var where;

  if (arguments.length === 3) {
    fname = path.join(userData, tableName + '.json');
    where = arguments[1];
    callback = arguments[2];
  } else if (arguments.length === 4) {
    fname = arguments[1] + arguments[0] + '.json';
    where = arguments[2];
    callback = arguments[3];
  }

  let exists = fs.existsSync(fname);
  let whereKeys;

  // Check if where is an object
  if (Object.prototype.toString.call(where) === "[object Object]" ) {
    // Check for number of keys
    whereKeys = Object.keys(where);
    if (whereKeys === 0) {
      callback(false, "There are no conditions passed to the WHERE clause.");
      return;
    }
  } else {
    callback(false, "WHERE clause should be an object.");
    return;
  }

  // Check if the json file exists, if it is, parse it.
  if (exists) {
    try {
      let table = JSON.parse(fs.readFileSync(fname));
      let rows = table[tableName];

      let objs = [];

      for (let i = 0; i < rows.length; i++) {
        let matched = 0;    // Number of matched complete where clause
        for (var j = 0; j < whereKeys.length; j++) {
          // Test if there is a matched key with where clause
          if (rows[i].hasOwnProperty(whereKeys[j])) {
            if (rows[i][whereKeys[j]] === where[whereKeys[j]]) {
              matched++;
            }
          }
        }

        // Check if all conditions in the WHERE clause are matched
        if (matched === whereKeys.length) {
          objs.push(rows[i])
        }
      }

      callback(true, objs);
      return;
    }catch (e) {
      callback(false, e.toString());
      return;
    }
  } else {
    callback(false, 'Table file does not exist!');
    return;
  }
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
function updateRow() {
  let tableName = arguments[0];
  var fname = '';
  var where;
  var set;
  var callback;

  if (arguments.length === 4) {
    fname = path.join(userData, tableName + '.json');
    where = arguments[1];
    set = arguments[2];
    callback = arguments[3];
  } else if (arguments.length === 5) {
    fname = arguments[1] + arguments[0] + '.json';
    where = arguments[2];
    set = arguments[3];
    callback = arguments[4];
  }

  let exists = fs.existsSync(fname);

  let whereKeys = Object.keys(where);
  let setKeys = Object.keys(set);

  if (exists) {
    let table = JSON.parse(fs.readFileSync(fname));
    let rows = table[tableName];

    let matched = 0;    // Number of matched complete where clause
    let matchedIndex = 0;

    for (var i = 0; i < rows.length; i++) {
      
      for (var j = 0; j < whereKeys.length; j++) {
        // Test if there is a matched key with where clause and single row of table
        if (rows[i].hasOwnProperty(whereKeys[j])) {
          if (rows[i][whereKeys[j]] === where[whereKeys[j]]) {
            matched++;
            matchedIndex = i;
          }
        }
      }
    }

    if (matched === whereKeys.length) {
      // All field from where clause are present in this particular
      // row of the database table
      try {
        for (var k = 0; k < setKeys.length; k++) {
          // rows[i][setKeys[k]] = set[setKeys[k]];
          rows[matchedIndex][setKeys[k]] = set[setKeys[k]];
        }

        // Create a new object and pass the rows
        let obj = new Object();
        obj[tableName] = rows;

        // Write the object to json file
        try {
          jsonfile.writeFileSync(fname, obj, {spaces: 2}, function (err){
            console.log(err);
          });
          callback(true, "Success!")
          return;
        } catch (e) {
          callback(false, e.toString());
          return;
        }

        callback(true, rows);
      } catch (e) {
        callback(false, e.toString());
        return;
      }
    } else {
      callback(false, "Cannot find the specified record.");
      return;
    }


  } else {
    callback(false, 'Table file does not exist!');
    return;
  }
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
function search() {

  let tableName = arguments[0];
  var fname = '';
  var field;
  var keyword;
  var callback;

  if (arguments.length === 4) {
    fname = path.join(userData, tableName + '.json');
    field = arguments[1];
    keyword = arguments[2];
    callback = arguments[3];
  } else if (arguments.length === 5) {
    fname = arguments[1] + arguments[0] + '.json';
    field = arguments[2];
    keyword = arguments[3];
    callback = arguments[4];
  }

  let exists = fs.existsSync(fname);

  if (exists) {
    let table = JSON.parse(fs.readFileSync(fname));
    let rows = table[tableName];
    
    if (rows.length > 0) {

      // Declare an empty list
      let foundRows = [];

      for (var i = 0; i < rows.length; i++) {
        // Check if key exists
        if (rows[i].hasOwnProperty(field)) {
          // Make sure that an object is converted to string before
          // applying toLowerCase()
          let value = rows[i][field].toString().toLowerCase();
          let n = value.search(keyword.toString().toLowerCase());

          if (n !== -1) {
            // The substring is found, add object to the list.
            foundRows.push(rows[i]);
          }

        }else{
          callback(false, 2);
          return;
        }
      }

      callback(true, foundRows);
      return;

    } else {
      callback(false, []);
      return;
    }
  } else {
    callback(false, 'Table file does not exist!');
    return;
  }
}

/**
 * Delete a row specified.
 * @param {*} tableName 
 * @param {string} arguments[1] [Location of the database file] (Optional)
 * @param {*} where 
 * @param {*} callback 
 */
// function deleteRow(tableName, where, callback) {
function deleteRow() {
  let tableName = arguments[0];

  var fname = '';
  var where;
  var callback;

  if (arguments.length === 3) {
    fname = path.join(userData, tableName + '.json');
    where = arguments[1];
    callback = arguments[2];
  } else if (arguments.length === 4) {
    fname = arguments[1] + arguments[0] + '.json';
    where = arguments[2];
    callback = arguments[3];
  }

  let exists = fs.existsSync(fname);

  let whereKeys = Object.keys(where);

  if (exists) {
    let table = JSON.parse(fs.readFileSync(fname));
    let rows = table[tableName];

    if (rows.length > 0) {
      let matched = 0;
      let matchedIndices = [];
      
      for (let i = 0; i < rows.length; i++) {
        // Iterate throught the rows
        for (var j = 0; j < whereKeys.length; j++) {
          // Test if there is a matched key with where clause and single row of table
          if (rows[i].hasOwnProperty(whereKeys[j])) {
            if (rows[i][whereKeys[j]] === where[whereKeys[j]]) {
              matched++;
              matchedIndices.push(i);
            }
          }
        }
      }

      if (matchedIndices.length === 0) {
        callback(false, 'Row does not exist!');
        return;
      }

      for (let k = 0; k < matchedIndices.length; k++) {
        rows.splice(matchedIndices[k], 1);
      }

      // Create a new object and pass the rows
      let obj = new Object();
      obj[tableName] = rows;

      // Write the object to json file
      try {
        jsonfile.writeFileSync(fname, obj, {spaces: 2}, function (err){

        });
        callback(true, "Row(s) deleted successfully!")
        return;
      } catch (e) {
        callback(false, e.toString());
        return;
      }

    } else {
      callback(false, 'Table is empty!');
      return;
    }
  } else {
    callback(false, 'Table file does not exist!');
    return;
  }

}

// Export the public available functions
module.exports = {
  createTable,
  insertTableContent,
  getAll,
  getRows,
  updateRow,
  search,
  deleteRow
};
