const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_manufacturing',
  waitForConnections: true,
  connectionLimit: 10,
});

// Sample data generators
const clientNames = [
  'Demo Client', 'Zolla Hauck', 'Halvorson Inc', 'Hauck Ltd', 'Adrain Ondricka',
  'Blaze Rohan', 'Birdie Erdman', 'Sammy Steuber', 'Koss Stracke and Bernier',
  'Abe Bogisich', 'TechCorp Solutions', 'Global Industries', 'Pacific Trading Co',
  'Eastern Manufacturing', 'Western Logistics', 'Northern Enterprises', 'Southern Supplies',
  'Central Distribution', 'Metro Services', 'Regional Partners', 'National Holdings',
  'International Ventures', 'Apex Corporation', 'Summit Industries', 'Pinnacle Group',
  'Elite Services', 'Premier Solutions', 'Supreme Trading', 'Ultimate Manufacturing',
  'Optimal Logistics', 'Prime Enterprises', 'First Choice Supplies', 'Top Tier Distribution',
  'Leading Edge Services', 'Advanced Technologies', 'Innovative Solutions', 'Creative Industries',
  'Dynamic Trading', 'Progressive Manufacturing', 'Modern Logistics', 'Contemporary Enterprises',
  'New Age Supplies', 'Future Distribution', 'Next Gen Services', 'Digital Solutions',
  'Smart Industries', 'Intelligent Trading', 'Bright Horizons', 'Clear Vision Corp',
  'Solid Foundation', 'Strong Alliance', 'United Partners', 'Allied Services'
];

const contactNames = [
  { name: 'Emily Smith', title: 'Manager' },
  { name: 'Zoila Hauck', title: 'CEO' },
  { name: 'Rylee Haley', title: 'Director' },
  { name: 'Ransom Kuvalis', title: 'VP Operations' },
  { name: 'Adrain Ondricka', title: 'Bill and Account Collector' },
  { name: 'Blaze Rohan', title: 'Captain' },
  { name: 'Birdie Erdman', title: 'Interviewer' },
  { name: 'Sammy Steuber', title: 'Procurement Manager' },
  { name: 'Amira Connelly', title: 'Garment Specialist' },
  { name: 'Abe Bogisich', title: 'Deburring Machine Operator' },
  { name: 'Alta Cassin', title: 'Claims Adjuster' },
  { name: 'Ardella Gottlieb', title: 'Boilermaker' },
  { name: 'Breanna Keeling', title: 'Receptionist and Information Clerk' },
  { name: 'Camren Turcotte', title: 'Extruding Machine Operator' },
  { name: 'Cary Lesch', title: 'Forensic Investigator' },
  { name: 'John Anderson', title: 'Sales Director' },
  { name: 'Sarah Williams', title: 'Marketing Manager' },
  { name: 'Michael Brown', title: 'Finance Controller' },
  { name: 'Jennifer Davis', title: 'HR Manager' },
  { name: 'David Wilson', title: 'Operations Head' },
  { name: 'Lisa Taylor', title: 'Quality Assurance Manager' },
  { name: 'James Johnson', title: 'Supply Chain Manager' },
  { name: 'Patricia Martinez', title: 'IT Director' },
  { name: 'Robert Garcia', title: 'Production Manager' },
  { name: 'Mary Rodriguez', title: 'Logistics Coordinator' }
];

const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi'];
const provinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Timur', 'Sumatera Utara', 'Jawa Tengah', 'Sulawesi Selatan'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function seedClients() {
  const connection = await pool.getConnection();

  try {
    console.log('🌱 Starting client module seed...\n');

    // Get user IDs for relationships
    const [users] = await connection.execute('SELECT id FROM users LIMIT 5');
    const userIds = users.map(u => u.id);

    // Get label and group IDs
    const [labels] = await connection.execute('SELECT id FROM client_labels');
    const labelIds = labels.map(l => l.id);

    const [groups] = await connection.execute('SELECT id FROM client_groups');
    const groupIds = groups.map(g => g.id);

    // 1. INSERT CLIENTS (52 clients to match reference)
    console.log('📊 Creating 52 clients...');
    const clientIds = [];

    for (let i = 0; i < 52; i++) {
      const clientCode = `CL${String(101 + i).padStart(3, '0')}`;

      // Check if client exists
      const [existing] = await connection.execute('SELECT id FROM clients WHERE code = ?', [clientCode]);
      if (existing.length > 0) {
        clientIds.push(existing[0].id);
        continue;
      }

      const totalInvoiced = randomInt(0, 50000);
      const paymentReceived = Math.floor(totalInvoiced * (Math.random() * 0.9 + 0.1)); // 10-100% paid
      const dueAmount = totalInvoiced - paymentReceived;

      const [result] = await connection.execute(
        `INSERT INTO clients (code, name, organization, address, city, province, phone, client_group_id, 
         total_invoiced, payment_received, due_amount, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          clientCode,
          clientNames[i] || `Client ${i + 1}`,
          clientNames[i] || `${clientNames[i % clientNames.length]} Organization`,
          `${randomInt(1, 999)} Main Street, Building ${randomInt(1, 50)}`,
          cities[i % cities.length],
          provinces[i % provinces.length],
          `+62${randomInt(211, 899)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
          groupIds[i % groupIds.length],
          totalInvoiced,
          paymentReceived,
          dueAmount
        ]
      );
      clientIds.push(result.insertId);
    }
    console.log(`✅ Created ${clientIds.length} clients\n`);

    // 2. ASSIGN LABELS TO CLIENTS (random distribution)
    console.log('🏷️  Assigning labels to clients...');
    let labelCount = 0;
    for (const clientId of clientIds) {
      const numLabels = randomInt(0, 2); // 0-2 labels per client
      const assignedLabels = new Set();

      for (let i = 0; i < numLabels; i++) {
        const labelId = labelIds[randomInt(0, labelIds.length - 1)];
        if (!assignedLabels.has(labelId)) {
          await connection.execute(
            'INSERT IGNORE INTO client_label_map (client_id, label_id) VALUES (?, ?)',
            [clientId, labelId]
          );
          assignedLabels.add(labelId);
          labelCount++;
        }
      }
    }
    console.log(`✅ Assigned ${labelCount} labels\n`);

    // 3. INSERT CONTACTS (50 contacts)
    console.log('👥 Creating 50 contacts...');
    const contactIds = [];
    const contactsData = [];

    for (let i = 0; i < 50; i++) {
      const clientId = clientIds[i % clientIds.length];
      const contact = contactNames[i % contactNames.length];
      const isPrimary = i < clientIds.length ? 1 : 0; // First contacts are primary

      const lastLogin = Math.random() > 0.7 ? formatDate(randomDate(new Date(2026, 1, 1), new Date(2026, 1, 10))) : null;

      const [result] = await connection.execute(
        `INSERT IGNORE INTO contacts (client_id, name, job_title, email, phone, is_primary, last_login) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          contact.name,
          contact.title,
          `${contact.name.toLowerCase().replace(' ', '.')}@demo.com`,
          `+${randomInt(1, 9)}-${randomInt(100, 999)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
          isPrimary,
          lastLogin
        ]
      );
      contactIds.push(result.insertId);
      contactsData.push({ id: result.insertId, clientId, isPrimary });
    }
    console.log(`✅ Created ${contactIds.length} contacts\n`);

    // Update primary_contact_id in clients
    for (const contact of contactsData) {
      if (contact.isPrimary) {
        await connection.execute(
          'UPDATE clients SET primary_contact_id = ? WHERE id = ?',
          [contact.id, contact.clientId]
        );
      }
    }

    // 4. INSERT PROJECTS
    console.log('📁 Creating client projects...');
    const projectStatuses = ['open', 'completed', 'hold', 'canceled'];
    const projectCounts = { open: 18, completed: 4, hold: 0, canceled: 0 };
    let projectId = 1;

    for (const [status, count] of Object.entries(projectCounts)) {
      for (let i = 0; i < count; i++) {
        const clientId = clientIds[randomInt(0, clientIds.length - 1)];
        const startDate = randomDate(new Date(2025, 0, 1), new Date(2026, 0, 1));
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + randomInt(1, 6));

        await connection.execute(
          `INSERT IGNORE INTO client_projects (client_id, project_number, project_name, start_date, end_date, 
           budget, actual_cost, status, progress_percentage, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            `PRJ-${String(projectId++).padStart(4, '0')}`,
            `Project ${projectId} for ${clientNames[clientIds.indexOf(clientId) % clientNames.length]}`,
            formatDate(startDate),
            formatDate(endDate),
            randomInt(10000, 100000),
            randomInt(5000, 80000),
            status,
            status === 'completed' ? 100 : randomInt(10, 90),
            userIds[randomInt(0, userIds.length - 1)]
          ]
        );
      }
    }
    console.log(`✅ Created ${Object.values(projectCounts).reduce((a, b) => a + b, 0)} projects\n`);

    // 5. INSERT INVOICES
    console.log('💰 Creating invoices...');
    const invoiceStatuses = { unpaid: 4, partial: 5, overdue: 4, paid: 6 };
    let invoiceNum = 1;

    for (const [status, count] of Object.entries(invoiceStatuses)) {
      for (let i = 0; i < count; i++) {
        const clientId = clientIds[randomInt(0, clientIds.length - 1)];
        const total = randomInt(500, 10000);
        let paidAmount = 0;
        let invoiceStatus = 'sent';

        if (status === 'paid') {
          paidAmount = total;
          invoiceStatus = 'paid';
        } else if (status === 'partial') {
          paidAmount = Math.floor(total * (Math.random() * 0.7 + 0.1));
          invoiceStatus = 'partial';
        } else if (status === 'overdue') {
          paidAmount = 0;
          invoiceStatus = 'overdue';
        }

        const invoiceDate = randomDate(new Date(2025, 6, 1), new Date(2026, 1, 1));
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30);

        await connection.execute(
          `INSERT IGNORE INTO client_invoices (client_id, invoice_number, invoice_date, due_date, 
           subtotal, total_amount, paid_amount, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            `INV-${String(invoiceNum++).padStart(4, '0')}`,
            formatDate(invoiceDate),
            formatDate(dueDate),
            total,
            total,
            paidAmount,
            invoiceStatus,
            userIds[randomInt(0, userIds.length - 1)]
          ]
        );
      }
    }
    console.log(`✅ Created ${Object.values(invoiceStatuses).reduce((a, b) => a + b, 0)} invoices\n`);

    // 6. INSERT ESTIMATES
    console.log('📋 Creating estimates...');
    const estimateStatuses = { open: 5, accepted: 10, new: 1, in_progress: 1 };
    let estimateNum = 1;

    for (const [status, count] of Object.entries(estimateStatuses)) {
      for (let i = 0; i < count; i++) {
        const clientId = clientIds[randomInt(0, clientIds.length - 1)];
        const estimateDate = randomDate(new Date(2025, 10, 1), new Date(2026, 1, 1));
        const validUntil = new Date(estimateDate);
        validUntil.setDate(validUntil.getDate() + 30);

        let estStatus = status === 'new' ? 'sent' : (status === 'in_progress' ? 'sent' : status);
        if (status === 'open') estStatus = 'sent';

        await connection.execute(
          `INSERT IGNORE INTO client_estimates (client_id, estimate_number, estimate_date, valid_until, 
           total_amount, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            `EST-${String(estimateNum++).padStart(4, '0')}`,
            formatDate(estimateDate),
            formatDate(validUntil),
            randomInt(5000, 50000),
            estStatus,
            userIds[randomInt(0, userIds.length - 1)]
          ]
        );
      }
    }
    console.log(`✅ Created ${Object.values(estimateStatuses).reduce((a, b) => a + b, 0)} estimates\n`);

    // 7. INSERT PROPOSALS
    console.log('📄 Creating proposals...');
    const proposalStatuses = { open: 2, accepted: 10, rejected: 3 };
    let proposalNum = 1;

    for (const [status, count] of Object.entries(proposalStatuses)) {
      for (let i = 0; i < count; i++) {
        const clientId = clientIds[randomInt(0, clientIds.length - 1)];

        await connection.execute(
          `INSERT IGNORE INTO client_proposals (client_id, proposal_number, title, proposal_date, 
           total_amount, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            `PROP-${String(proposalNum++).padStart(4, '0')}`,
            `Proposal ${proposalNum} - Service Agreement`,
            formatDate(randomDate(new Date(2025, 8, 1), new Date(2026, 1, 1))),
            randomInt(10000, 100000),
            status === 'open' ? 'sent' : status,
            userIds[randomInt(0, userIds.length - 1)]
          ]
        );
      }
    }
    console.log(`✅ Created ${Object.values(proposalStatuses).reduce((a, b) => a + b, 0)} proposals\n`);

    // 8. INSERT TICKETS
    console.log('🎫 Creating tickets...');
    // 38 open tickets (73% of 52 clients)
    for (let i = 0; i < 38; i++) {
      const clientId = clientIds[randomInt(0, clientIds.length - 1)];

      await connection.execute(
        `INSERT IGNORE INTO client_tickets (client_id, ticket_number, subject, priority, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          `TKT-${String(i + 1).padStart(4, '0')}`,
          `Support Request ${i + 1}`,
          ['low', 'normal', 'high'][randomInt(0, 2)],
          'open',
          userIds[randomInt(0, userIds.length - 1)]
        ]
      );
    }
    console.log(`✅ Created 38 open tickets\n`);

    // 9. INSERT ORDERS
    console.log('📦 Creating orders...');
    // 7 new orders (13% of 52 clients)
    for (let i = 0; i < 7; i++) {
      const clientId = clientIds[randomInt(0, clientIds.length - 1)];

      await connection.execute(
        `INSERT IGNORE INTO client_orders (client_id, order_number, order_date, total_amount, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          `ORD-${String(i + 1).padStart(4, '0')}`,
          formatDate(randomDate(new Date(2026, 1, 1), new Date(2026, 1, 10))),
          randomInt(1000, 20000),
          'confirmed',
          userIds[randomInt(0, userIds.length - 1)]
        ]
      );
    }
    console.log(`✅ Created 7 orders\n`);

    // 10. INSERT CLIENT EVENTS
    console.log('📅 Creating client events...');
    const [eventTypes] = await connection.execute('SELECT id FROM event_types');
    const eventTypeIds = eventTypes.map(e => e.id);

    for (let i = 0; i < 30; i++) {
      const clientId = clientIds[randomInt(0, clientIds.length - 1)];
      const eventDate = randomDate(new Date(2026, 1, 1), new Date(2026, 1, 28));

      await connection.execute(
        `INSERT IGNORE INTO client_events (client_id, event_type_id, title, event_date, start_time, location, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          eventTypeIds[randomInt(0, eventTypeIds.length - 1)],
          `Client Meeting ${i + 1}`,
          formatDate(eventDate),
          `${randomInt(9, 16)}:00:00`,
          `Meeting Room ${randomInt(1, 5)}`,
          userIds[randomInt(0, userIds.length - 1)]
        ]
      );
    }
    console.log(`✅ Created 30 client events\n`);

    console.log('🎉 Client module seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - 52 Clients');
    console.log('   - 50 Contacts');
    console.log('   - 22 Projects (18 open, 4 completed)');
    console.log('   - 19 Invoices (4 unpaid, 5 partial, 4 overdue, 6 paid)');
    console.log('   - 17 Estimates (5 open, 10 accepted, 2 requests)');
    console.log('   - 15 Proposals (2 open, 10 accepted, 3 rejected)');
    console.log('   - 38 Open Tickets');
    console.log('   - 7 New Orders');
    console.log('   - 30 Client Events');

  } catch (error) {
    console.error('❌ Error seeding client module:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run seed
seedClients()
  .then(() => {
    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  });
