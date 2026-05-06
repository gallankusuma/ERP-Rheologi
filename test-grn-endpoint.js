// Quick test to verify GRN creation endpoint
const axios = require('axios');

const testData = {
  po_id: 2,  // Use an existing PO ID
  warehouse_id: 1,  // Use an existing warehouse ID
  received_date: '2026-02-08',
  received_by: 1,
  status: 'received',
  notes: JSON.stringify({
    items: [{ product_id: 2, received_quantity: 1, product_name: 'Test', po_quantity: 1, unit_of_measure: 'pcs', spec_checked: true, remarks: 'OK' }],
    generalNotes: 'Test GRN'
  })
};

axios.post('http://localhost:3000/api/procurement/goods-receipts', testData, {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoibWFzdGVyQGFkbWluLmNvbSIsInVzZXJMZXZlbCI6NCwiaWF0IjoxNzA3NDE1MjAwfQ.test',
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ Success:', response.data);
})
.catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
  console.error('Status:', error.response?.status);
  console.error('Full error:', error.response?.data);
});
