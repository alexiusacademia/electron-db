// Load required modules
const jsonfile = require('jsonfile');
const electron = require('electron');
const path = require('path');
const fs = require('fs');

const app = electron.app || electron.remote.app;
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
 * Insert object to table
 * @param  {string} tableName  [Table name]
 * @param  {string} tableField [Field name]
 * @param  {value} fieldValue [Value (string, number, list, etc.)]
 */
function insertTableContent(tableName, tableRow, callback) {
  let fname = path.join(userData, tableName + '.json');
  let exists = fs.existsSync(fname);

  if (exists) {
    // Table | json parsed
    let table = JSON.parse(fs.readFileSync(fname));

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

// Export the public available functions
module.exports = {
  createTable,
  insertTableContent
};
