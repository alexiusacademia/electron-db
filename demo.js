#!/usr/bin/env node

/**
 * electron-db v1.0.0 Demo
 * Showcasing both legacy callback and modern Promise/async-await APIs
 */

const db = require('./index');
const path = require('path');

// Demo location
const DEMO_DIR = path.join(__dirname, 'demo_data');

console.log('🚀 electron-db v1.0.0 Demo\n');

async function modernDemo() {
    console.log('=== Modern Promise/Async-Await API ===\n');
    
    try {
        // Create table
        console.log('1. Creating table...');
        const createMsg = await db.createTableAsync('users', DEMO_DIR);
        console.log('   ✅', createMsg);

        // Insert data
        console.log('\n2. Inserting users...');
        const user1 = await db.insertTableContentAsync('users', DEMO_DIR, {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            role: 'developer'
        });
        console.log('   ✅', user1.message, `(ID: ${user1.id})`);

        const user2 = await db.insertTableContentAsync('users', DEMO_DIR, {
            name: 'Bob Smith',
            email: 'bob@example.com',
            role: 'designer'
        });
        console.log('   ✅', user2.message, `(ID: ${user2.id})`);

        // Get all users
        console.log('\n3. Getting all users...');
        const allUsers = await db.getAllAsync('users', DEMO_DIR);
        console.log('   📊 Found', allUsers.length, 'users:');
        allUsers.forEach(user => {
            console.log(`      - ${user.name} (${user.email}) - ${user.role}`);
        });

        // Search users
        console.log('\n4. Searching for developers...');
        const developers = await db.getRowsAsync('users', DEMO_DIR, { role: 'developer' });
        console.log('   🔍 Found', developers.length, 'developer(s):');
        developers.forEach(dev => {
            console.log(`      - ${dev.name}`);
        });

        // Update user
        console.log('\n5. Promoting Alice to senior developer...');
        const updateResult = await db.updateRowAsync('users', DEMO_DIR, 
            { name: 'Alice Johnson' }, 
            { role: 'senior developer' }
        );
        console.log('   ✅', updateResult.message);

        // Count users
        console.log('\n6. Counting total users...');
        const count = await db.countAsync('users', DEMO_DIR);
        console.log('   📊 Total users:', count);

        // Get specific field
        console.log('\n7. Getting all user names...');
        const names = await db.getFieldAsync('users', DEMO_DIR, 'name');
        console.log('   👥 Names:', names.join(', '));

        console.log('\n✨ Modern API demo completed successfully!\n');

    } catch (error) {
        console.error('❌ Error in modern demo:', error.message);
    }
}

function legacyDemo() {
    console.log('=== Legacy Callback API (Still Supported!) ===\n');
    
    return new Promise((resolve, reject) => {
        console.log('1. Creating products table...');
        db.createTable('products', DEMO_DIR, (err, msg) => {
            if (err) {
                console.error('❌ Error creating table:', err.message);
                return reject(err);
            }
            console.log('   ✅', msg);

            console.log('\n2. Inserting product...');
            db.insertTableContent('products', DEMO_DIR, {
                name: 'Awesome Widget',
                price: 29.99,
                category: 'gadgets'
            }, (err, result) => {
                if (err) {
                    console.error('❌ Error inserting product:', err.message);
                    return reject(err);
                }
                console.log('   ✅', result.message, `(ID: ${result.id})`);

                console.log('\n3. Getting all products...');
                db.getAll('products', DEMO_DIR, (err, products) => {
                    if (err) {
                        console.error('❌ Error getting products:', err.message);
                        return reject(err);
                    }
                    console.log('   📊 Found', products.length, 'product(s):');
                    products.forEach(product => {
                        console.log(`      - ${product.name}: $${product.price}`);
                    });

                    console.log('\n✨ Legacy API demo completed successfully!\n');
                    resolve();
                });
            });
        });
    });
}

async function demonstratePromisifyUtility() {
    console.log('=== Promisify Utility Demo ===\n');
    
    try {
        // Show how users can promisify any callback function
        console.log('1. Using promisify utility to convert callback to Promise...');
        const promisifiedSearch = db.promisify(db.search);
        
        const searchResults = await promisifiedSearch('users', DEMO_DIR, 'name', 'Alice');
        console.log('   🔍 Search results for "Alice":');
        searchResults.forEach(user => {
            console.log(`      - ${user.name} (${user.email})`);
        });

        console.log('\n✨ Promisify utility demo completed!\n');
    } catch (error) {
        console.error('❌ Error in promisify demo:', error.message);
    }
}

async function cleanup() {
    console.log('🧹 Cleaning up demo data...');
    try {
        await db.clearTableAsync('users', DEMO_DIR);
        await db.clearTableAsync('products', DEMO_DIR);
        console.log('   ✅ Demo data cleared\n');
    } catch (error) {
        console.log('   ⚠️  Cleanup note:', error.message);
    }
}

// Run the complete demo
async function runDemo() {
    try {
        await modernDemo();
        await legacyDemo();
        await demonstratePromisifyUtility();
        await cleanup();
        
        console.log('🎉 Demo completed successfully!');
        console.log('📚 Check out the README.md for more examples and documentation.');
        console.log('🔗 GitHub: https://github.com/alexiusacademia/electron-db');
        
    } catch (error) {
        console.error('💥 Demo failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runDemo();
}

module.exports = { runDemo };