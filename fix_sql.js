const fs = require('fs');

const file = '/tmp/restore_all_rnd.sql';
let sql = fs.readFileSync(file, 'utf8');

// Replace 15-value inserts for rnd_documents
sql = sql.replace(/INSERT IGNORE INTO erp_rheologi\.rnd_documents VALUES (\([^\)]+\));/g, (match, values) => {
  const parts = values.split(',');
  if (parts.length === 15) {
    return `INSERT IGNORE INTO erp_rheologi.rnd_documents (id, project_id, formulation_id, lab_test_id, stability_study_id, doc_type, title, description, file_name, file_path, file_size, mime_type, version, uploaded_by, created_at) VALUES ${values};`;
  } else if (parts.length === 16) {
    return `INSERT IGNORE INTO erp_rheologi.rnd_documents (id, project_id, formulation_id, lab_test_id, stability_study_id, doc_type, title, description, file_name, file_path, file_size, mime_type, version, uploaded_by, created_at, folder_id) VALUES ${values};`;
  }
  return match;
});

// Update project 1 status to cancelled at the end
sql += "\nUPDATE erp_rheologi.rnd_projects SET status = 'cancelled' WHERE id = 1;\n";
// Update project 2 status to completed at the end
sql += "UPDATE erp_rheologi.rnd_projects SET status = 'completed' WHERE id = 2;\n";

fs.writeFileSync('/tmp/restore_all_rnd_fixed.sql', sql);
