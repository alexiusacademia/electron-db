// Load required modules
const jsonfile = require('jsonfile');
const electron = require('electron');
const path = require('path');
const fs = require('fs');

const app = electron.app;
const userData = app.getPath('userData');


/**
 * Create a table | a json file
 * @param  {[string]} tableName [Table name]
 */
function createTable(tableName, callback) {
  // Define the filename
  let fname = path.join(userData, tableName + '.json');

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
      jsonfile.writeFile(fname, obj, {spaces: 2}, function (err){
        console.log(err);
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
 * @param  {string} tableName  [Table name]
 * @param  {string} tableField [Field name]
 * @param  {value} fieldValue [Value (string, number, list, etc.)]
 * @param {Function} callback [Callback function]
 */
function insertTableContent(tableName, tableRow, callback) {
  let fname = path.join(userData, tableName + '.json');
  let exists = fs.existsSync(fname);

  if (exists) {
    // Table | json parsed
    let table = JSON.parse(fs.readFileSync(fname));

    let date = new Date();
    let id = date.getTime();
    tableRow['id'] = id;

    table[tableName].push(tableRow);

    try {
      jsonfile.writeFile(fname, table, {spaces: 2}, function (err){
        console.log(err);
      });
      callback(true, "Object written successfully!");
      return;
    } catch (e) {
      callback(false, "Error writing object.");
      return;
    }
  }
  callback(false, "Table/json file doesn't exist!");
}

/**
 * Get all contents of the table/json file object
 * @param  {[string]}   tableName [Table name]
 * @param  {Function} callback  [callback]
 */
function getAll(tableName, callback) {
  let fname = path.join(userData, tableName + '.json');
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
    callback(false, []);
    return;
  }
}

/**
 * Get a specific row from the table
 * @param  {[string]}   tableName [Table name]
 * @param  {[int]}   id        [id]
 * @param  {Function} callback  [Callback function]
 */
function getRow(tableName, id, callback) {
  let fname = path.join(userData, tableName + '.json');
  let exists = fs.existsSync(fname);

  // Check if the json file exists, if it is, parse it.
  if (exists) {
    try {
      let table = JSON.parse(fs.readFileSync(fname));
      let rows = table[tableName];

      // Search every row
      let counter = 0;

      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === id) {
          counter++;
          callback(true, rows[i]);
          break;
        }
      }
    } catch (e) {
        callback(false, {});
    }
  } else {
    callback(false, {});
  }
}

// Export the public available functions
module.exports = {
  createTable,
  insertTableContent,
  getAll,
  getRow
};
