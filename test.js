const db = require('./index');
const path = require('path')
const fs = require('fs')

const dbName = 'test';
const dbLocation = path.join(__dirname, 'collections/')

// Check if directory exist, create if not
if (!fs.existsSync(dbLocation)) {
    fs.mkdirSync(dbLocation)
}

// Create the table
db.createTable(dbName, dbLocation, (success, data) => {
    if (success) {
        console.log(data);
    } else {
        console.log('Error creating table. ' + data);
    }
});

// Put some dummy data
db.insertTableContent(dbName,
    dbLocation, {
        'name': 'Test.',
        'time': new Date()
    },
    (succ, msg) => {

    });

db.insertTableContent(dbName,
    dbLocation, {
        'name': 'Other test.',
        'time': new Date()
    },
    (succ, msg) => {

    });

// Get all the data
db.getAll(dbName, dbLocation, (succ, data) => {
    if (succ) {
        console.log(data);
    } else {
        console.log('The table test does not exist!');
    }
});

db.count(dbName, dbLocation, (succ, data) => {
    if (succ) {
        console.log(data)
    } else {
        console.log('An error has occured.')
        console.log(data)
    }
})

// Delete all the data
/* console.log('clearTable:')
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
}) */