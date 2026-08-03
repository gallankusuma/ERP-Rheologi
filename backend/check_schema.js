const { dbAll } = require('./src/config/database');

(async () => {
  try {
    const cols = await dbAll('DESCRIBE fund_requests');
    console.log('=== fund_requests ===');
    console.table(cols);

    const cols2 = await dbAll('DESCRIBE fund_request_items');
    console.log('=== fund_request_items ===');
    console.table(cols2);

    const pos = await dbAll("SELECT id,po_number,status,vendor_id,total_amount,payment_term FROM purchase_orders WHERE status IN ('approved','completed','partial') LIMIT 10");
    console.log('=== Approved POs ===');
    console.table(pos);

    const scheds = await dbAll("SELECT * FROM purchase_order_payment_schedules LIMIT 10");
    console.log('=== Payment Schedules ===');
    console.table(scheds);

    const frs = await dbAll("SELECT id,request_number,po_id,status,amount FROM fund_requests ORDER BY id DESC LIMIT 5");
    console.log('=== Recent Fund Requests ===');
    console.table(frs);

    const items = await dbAll("SELECT id,fund_request_id,po_id,po_schedule_id,vendor_id,description,amount,status FROM fund_request_items ORDER BY id DESC LIMIT 10");
    console.log('=== Recent FR Items ===');
    console.table(items);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
