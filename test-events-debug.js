const mysql = require('mysql2/promise');

async function testDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    console.log('\n=== CHECKING PRODUCTION_EVENTS TABLE ===');
    
    // Check if table exists
    const [tables] = await connection.query(`SHOW TABLES LIKE 'production_events'`);
    console.log('Table exists:', tables.length > 0);
    
    if (tables.length > 0) {
      // Get table structure
      const [columns] = await connection.query(`DESCRIBE production_events`);
      console.log('\nTable Structure:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
      
      // Count events
      const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM production_events`);
      console.log(`\nTotal Events: ${countResult[0].total}`);
      
      // Get all events
      const [events] = await connection.query(`
        SELECT id, type, title, event_date, event_time, location, created_at 
        FROM production_events 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      if (events.length > 0) {
        console.log('\nLatest Events:');
        events.forEach((event, idx) => {
          console.log(`  ${idx + 1}. [${event.type}] ${event.title}`);
          console.log(`     Date: ${event.event_date}, Time: ${event.event_time}`);
          console.log(`     Location: ${event.location}`);
          console.log(`     Created: ${event.created_at}\n`);
        });
      } else {
        console.log('\n❌ No events found in table!');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

testDatabase();
