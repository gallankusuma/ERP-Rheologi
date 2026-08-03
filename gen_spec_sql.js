/**
 * Generate SQL import statements from scraped FBox specification data
 * 
 * Usage: node gen_spec_sql.js
 * Input: spec_data.json
 * Output: spec_import.sql
 */

const fs = require('fs');

// Read scraped data
const raw = fs.readFileSync('spec_data.json', 'utf8');
const specs = JSON.parse(raw);

const esc = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  const s = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
  return `'${s}'`;
};

const escText = (v) => {
  if (!v || typeof v !== 'string') return 'NULL';
  // Clean up scraped text: remove embedded JSON, extra whitespace
  let clean = v.split('\n')[0].trim();
  if (clean.startsWith('{')) return 'NULL'; // JSON artifact
  return esc(clean);
};

const parseDate = (d) => {
  if (!d) return 'NULL';
  // Convert dd-mm-yyyy to yyyy-mm-dd
  const match = d.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (match) return esc(`${match[3]}-${match[2]}-${match[1]}`);
  return esc(d);
};

// Helper: clean parameter name (remove numeric prefix)
const cleanParamName = (name) => {
  if (!name) return '';
  return name.replace(/^\d+\s*-\s*/, '').trim();
};

// Helper: clean sample name (remove trailing "Brand" text)  
const cleanSampleName = (name) => {
  if (!name) return '';
  return name.split('\n')[0].replace(/Brand$/i, '').trim();
};

// Helper: clean setup type (remove JSON artifacts)
const cleanSetupType = (s) => {
  if (!s) return '';
  const first = s.split('\n')[0].trim();
  if (first.startsWith('{')) return '';
  return first;
};

let sql = '';
sql += '-- ================================================\n';
sql += '-- FBox Specification Data Import\n';
sql += `-- Generated: ${new Date().toISOString()}\n`;
sql += `-- Total specs: ${specs.length}\n`;
sql += '-- ================================================\n\n';
sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

let specCount = 0, sampleCount = 0, paramCount = 0, itemCount = 0;

for (const spec of specs) {
  if (!spec.doc_number && !spec.sample_name) continue; // Skip empty
  
  specCount++;

  sql += `-- Spec: ${spec.doc_number || spec.fbox_id}\n`;
  sql += `INSERT INTO rnd_specifications (fbox_id, doc_number, doc_date, process_type, process_type_code, sample_name, sample_type, sample_type_code, active, notes, revision, revision_no, revision_by, approve_1, approve_1_by, source) VALUES (\n`;
  sql += `  ${spec.fbox_id || 'NULL'}, ${esc(spec.doc_number)}, ${parseDate(spec.doc_date)},\n`;
  sql += `  ${esc(spec.process_type)}, ${esc(spec.process_type_code)},\n`;
  sql += `  ${esc(spec.sample_name)}, ${esc(spec.sample_type)}, ${esc(spec.sample_type_code)},\n`;
  sql += `  ${spec.active !== undefined ? spec.active : 1}, ${esc(spec.notes)},\n`;
  sql += `  ${spec.revision || 0}, ${spec.revision_no || 0}, ${esc(spec.revision_by || '')},\n`;
  sql += `  ${spec.approve_1 || 0}, ${esc(spec.approve_1_by || '')}, 'FBOX'\n`;
  sql += `);\n`;
  sql += `SET @spec_id = LAST_INSERT_ID();\n\n`;

  // Process samples - filter out parameter rows that were mistakenly captured as samples
  const realSamples = [];
  const allRows = spec.samples || [];
  
  for (const row of allRows) {
    // Real samples have codes like S-xxx-N or similar patterns
    // Parameter rows have names like "50 - AI as Chlorpyrifos"
    const code = row.sample_code || '';
    const isRealSample = code.match(/^S-/) || // Starts with S-
                          code.match(/^[A-Z]{2,}/) || // Starts with 2+ uppercase letters
                          (row.parameters && row.parameters.length > 0); // Has nested params
    
    if (isRealSample) {
      realSamples.push(row);
    }
    // If not a real sample, it's a parameter row mixed in - we skip it since
    // its data is already captured in the parent sample's parameters array
  }

  for (const sample of realSamples) {
    sampleCount++;
    const sampleName = cleanSampleName(sample.sample_name);
    const samplePoint = sample.sample_point ? sample.sample_point.split('\n')[0].trim() : '';
    const brand = sample.brand || '';
    // Extract brand from sample_point if it contains it
    let actualBrand = brand;
    if (!actualBrand && sample.sample_point && sample.sample_point.includes('\n')) {
      const parts = sample.sample_point.split('\n');
      if (parts.length > 1) actualBrand = parts[parts.length - 1].trim();
    }
    
    sql += `INSERT INTO rnd_spec_samples (spec_id, sample_code, sample_name, brand, sample_point, sample_type, status_spek, status_off_spek, sort_order) VALUES (\n`;
    sql += `  @spec_id, ${esc(sample.sample_code)}, ${esc(sampleName)}, ${esc(actualBrand)},\n`;
    sql += `  ${esc(samplePoint)}, ${esc(sample.sample_type)},\n`;
    sql += `  ${esc(sample.status_spek)}, ${esc(sample.status_off_spek)}, ${sample.sort_order || 0}\n`;
    sql += `);\n`;
    sql += `SET @sample_id = LAST_INSERT_ID();\n`;

    // Parameters
    for (const param of (sample.parameters || [])) {
      paramCount++;
      const paramName = cleanParamName(param.parameter_name);
      const method = cleanParamName(param.method);
      const setup = cleanSetupType(param.setup_type);
      
      sql += `INSERT INTO rnd_spec_parameters (sample_id, parameter_name, method, unit, specification, frequency, setup_type, active, sort_order) VALUES (\n`;
      sql += `  @sample_id, ${esc(paramName)}, ${esc(method)}, ${esc(param.unit)},\n`;
      sql += `  ${esc(param.specification)}, ${esc(param.frequency)}, ${esc(setup)},\n`;
      sql += `  ${param.active === 'No' ? 0 : 1}, ${param.sort_order || 0}\n`;
      sql += `);\n`;
    }
    sql += '\n';
  }

  // Items
  for (const item of (spec.items || [])) {
    itemCount++;
    sql += `INSERT INTO rnd_spec_items (spec_id, item_code, item_description, unit, product_id) VALUES (\n`;
    sql += `  @spec_id, ${esc(item.item_code)}, ${esc(item.item_description)}, ${esc(item.unit)},\n`;
    sql += `  (SELECT id FROM products WHERE sku = ${esc(item.item_code)} LIMIT 1)\n`;
    sql += `);\n`;
  }
  sql += '\n';
}

sql += 'SET FOREIGN_KEY_CHECKS = 1;\n\n';
sql += `-- Summary: ${specCount} specs, ${sampleCount} samples, ${paramCount} parameters, ${itemCount} items\n`;

fs.writeFileSync('spec_import.sql', sql, 'utf8');
console.log(`Generated spec_import.sql`);
console.log(`  Specs: ${specCount}`);
console.log(`  Samples: ${sampleCount}`);
console.log(`  Parameters: ${paramCount}`);
console.log(`  Items: ${itemCount}`);
