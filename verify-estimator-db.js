const mysql = require('mysql2/promise');

async function verifyEstimatorTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    console.log('\n========== VERIFYING ESTIMATOR TABLES ==========\n');
    
    const tables = [
      'master_disciplines',
      'master_sub_disciplines', 
      'master_materials',
      'master_labor',
      'master_equipment',
      'ahsp_headers',
      'ahsp_items',
      'ahsp_sub_discipline_map',
      'proposals',
      'proposal_items',
      'proposal_audit_logs'
    ];
    
    for (const table of tables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        const [count] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`✅ ${table.padEnd(30)} - ${count[0].total} rows`);
      } else {
        console.log(`❌ ${table.padEnd(30)} - NOT FOUND`);
      }
    }
    
    console.log('\n========== SAMPLE DATA CHECK ==========\n');
    
    const [disciplines] = await connection.query('SELECT code, name FROM master_disciplines ORDER BY order_no');
    console.log('Disciplines:', disciplines.length);
    disciplines.forEach(d => console.log(`  - ${d.code}: ${d.name}`));
    
    const [labor] = await connection.query('SELECT code, name, harga FROM master_labor LIMIT 5');
    console.log('\nLabor (sample 5):', labor.length);
    labor.forEach(l => console.log(`  - ${l.code}: ${l.name} - Rp ${l.harga.toLocaleString()}`));
    
    const [materials] = await connection.query('SELECT code, name, harga FROM master_materials LIMIT 5');
    console.log('\nMaterials (sample 5):', materials.length);
    materials.forEach(m => console.log(`  - ${m.code}: ${m.name} - Rp ${m.harga.toLocaleString()}`));
    
    const [ahsp] = await connection.query('SELECT kode, name FROM ahsp_headers LIMIT 5');
    console.log('\nAHSP (sample 5):', ahsp.length);
    ahsp.forEach(a => console.log(`  - ${a.kode}: ${a.name}`));
    
    console.log('\n✅ Estimator module database is ready!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

verifyEstimatorTables();
