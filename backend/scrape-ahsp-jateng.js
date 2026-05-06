/**
 * Script untuk scrape data AHSP dari website Jawa Tengah
 * https://maspetruk.dpubinmarcipka.jatengprov.go.id/harga_satuan/hspk
 */

const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_manufacturing'
};

// Main scraper function
async function scrapeAHSP() {
  console.log('🚀 Starting AHSP scraper from Jawa Tengah...');
  
  const connection = await mysql.createConnection(dbConfig);
  console.log('✅ Connected to database');

  try {
    // Create tables if not exist
    await createTables(connection);

    // Get sub_discipline_id for "Perkerjaan Umum" or default
    const [disciplines] = await connection.query(
      'SELECT id FROM sub_disciplines WHERE name LIKE ? OR name LIKE ? LIMIT 1',
      ['%Pekerjaan Umum%', '%Umum%']
    );
    const subDisciplineId = disciplines.length > 0 ? disciplines[0].id : 1;

    let totalPages = 60; // Ada 593 entri, 10 per halaman = 60 halaman
    let totalInserted = 0;
    let totalFailed = 0;

    for (let page = 1; page <= totalPages; page++) {
      console.log(`\n📄 Scraping page ${page}/${totalPages}...`);
      
      try {
        const url = page === 1 
          ? 'https://maspetruk.dpubinmarcipka.jatengprov.go.id/harga_satuan/hspk'
          : `https://maspetruk.dpubinmarcipka.jatengprov.go.id/harga_satuan/hspk?page=${page}`;

        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const items = [];

        // Parse table rows
        $('table tbody tr').each((index, element) => {
          const $row = $(element);
          const cells = $row.find('td');
          
          if (cells.length >= 5) {
            const kode = $(cells[1]).text().trim();
            const name = $(cells[2]).text().trim();
            const satuan = $(cells[3]).text().trim();
            const hargaText = $(cells[4]).text().trim();
            
            // Parse harga: "Rp 996.801,-" -> 996801
            const hargaSatuan = parseFloat(
              hargaText
                .replace(/Rp\s*/gi, '')
                .replace(/\./g, '')
                .replace(/,/g, '.')
                .replace(/-/g, '')
                .trim()
            ) || 0;

            if (kode && name && satuan) {
              items.push({
                kode,
                name,
                satuan,
                harga_satuan: hargaSatuan,
                sub_discipline_id: subDisciplineId
              });
            }
          }
        });

        console.log(`   Found ${items.length} items on page ${page}`);

        // Insert to database
        for (const item of items) {
          try {
            // Check if already exists
            const [existing] = await connection.query(
              'SELECT id FROM ahsp WHERE kode = ?',
              [item.kode]
            );

            if (existing.length === 0) {
              // Calculate overhead & profit (10%)
              const hargaLangsung = item.harga_satuan / 1.1;
              const overheadProfit = item.harga_satuan - hargaLangsung;

              await connection.query(
                `INSERT INTO ahsp 
                (kode, name, satuan, sub_discipline_id, harga_langsung, overhead_profit, harga_satuan, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                  item.kode,
                  item.name,
                  item.satuan,
                  item.sub_discipline_id,
                  hargaLangsung,
                  overheadProfit,
                  item.harga_satuan
                ]
              );
              totalInserted++;
            } else {
              console.log(`   ⏭️  Skipping ${item.kode} (already exists)`);
            }
          } catch (err) {
            console.error(`   ❌ Error inserting ${item.kode}:`, err.message);
            totalFailed++;
          }
        }

        // Delay to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`   ❌ Error scraping page ${page}:`, err.message);
      }
    }

    console.log('\n✅ Scraping completed!');
    console.log(`   📊 Total inserted: ${totalInserted}`);
    console.log(`   ⚠️  Total failed: ${totalFailed}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed');
  }
}

async function createTables(connection) {
  // Check if ahsp table exists
  const [tables] = await connection.query(
    "SHOW TABLES LIKE 'ahsp'"
  );

  if (tables.length === 0) {
    console.log('📝 Creating ahsp table...');
    await connection.query(`
      CREATE TABLE ahsp (
        id INT PRIMARY KEY AUTO_INCREMENT,
        kode VARCHAR(50) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        satuan VARCHAR(20),
        sub_discipline_id INT,
        harga_langsung DECIMAL(15,2) DEFAULT 0,
        overhead_profit DECIMAL(15,2) DEFAULT 0,
        harga_satuan DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kode (kode),
        INDEX idx_sub_discipline (sub_discipline_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  // Check if ahsp_details table exists
  const [detailTables] = await connection.query(
    "SHOW TABLES LIKE 'ahsp_details'"
  );

  if (detailTables.length === 0) {
    console.log('📝 Creating ahsp_details table...');
    await connection.query(`
      CREATE TABLE ahsp_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ahsp_id INT NOT NULL,
        section VARCHAR(1) NOT NULL COMMENT 'A=Tenaga, B=Bahan, C=Peralatan',
        resource_code VARCHAR(50),
        resource_name TEXT NOT NULL,
        resource_satuan VARCHAR(20),
        koefisien DECIMAL(10,4) DEFAULT 0,
        resource_harga DECIMAL(15,2) DEFAULT 0,
        jumlah_harga DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ahsp_id) REFERENCES ahsp(id) ON DELETE CASCADE,
        INDEX idx_ahsp (ahsp_id),
        INDEX idx_section (section)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  // Check if sub_disciplines table exists
  const [subDisciplines] = await connection.query(
    "SHOW TABLES LIKE 'sub_disciplines'"
  );

  if (subDisciplines.length === 0) {
    console.log('📝 Creating sub_disciplines table...');
    await connection.query(`
      CREATE TABLE sub_disciplines (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        discipline_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert default sub_discipline
    await connection.query(
      "INSERT INTO sub_disciplines (name) VALUES ('Pekerjaan Umum')"
    );
  }

  console.log('✅ Tables ready');
}

// Run the scraper
if (require.main === module) {
  scrapeAHSP()
    .then(() => {
      console.log('\n🎉 Script finished successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Script failed:', err);
      process.exit(1);
    });
}

module.exports = { scrapeAHSP };
