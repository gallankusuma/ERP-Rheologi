const fs = require('fs');
const cp = require('child_process');
console.log("Dumping binlogs...");
cp.execSync('mysqlbinlog --base64-output=DECODE-ROWS -v /var/lib/mysql/binlog.0001* > /tmp/all_binlogs.txt');
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
    if (currentTable === 'erp_rheologi.rnd_milestones') {
      currentFields = [];
      continue;
    } else {
      currentTable = '';
    }
  }
  if (currentTable === 'erp_rheologi.rnd_milestones' && line.startsWith('###   @')) {
    let valStr = line.split('=')[1].trim();
    if (valStr.match(/^'\d{4}:\d{2}:\d{2}'$/)) {
      valStr = valStr.replace(/:/g, '-');
    }
    currentFields.push(valStr);
  }
  if (currentTable === 'erp_rheologi.rnd_milestones' && !line.startsWith('###') && currentFields.length > 0) {
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
fs.writeFileSync('/tmp/restore_milestones.sql', out);
console.log("Done generating " + statements.length + " statements");
