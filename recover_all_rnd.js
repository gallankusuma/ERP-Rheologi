const fs = require('fs');
console.log("Reading dump...");
const content = fs.readFileSync('/tmp/all_binlogs.txt', 'utf8');
const lines = content.split('\n');
let statements = [];
let currentTable = '';
let currentFields = [];
for (let i=0; i<lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('### INSERT INTO ')) {
    currentTable = line.replace('### INSERT INTO ', '').trim().replace(/`/g, '');
    if (currentTable.startsWith('erp_rheologi.rnd_')) {
      currentFields = [];
      continue;
    } else {
      currentTable = '';
    }
  }
  if (currentTable.startsWith('erp_rheologi.rnd_') && line.startsWith('###   @')) {
    let valStr = line.split('=')[1].trim();
    if (valStr.match(/^'\d{4}:\d{2}:\d{2}'$/)) {
      valStr = valStr.replace(/:/g, '-');
    }
    currentFields.push(valStr);
  }
  if (currentTable.startsWith('erp_rheologi.rnd_') && !line.startsWith('###') && currentFields.length > 0) {
    statements.push({table: currentTable, fields: currentFields});
    currentTable = '';
    currentFields = [];
  }
}
let out = '';
statements.forEach(stmt => {
  let fieldsStr = stmt.fields.map(f => f).join(', ');
  out += 'INSERT IGNORE INTO ' + stmt.table + ' VALUES (' + fieldsStr + ');\n';
});
fs.writeFileSync('/tmp/restore_all_rnd.sql', out);
console.log("Done generating " + statements.length + " statements");
