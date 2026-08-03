const fs = require('fs');
const content = fs.readFileSync('/tmp/binlog.txt', 'utf8');
const lines = content.split('\n');
let statements = [];
let currentTable = '';
let currentFields = [];
for (let i=0; i<lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('### DELETE FROM ')) {
    currentTable = line.replace('### DELETE FROM ', '').trim().replace(/`/g, '');
    currentFields = [];
    continue;
  }
  if (currentTable && line.startsWith('###   @')) {
    let valStr = line.split('=')[1].trim();
    // Fix dates 'YYYY:MM:DD'
    if (valStr.match(/^'\d{4}:\d{2}:\d{2}'$/)) {
      valStr = valStr.replace(/:/g, '-');
    }
    // Fix timestamps (they might be unix timestamps in some fields, but we pass them as is or converted)
    currentFields.push(valStr);
  }
  if (currentTable && !line.startsWith('###') && currentFields.length > 0) {
    statements.push({table: currentTable, fields: currentFields});
    currentTable = '';
    currentFields = [];
  }
}
statements.forEach(stmt => {
  let fieldsStr = stmt.fields.map(f => {
    // some strings might have escaped quotes
    return f; 
  }).join(', ');
  // Use INSERT IGNORE to prevent duplicate keys if they partially exist
  console.log('INSERT IGNORE INTO ' + stmt.table + ' VALUES (' + fieldsStr + ');');
});
