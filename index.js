const jsonfile = require('jsonfile');
const electron = require('electron');
const app = electron.app || electron.remote.app;
const path = require('path');
const userData = app.getPath('userData');

function createFile(f) {
  let fname = path.join(userData, f + '.json');
  var obj = {
    name: 'alex'
  };

  jsonfile.writeFile(fname, obj, function (err){
    console.log(err);
  });
}

module.exports = {
  createFile
};
