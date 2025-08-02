# electron-db
---
[![Build Status](https://travis-ci.org/alexiusacademia/electron-db.svg?branch=master)](https://travis-ci.org/alexiusacademia/electron-db)
[![NPM version](https://img.shields.io/npm/v/electron-db.svg)](https://npmjs.org/package/electron-db "View this project on NPM")
[![NPM downloads](https://img.shields.io/npm/dm/electron-db.svg)](https://npmjs.org/package/electron-db "View this project on NPM")
> Modern flat file database solution for Electron and Node.js applications.

**electron-db** is a lightweight npm library that provides a simple database-like API for JSON file operations. Now with **Promise/async-await support** alongside the original callback API for maximum compatibility and modern development practices.

The json file is saved on the application folder or you can specify the location for the database to be created. From version 0.10.0, the user has the option to save the database table anywhere they chose.

The only difference with the default location is that, the user have to pass the string location as the second argument to any function to be used (this is optional if you want to control the database location).

The table format contained in the `table_name.json` should be in the form of
```
{
  "table_name": [
    {
      "field1": "Value of field 1",
      "field2": "Value of field 2",
      ...
    }
  ]
}
```

**Important:** The script that uses this library should be run with electron command first in order to create the directory on the user data folder (when not using a custom directory for the database). The name that will be used for the app directory will be what was indicated in the `package.json` as <em>name</em>. If this is not set, the <em>name</em> property will be used.

### **Installation**
The preferred way of installation is to install it locally on the application.
```javascript
npm install electron-db --save
```

## **API Styles**

**electron-db** supports both traditional callback-style and modern Promise/async-await APIs:

### **Callback Style (Legacy)**
```javascript
const db = require('electron-db');

db.createTable('customers', (err, msg) => {
  if (err) console.error(err);
  else console.log(msg);
});
```

### **Promise/Async Style (Modern)**
```javascript
const db = require('electron-db');

// Using Promises
db.createTableAsync('customers')
  .then(msg => console.log(msg))
  .catch(err => console.error(err));

// Using async/await (recommended)
async function createCustomersTable() {
  try {
    const msg = await db.createTableAsync('customers');
    console.log(msg);
  } catch (err) {
    console.error(err);
  }
}
```

### **Creating Table**
Creates a json file `[table-name].json` inside the application `userData` folder.

In Windows, the application folder should be in `C:\Users\[username]\AppData\Roaming\[application name]`

#### **Callback Style**
```javascript
const db = require('electron-db');
const { app, BrowserWindow } = require("electron");

db.createTable('customers', (err, msg) => {
  if (err) {
    console.error("Error:", err.message);
  } else {
    console.log("Message:", msg);
  }
})

/*
	Output:
        Message: Table 'customers' created successfully at [path].

	Result file (customers.json):
    {
    	"customers": []
    }
*/
```

#### **Modern Async Style**
```javascript
const db = require('electron-db');
const { app, BrowserWindow } = require("electron");

async function setupDatabase() {
  try {
    const msg = await db.createTableAsync('customers');
    console.log("Message:", msg);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

setupDatabase();
```

### **Creating Table specifying the Location**
The custom location, if desired, shall be passed as the second argument and the remaining arguments are the same (if any) on a specific function.
```javascript
const path = require('path')

// This will save the database in the same directory as the application.
const location = path.join(__dirname, '')

db.createTable('customers', location, (succ, msg) => {
  // succ - boolean, tells if the call is successful
  if (succ) {
    console.log(msg)
  } else {
    console.log('An error has occured. ' + msg)
  }
})
```

### **Inserting Object/Data to Table**
Insert an object into the list of row/data of the table.

To insert to a custom location, pass the custom location as the second argument
as shown in the sample above. But do not forget to check if the database is valid.

#### **Callback Style**
```javascript
let obj = {
  name: "Alexius Academia",
  address: "Paco, Botolan, Zambales"
};

db.valid('customers', (err, isValid) => {
  if (err) {
    console.error("Error:", err.message);
  } else if (isValid) {
    db.insertTableContent('customers', obj, (err, msg) => {
      if (err) {
        console.error("Error:", err.message);
      } else {
        console.log("Message:", msg);
      }
    });
  }
});
```

#### **Modern Async Style**
```javascript
const obj = {
  name: "Alexius Academia",
  address: "Paco, Botolan, Zambales"
};

async function insertCustomer() {
  try {
    const isValid = await db.validAsync('customers');
    if (isValid) {
      const msg = await db.insertTableContentAsync('customers', obj);
      console.log("Message:", msg);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

insertCustomer();

/*
	Output:
        Message: Object written successfully!

    Result file (customers.json):
    {
      "customers": [
        {
          "name": "Alexius Academia",
          "address": "Paco, Botolan, Zambales",
          "id": 1640995200000
        }
      ]
    }
*/
```

### For the database table at custom location
For the implementation of this new feature, always put the location string as second argument for all the functions. (The directory string must end with appropriate slashes, forward slash for unix and back slash with escape string for Windows) (e.g. Windows: ```'C:\\databases\\'```, Unix: ```'/Users/<username>/Desktop/'```). For good practice, use the ```path.join``` method to let the OS apply its directory separator automatically.

<!--
### **Inserting Multiple Objects/Data to Table**
Insert multiple objects into the list of row/data of the table.

```javascript
const db = require('electron-db');

const arr = ['product_1', 'product_2', 'product_3', 'product_4', 'product_5'];

const m = arr.map((product, id) => {
  const obj = {}
  obj.image_name = product;
  obj.index = id;

  return obj;
});

db.insertTableContents('records', m, (isSuccess, message) => {
  console.log(isSuccess);
  console.log(message);
});

/*
	Output:
    	true
      Object written successfully!
      true
      Object written successfully!
      true
      Object written successfully!
      true
      Object written successfully!
      true
      Object written successfully!
*/
```
-->
### **Get all rows**
Get all the rows for a given table.

#### **Callback Style**
```javascript
const db = require('electron-db');

db.getAll('customers', (err, data) => {
  if (err) {
    console.error("Error:", err.message);
  } else {
    console.log("Data:", data);
    // data - array of objects that represents the rows.
  }
});
```

#### **Modern Async Style**
```javascript
const db = require('electron-db');

async function getAllCustomers() {
  try {
    const data = await db.getAllAsync('customers');
    console.log("Data:", data);
    // data - array of objects that represents the rows.
  } catch (err) {
    console.error("Error:", err.message);
  }
}

getAllCustomers();
```
### **Get Row(s) from the table**
Get row or rows that matched the given condition(s) in WHERE argument

```javascript
const db = require('electron-db');
const electron = require('electron');

const app = electron.app || electron.remote.app;

db.getRows('customers', {
  address: "Paco, Botolan, Zambales",
  name: 'Alexius Academia'
}, (succ, result) => {
  // succ - boolean, tells if the call is successful
  console.log("Success: " + succ);
  console.log(result);
})

/*
	Output:
    	Success: true
        [ { name: 'Alexius Academia',
    address: 'Paco, Botolan, Zambales',
    id: 1508419374272 } ]
*/
```

### **Update Row**
Updates a specific row or rows from a table/json file using a WHERE clause.

```javascript
const db = require('electron-db');
const electron = require('electron');

const app = electron.app || electron.remote.app;

let where = {
  "name": "Alexius Academia"
};

let set = {
  "address": "Paco, Botolan, Zambales"
}

db.updateRow('customers', where, set, (succ, msg) => {
  // succ - boolean, tells if the call is successful
  console.log("Success: " + succ);
  console.log("Message: " + msg);
});
```

### **Search Records**
Search a specific record with a given key/field of the table. This method can search part of a string from a value.

In this example, I have a table named 'customers', each row has a 'name' property. We are now trying to search for a name in the rows that has the substring 'oh' in it.

```javascript
const db = require('electron-db');
const electron = require('electron');

const app = electron.app || electron.remote.app;

let term = "oh";

db.search('customers', 'name', term, (succ, data) => {
  if (succ) {
    console.log(data);
  }
});

// Output
/*
[ { name: 'John John Academia',
    address: 'Paco, Botolan, Zambales',
    id: 1508419430491 } ]
*/
```

### **Delete Records**
Delete a specific record with a given key-value pair from the table.

```javascript

const db = require('electron-db');
const electron = require('electron');

db.deleteRow('customers', {'id': 1508419374272}, (succ, msg) => {
  console.log(msg);
});

```

### **Get data for specific field**
Get all the field given in a specific key.
This will return all values on each row that has the key given in the parameter.
```javascript
const key = 'name'

db.getField(dbName, dbLocation, key, (succ, data) => {
    if (succ) {
      console.log(data)
    }
})
```

### **Clear all Records**
Clear all the records in the specified table.
```javascript
// Delete all the data
db.clearTable(dbName, dbLocation, (succ, msg) => {
    if (succ) {
        console.log(msg)

        // Show the content now
        db.getAll(dbName, dbLocation, (succ, data) => {
            if (succ) {
                console.log(data);
            }
        });
    }
})
```

### **Count Records**
Count the number of rows for a given table.
```
db.count(dbName, dbLocation, (succ, data) => {
    if (succ) {
        console.log(data)
    } else {
        console.log('An error has occured.')
        console.log(data)
    }
})
```

## **TypeScript Support**

**electron-db** now includes TypeScript definitions! You get full type safety and IntelliSense support:

```typescript
import * as db from 'electron-db';
// or: const db = require('electron-db');

interface Customer {
  name: string;
  address: string;
  id?: number;
}

async function manageCustomers() {
  // TypeScript will provide full type checking and autocomplete
  await db.createTableAsync('customers');
  
  const customer: Customer = {
    name: "John Doe",
    address: "123 Main St"
  };
  
  await db.insertTableContentAsync('customers', customer);
  const customers: Customer[] = await db.getAllAsync('customers');
  
  console.log(customers);
}
```

## **Migration Guide**

### **From v0.x to v1.0**

**Good news!** Your existing code will continue to work unchanged. All callback-based functions are still available and fully supported.

To modernize your code:

1. **Add `Async` suffix** to function names for Promise versions:
   ```javascript
   // Old (still works)
   db.getAll('table', (err, data) => { ... });
   
   // New (recommended)
   const data = await db.getAllAsync('table');
   ```

2. **Update error handling**:
   ```javascript
   // Old
   db.createTable('table', (err, msg) => {
     if (err) console.error(err);
     else console.log(msg);
   });
   
   // New
   try {
     const msg = await db.createTableAsync('table');
     console.log(msg);
   } catch (err) {
     console.error(err);
   }
   ```

3. **Use modern JavaScript features**:
   - `const`/`let` instead of `var`
   - `async`/`await` instead of callbacks
   - Template literals instead of string concatenation

## **Performance Notes**

- All file operations are now asynchronous by default in the Promise API
- Backward compatibility is maintained for callback-based functions
- Consider using the `promisify` utility for custom callback functions

## **Requirements**

- **Node.js**: 14.0.0 or higher
- **Electron**: All versions supported
- **TypeScript**: 3.7+ (if using TypeScript)

For contributions, please see the `CONTRIBUTE.md` file. Thank you.
