const fs = require('fs');

const file = 'c:\\xampp1\\htdocs\\ERP\\frontend\\src\\views\\BOM.vue';
let content = fs.readFileSync(file, 'utf8');

// Use regex to handle \r\n vs \n
const oldPattern = /const saveBOM = async \(\) => \{\s*try \{\s*\/\/ Validate required fields\s*if \(!bomHeader\.value\.product_name\) \{\s*alert\('Please enter a product name'\);\s*return;\s*\}\s*if \(bomComponents\.value\.length === 0\) \{/;

const match = content.match(oldPattern);
if (match) {
  const replacement = `const saveBOM = async () => {
  try {
    // Validate required fields
    if (!bomHeader.value.product_name) {
      alert('Please enter a product name');
      return;
    }

    // Duplicate BOM Check (only when creating new, not editing)
    if (!isEditing.value) {
      const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/\\s+/g, '');
      const normalizedNew = normalizeStr(bomHeader.value.product_name);
      const isDuplicate = store.boms.some((bom: any) => normalizeStr(bom.product_name) === normalizedNew);
      if (isDuplicate) {
        const proceed = confirm('⚠️ Warning: BOM dengan nama produk "' + bomHeader.value.product_name + '" sudah ada!\\n\\nApakah anda tetap ingin membuat BOM baru?');
        if (!proceed) return;
      }
    }

    if (bomComponents.value.length === 0) {`;

  content = content.replace(oldPattern, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully added duplicate check to BOM.vue');
} else {
  console.log('ERROR: Regex did not match');
}
