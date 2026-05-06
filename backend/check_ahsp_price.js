const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking AHSP prices for A.1.1.1 in ' + dbPath);

db.all("SELECT id, kode, name, harga_satuan FROM ahsp_headers WHERE kode = 'A.1.1.1'", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(JSON.stringify(rows, null, 2));
});
