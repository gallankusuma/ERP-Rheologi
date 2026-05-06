const fs = require('fs');

const file = 'c:\\xampp1\\htdocs\\ERP\\frontend\\src\\views\\Items.vue';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Duplicate Check[\s\S]*?(?=if \(Object\.keys\(errors\.value\)\.length > 0\))/;

const newCheck = `// Duplicate Check
  const normalizeStr = (str) => (str || '').toLowerCase().replace(/\\s+/g, '');

  if (form.value.sku) {
    const normalizedNewSku = normalizeStr(form.value.sku);
    const isDuplicateSku = items.value.some(item => {
      if (!item || !item.sku) return false;
      return normalizeStr(item.sku) === normalizedNewSku && (!editingItem.value || item.id !== editingItem.value.id);
    });
    if (isDuplicateSku) errors.value.sku = 'Warning: SKU ini sudah digunakan!';
  }

  if (form.value.name) {
    const normalizedNewName = normalizeStr(form.value.name);
    const isDuplicateName = items.value.some(item => {
      if (!item || !item.name) return false;
      return normalizeStr(item.name) === normalizedNewName && (!editingItem.value || item.id !== editingItem.value.id);
    });
    if (isDuplicateName) errors.value.name = 'Warning: Nama item ini sudah digunakan!';
  }

  `;

content = content.replace(regex, newCheck);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated duplicate check logic in Items.vue');
