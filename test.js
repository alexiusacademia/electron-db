const db = require('./index.js');
const electron = require('electron');

const app = electron.app;

db.getRow('customers', 1508371528701, (succ, msg) => {
  console.log("Success: " + succ);
  console.log("Message: " + msg.name);
})
