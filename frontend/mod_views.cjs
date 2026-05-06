const fs = require('fs');
const path = require('path');

const views = [
  { file: 'UnitOfMeasure.vue', arrayName: 'units' },
  { file: 'Items.vue', arrayName: 'items' },
  { file: 'ItemTypes.vue', arrayName: 'types' },
  { file: 'Categories.vue', arrayName: 'categories' },
  { file: 'BOM.vue', arrayName: 'boms' },
  { file: 'Warehouses.vue', arrayName: 'warehouses' },
  { file: 'WarehouseLocations.vue', arrayName: 'locations' },
  { file: 'Suppliers.vue', arrayName: 'suppliers' },
  { file: 'Customers.vue', arrayName: 'customers' },
  { file: 'Users.vue', arrayName: 'userStore.users', isStore: true },
  { file: 'Departments.vue', arrayName: 'departments' },
  { file: 'Roles.vue', arrayName: 'roles' }
];

const dir = 'c:\\xampp1\\htdocs\\ERP\\frontend\\src\\views';

views.forEach(v => {
  const p = path.join(dir, v.file);
  if (!fs.existsSync(p)) return console.log('Not found:', p);
  
  let content = fs.readFileSync(p, 'utf8');

  // Skip if already has export function
  if (content.includes('exportToCSV(') || content.includes('exportToCSV')) {
    console.log('Already exported:', v.file);
    return;
  }

  // 1. Add Export button in the header
  // Try to find the Add button and insert the Export button before it
  // Most buttons have text like "+ Add" or "+ Create" or just a button with a blue color in the header flex box.
  const btnRegex = /(<button[^>]*@click="[^"]*Add[^"]*"[^>]*>.*?<\/button>)/s;
  const btnRegex2 = /(<button[^>]*@click="[^"]*Create[^"]*"[^>]*>.*?<\/button>)/s;
  const btnRegex3 = /(<button[^>]*@click="openModal"[^>]*>.*?<\/button>)/s;
  const btnRegex4 = /(<button[^>]*@click="openCreateModal"[^>]*>.*?<\/button>)/s;
  
  let match = content.match(btnRegex) || content.match(btnRegex2) || content.match(btnRegex3) || content.match(btnRegex4);
  
  if (match) {
    const exportBtn = `
        <button
          @click="handleExport"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
        >
          📥 Export
        </button>
`;
    content = content.replace(match[0], exportBtn.trim() + '\n        ' + match[0]);
  } else {
    console.log('Could not find Add button in', v.file);
  }

  // 2. Add import for exportToCSV
  content = content.replace(/<script setup lang="ts">/, `<script setup lang="ts">\nimport { exportToCSV } from '../utils/export';`);

  // 3. Add handleExport function
  let dataVar = v.isStore ? v.arrayName : `${v.arrayName}.value`;
  // special case for BOM which is bomStore.boms if using store
  if (content.includes('useBomStore')) {
    dataVar = 'bomStore.boms';
  } else if (content.includes('useUserStore')) {
    dataVar = 'userStore.users';
  } else if (content.includes('useRoleStore') && v.file === 'Roles.vue') {
    dataVar = 'roleStore.roles';
  } else if (content.includes('useDepartmentStore') && v.file === 'Departments.vue') {
    // Actually Departments uses api.get, so it's 'departments.value'
  }

  const exportFunc = `
function handleExport() {
  exportToCSV(${dataVar}, '${v.file.replace('.vue', '')}_Export');
}
`;
  
  content = content.replace(/<\/script>/, exportFunc + '\n</script>');

  fs.writeFileSync(p, content, 'utf8');
  console.log('Updated', v.file);
});
