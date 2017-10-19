# electron-db
---

> Database-like solution in electron apps

**electron-db** is a module to have a database-like functions to simulate table manipulation on data. The data is saved as a json flat file.

[![Build Status](https://travis-ci.org/alexiusacademia/electron-db.svg?branch=master)](https://travis-ci.org/alexiusacademia/electron-db)

### **Installation**


```javascript
npm install electron-db
```

### **Creating Table**
Creates a json file [table-name].js inside the application userData folder.

```javascript
const db = require('electron-db');

db.createTable('customers', (succ, msg) => {
  console.log("Success: " + succ);
  console.log("Message: " + msg);
})

/*
	Output:
    	Success: true
        Message: Success!
        
	Result file (customers.json):
    {
    	"customers": []
    }
*/
```
### **Inserting Object/Data to Table**
Insert an object into the list of row/data of the table.

```javascript
const db = require('electron-db');
let obj = new Object();

obj.name = "Alexius Academia";
obj.address = "Paco, Botolan, Zambales";

db.insertTableContent('customers', obj, (succ, msg) => {
  console.log("Success: " + succ);
  console.log("Message: " + msg);
})

/*
	Output:
    	Success: true
        Message: Object written successfully!
       
    Result file (customers.json):
    {
      "customers": [
        {
          "name": "Alexius Academia",
          "address": "Paco, Botolan, Zambales"
        }
      ]
    }

*/
```
### **Get Row from the table**
Get a row using id.

```javascript
const db = require('electron-db');

db.getRow('customers', 1508371528701, (succ, obj) => {
  console.log("Success: " + succ);
  console.log("Message: " + obj.name);
})

/*
	Output:
    	Success: true
        Message: Alexius Academia
*/
```
