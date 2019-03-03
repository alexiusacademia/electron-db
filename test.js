const db = require('./index');


/*db.createTable('test', (success, data) => {
  if (success) {
    console.log(data);
  } else {
    console.log('Error creating table.');
  }
});*/

db.getAll('test', (succ, data) => {
  if (succ) {
    console.log(data);
  } else {
    console.log('The table test does not exist!');
  }
});