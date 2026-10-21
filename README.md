# electron-db
---
[![NPM version](https://img.shields.io/npm/v/electron-db.svg)](https://npmjs.org/package/electron-db "View this project on NPM")
[![NPM downloads](https://img.shields.io/npm/dm/electron-db.svg)](https://npmjs.org/package/electron-db "View this project on NPM")
> Flat file database solution for electron and other Nodejs apps.

**electron-db** is an npm library that let you simplify database creation and operation on a json file.

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

**Important:** When no location is given, tables are stored in the app's folder inside the OS user data directory (for example `C:\Users\[username]\AppData\Roaming\[app name]` on Windows and `~/Library/Application Support/[app name]` on macOS). The folder name is the `productName` in your app's `package.json`, or its `name` when there is no `productName`.

**Main process only:** electron-db reads and writes files with Node's `fs` module, so call it from Electron's main process (or a renderer with Node integration). Calling it from a renderer without Node integration fails with `fs.existsSync is not a function`; in that case, run the database calls in the main process and reach them through IPC.

### **Installation**
The preferred way of installation is to install it locally on the application.
```javascript
npm install electron-db --save
```

### **Callbacks**
Every function except `valid` and `tableExists` reports its result through a callback with two arguments:

- `succ` – boolean, `true` when the call worked.
- `msg` / `data` – the result (rows, values, a count) on success, or a message explaining the failure.

Some functions pass a third argument with extra data; see the [API reference](#api-reference).

All calls finish before they return, so the callback has already run when the function returns.

### **Creating Table**
Creates a json file `[table-name].json` inside the application `userData` folder.

```javascript

const db = require('electron-db');
const { app, BrowserWindow } = require("electron");

db.createTable('customers', (succ, msg) => {
  // succ - boolean, tells if the call is successful
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

### **Creating Table specifying the Location**
The custom location, if desired, shall be passed as the second argument and the remaining arguments are the same (if any) on a specific function. The folder is created if it does not exist.
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
Insert an object into the list of row/data of the table. A row without an `id` gets a timestamp `id`. The new id is passed to the callback as the third argument, returned by the function, and also set on the object you passed.

To insert to a custom location, pass the custom location as the second argument
as shown in the sample above. But do not forget to check if the database is valid.

```javascript
let obj = new Object();

obj.name = "Alexius Academia";
obj.address = "Paco, Botolan, Zambales";

if (db.valid('customers')) {
  db.insertTableContent('customers', obj, (succ, msg, id) => {
    // succ - boolean, tells if the call is successful
    console.log("Success: " + succ);
    console.log("Message: " + msg);
    console.log("New id: " + id);
  })
}

/*
	Output:
    	Success: true
        Message: Object written successfully!
        New id: 1508419374272

    Result file (customers.json):
    {
      "customers": [
        {
          "name": "Alexius Academia",
          "address": "Paco, Botolan, Zambales",
          "id": 1508419374272
        }
      ]
    }

*/
```

### For the database table at custom location
For the implementation of this new feature, always put the location string as second argument for all the functions. (The directory string must end with appropriate slashes, forward slash for unix and back slash with escape string for Windows) (e.g. Windows: ```'C:\\databases\\'```, Unix: ```'/Users/<username>/Desktop/'```). For good practice, use the ```path.join``` method to let the OS apply its directory separator automatically.

### **Inserting Multiple Objects/Data to Table**
Insert several objects with one write. The callback gets the list of new ids.

```javascript
const products = ['product_1', 'product_2', 'product_3'].map((name, index) => ({
  image_name: name,
  index: index
}));

db.insertTableContents('records', products, (succ, msg, ids) => {
  console.log(succ);   // true
  console.log(msg);    // Objects written successfully!
  console.log(ids);    // [ 1508419374272, 1508419374273, 1508419374274 ]
});
```

### **Inserting with a Unique Check**
Refuse the insert when a field already has the same value in another row, like a `UNIQUE` constraint in SQL. Pass one field name or a list of them.

```javascript
let obj = {
  name: "Alexius Academia",
  email: "alexius@example.com"
};

db.insertWithUniqueCheck('customers', obj, ['email'], (succ, msg, id) => {
  console.log("Success: " + succ);
  console.log("Message: " + msg);
});

/*
	Output when the email is already used:
    	Success: false
        Message: UNIQUE constraint violation: another row already has this value for 'email'.
*/
```

### **Get all rows**
Get all the rows for a given table by using the callback function.
```javascript

const db = require('electron-db');

db.getAll('customers', (succ, data) => {
  // succ - boolean, tells if the call is successful
  // data - array of objects that represents the rows.
})
```
### **Get Row(s) from the table**
Get row or rows that matched the given condition(s) in WHERE argument. A row must meet every condition.

```javascript
const db = require('electron-db');

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

### **Conditions with Functions**
A condition in a WHERE clause can be a function instead of a value. It receives the row's value for that field (and the whole row as the second argument) and returns `true` to accept the row. This works in `getRows`, `updateRow` and `deleteRow`.

```javascript
db.getRows('customers', {
  age: (age) => age >= 18,
  name: (name) => name.startsWith('A')
}, (succ, result) => {
  console.log(result);
});
```

### **Update Row**
Updates every row of a table/json file that meets the WHERE clause. The number of updated rows is passed as the third argument.

```javascript
const db = require('electron-db');

let where = {
  "name": "Alexius Academia"
};

let set = {
  "address": "Paco, Botolan, Zambales"
}

db.updateRow('customers', where, set, (succ, msg, count) => {
  // succ - boolean, tells if the call is successful
  console.log("Success: " + succ);
  console.log("Message: " + msg);
  console.log("Rows updated: " + count);
});
```

To keep fields unique during an update, use `updateWithUniqueCheck` and pass the unique fields after the SET clause:

```javascript
db.updateWithUniqueCheck('customers', { name: 'Alexius Academia' }, { email: 'new@example.com' }, ['email'], (succ, msg, count) => {
  console.log(succ, msg);
});
```

### **Search Records**
Search a specific record with a given key/field of the table. This method can search part of a string from a value. The search ignores letter case, and rows without the field are skipped.

In this example, I have a table named 'customers', each row has a 'name' property. We are now trying to search for a name in the rows that has the substring 'oh' in it.

```javascript
const db = require('electron-db');

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
Delete every row that meets the WHERE clause. The number of deleted rows is passed as the third argument.

```javascript

const db = require('electron-db');

db.deleteRow('customers', {'id': 1508419374272}, (succ, msg, count) => {
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
```javascript
db.count(dbName, dbLocation, (succ, data) => {
    if (succ) {
        console.log(data)
    } else {
        console.log('An error has occured.')
        console.log(data)
    }
})
```

### **Check a Table**
`valid` and `tableExists` return a boolean directly instead of using a callback.
```javascript
db.tableExists('customers');          // true when customers.json exists
db.valid('customers', dbLocation);    // true when it exists and holds valid JSON
```

## API reference

`[location]` is always optional: leave it out to use the default folder. A WHERE clause is an object of `field: value` pairs; a value may be a function `(value, row) => boolean`. An empty WHERE clause is refused.

| Function | Arguments | Callback / return |
|---|---|---|
| `createTable` | `tableName, [location], callback` | `(succ, msg)` |
| `valid` | `tableName, [location]` | returns `true` when the file exists and holds valid JSON |
| `tableExists` | `tableName, [location]` | returns `true` when the file exists |
| `insertTableContent` | `tableName, [location], row, callback` | `(succ, msg, id)`; returns `id` |
| `insertTableContents` | `tableName, [location], rows, callback` | `(succ, msg, ids)`; returns `ids` |
| `insertWithUniqueCheck` | `tableName, [location], row, uniqueFields, callback` | `(succ, msg, id)`; returns `id` |
| `getAll` | `tableName, [location], callback` | `(succ, rows)` |
| `getRows` | `tableName, [location], where, callback` | `(succ, rows)` |
| `getField` | `tableName, [location], field, callback` | `(succ, values)` |
| `search` | `tableName, [location], field, keyword, callback` | `(succ, rows)` |
| `updateRow` | `tableName, [location], where, set, callback` | `(succ, msg, count)` |
| `updateWithUniqueCheck` | `tableName, [location], where, set, uniqueFields, callback` | `(succ, msg, count)` |
| `deleteRow` | `tableName, [location], where, callback` | `(succ, msg, count)` |
| `clearTable` | `tableName, [location], callback` | `(succ, msg)` |
| `count` | `tableName, [location], callback` | `(succ, count)` |

- `uniqueFields` is a field name or an array of field names. An update is refused when it would give a unique field a value another row has, or the same value to several rows.
- On failure, `succ` is `false`, the second argument is a message, and insert functions return `undefined`.

For contributions, please see the `CONTRIBUTE.md` file. Thank you.
