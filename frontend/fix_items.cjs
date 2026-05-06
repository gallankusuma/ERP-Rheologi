const fs = require('fs');

const file = 'c:\\xampp1\\htdocs\\ERP\\frontend\\src\\views\\Items.vue';
let content = fs.readFileSync(file, 'utf8');

const oldCheck = `
  // Duplicate Check
  if (form.value.sku) {
    const isDuplicateSku = items.value.some(item => 
      item.sku.toLowerCase() === form.value.sku.toLowerCase() && 
      (!editingItem.value || item.id !== editingItem.value.id)
    );
    if (isDuplicateSku) errors.value.sku = 'Warning: SKU ini sudah digunakan!';
  }

  if (form.value.name) {
    const isDuplicateName = items.value.some(item => 
      item.name.toLowerCase() === form.value.name.toLowerCase() && 
      (!editingItem.value || item.id !== editingItem.value.id)
    );
    if (isDuplicateName) errors.value.name = 'Warning: Nama item ini sudah digunakan!';
  }`;

const newCheck = `
  // Duplicate Check Helper
  const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/\\s+/g, '');

  // Duplicate Check
  if (form.value.sku) {
    const normalizedNewSku = normalizeStr(form.value.sku);
    const isDuplicateSku = items.value.some(item => 
      normalizeStr(item.sku) === normalizedNewSku && 
      (!editingItem.value || item.id !== editingItem.value.id)
    );
    if (isDuplicateSku) errors.value.sku = 'Warning: SKU ini sudah digunakan!';
  }

  if (form.value.name) {
    const normalizedNewName = normalizeStr(form.value.name);
    const isDuplicateName = items.value.some(item => 
      normalizeStr(item.name) === normalizedNewName && 
      (!editingItem.value || item.id !== editingItem.value.id)
    );
    if (isDuplicateName) errors.value.name = 'Warning: Nama item ini sudah digunakan!';
  }`;

content = content.replace(oldCheck.trim(), newCheck.trim());
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated duplicate check logic in Items.vue');
