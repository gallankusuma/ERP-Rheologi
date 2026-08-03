/**
 * JBox BOM Scraper using Puppeteer
 * Scrapes active BOMs + their detail (components/raw materials)
 * Run: node scrape_bom_puppeteer.js
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'https://jbox.salimagrochemical.com';
const USERNAME = 'adi anggoro10';
const PASSWORD = '123456';

async function main() {
  console.log('🚀 Starting Puppeteer BOM scraper...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
    ignoreHTTPSErrors: true,
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // ==================== LOGIN ====================
  console.log('🔑 Logging in...');
  await page.goto(`${BASE}/user/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  
  await page.type('input[name="username"]', USERNAME);
  await page.type('input[name="password"]', PASSWORD);
  await page.click('input[name="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  
  // Verify login
  const currentUrl = page.url();
  console.log('   Current URL after login:', currentUrl);
  if (currentUrl.includes('login')) {
    console.log('❌ Login failed! Check credentials.');
    await browser.close();
    return;
  }
  console.log('✅ Login successful!\n');
  
  // ==================== GET BOM LIST (Active only) ====================
  console.log('📋 Fetching BOM list (active only)...');
  await page.goto(`${BASE}/master_bom2`, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait for jQuery to load, then trigger AJAX search
  await page.waitForFunction(() => typeof jQuery !== 'undefined', { timeout: 10000 }).catch(() => {});
  
  // The list_data_ajax endpoint returns all BOM data as HTML table
  const bomListHtml = await page.evaluate(async () => {
    const resp = await fetch('/master_bom2/list_data_ajax');
    return await resp.text();
  });
  
  // Parse BOM IDs and basic info from the AJAX HTML
  const bomList = await page.evaluate((html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('tr');
    const boms = [];
    
    rows.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 8) return;
      
      const link = row.querySelector('a[href*="add_bom_detail"]');
      if (!link) return;
      
      const idMatch = link.href.match(/add_bom_detail\/(\d+)/);
      if (!idMatch) return;
      
      const status = (tds[7] || {}).textContent?.trim() || '';
      // Only active BOMs
      if (status.toLowerCase() !== 'active') return;
      
      boms.push({
        id: parseInt(idMatch[1]),
        bom_code: (tds[2] || {}).textContent?.trim() || '',
        description: (tds[3] || {}).textContent?.trim() || '',
        qty: (tds[4] || {}).textContent?.trim() || '',
        unit: (tds[5] || {}).textContent?.trim() || '',
        version: (tds[6] || {}).textContent?.trim() || '',
        status: status,
        process: (tds[8] || {}).textContent?.trim() || '',
        line: (tds[9] || {}).textContent?.trim() || '',
        remark: (tds[10] || {}).textContent?.trim() || '',
      });
    });
    
    return boms;
  }, bomListHtml);
  
  console.log(`✅ Found ${bomList.length} active BOMs\n`);
  
  if (bomList.length === 0) {
    console.log('No active BOMs found. Debug: saving raw HTML...');
    fs.writeFileSync('bom_debug_list.html', bomListHtml);
    await browser.close();
    return;
  }
  
  // ==================== SCRAPE DETAIL FOR EACH BOM ====================
  console.log(`🔄 Scraping detail for ${bomList.length} BOMs...\n`);
  
  const allBoms = [];
  let count = 0;
  
  for (const bom of bomList) {
    count++;
    
    try {
      // Fetch detail page via fetch() (faster than navigation)
      const detail = await page.evaluate(async (bomId) => {
        try {
          const resp = await fetch(`/master_bom2/add_bom_detail/${bomId}`);
          const html = await resp.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Parse header info
          const header = {};
          doc.querySelectorAll('input[name], textarea[name]').forEach(inp => {
            header[inp.name] = inp.value || inp.textContent?.trim() || '';
          });
          doc.querySelectorAll('select[name]').forEach(sel => {
            const opt = sel.querySelector('option[selected]');
            header[sel.name] = opt ? opt.textContent.trim() : (sel.value || '');
          });
          
          // Parse component rows from table
          const components = [];
          const tables = doc.querySelectorAll('table');
          
          for (const table of tables) {
            const rows = table.querySelectorAll('tbody tr, tr');
            rows.forEach(row => {
              const tds = row.querySelectorAll('td');
              if (tds.length < 5) return;
              
              // Check if first cell is a number (row number)
              const firstCell = tds[0]?.textContent?.trim();
              if (!firstCell || !firstCell.match(/^\d+$/)) return;
              
              // Extract input values from cells
              const getVal = (td) => {
                if (!td) return '';
                const input = td.querySelector('input, select, textarea');
                if (input) {
                  if (input.tagName === 'SELECT') {
                    const opt = input.querySelector('option[selected]');
                    return opt ? opt.textContent.trim() : input.value;
                  }
                  return input.value || '';
                }
                return td.textContent?.trim() || '';
              };
              
              components.push({
                no: firstCell,
                item_code: getVal(tds[2]) || getVal(tds[1]),
                description: getVal(tds[3]) || getVal(tds[2]),
                unit: getVal(tds[4]) || getVal(tds[3]),
                qty: getVal(tds[5]) || getVal(tds[4]),
                use_tolerance: getVal(tds[6]) || '',
                pct_tolerance: getVal(tds[7]) || '',
                tolerance_value: getVal(tds[8]) || '',
                remark: getVal(tds[9]) || '',
              });
            });
          }
          
          return { header, components };
        } catch (e) {
          return { error: e.message, header: {}, components: [] };
        }
      }, bom.id);
      
      allBoms.push({ ...bom, ...detail });
      
      if (count <= 5 || count % 100 === 0 || count === bomList.length) {
        console.log(`[${count}/${bomList.length}] ${bom.bom_code} — ${bom.description.substring(0, 50)} (${detail.components.length} components)`);
      }
    } catch (e) {
      console.error(`[${count}/${bomList.length}] BOM ${bom.id} ERROR: ${e.message}`);
      allBoms.push({ ...bom, header: {}, components: [], error: e.message });
    }
    
    // Small delay every 50 items
    if (count % 50 === 0) {
      process.stdout.write(`  Progress: ${count}/${bomList.length}...\n`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  await browser.close();
  
  // ==================== SAVE RESULTS ====================
  console.log('\n💾 Saving results...');
  
  // JSON
  fs.writeFileSync('bom_data.json', JSON.stringify(allBoms, null, 2));
  console.log(`📁 bom_data.json — ${allBoms.length} BOMs`);
  
  // CSV
  const q = (s) => { if (!s) return ''; return `"${String(s).replace(/"/g, '""')}"`; };
  const csvLines = [
    'BOM_ID,BOM_Code,BOM_Description,BOM_Qty,BOM_Unit,BOM_Version,BOM_Status,BOM_Process,BOM_Line,BOM_Remark,Comp_No,Comp_ItemCode,Comp_Description,Comp_Unit,Comp_Qty,Comp_UseTolerance,Comp_PctTolerance,Comp_ToleranceValue,Comp_Remark'
  ];
  
  for (const bom of allBoms) {
    if (!bom.components || bom.components.length === 0) {
      csvLines.push([
        bom.id, q(bom.bom_code), q(bom.description), q(bom.qty), q(bom.unit), 
        bom.version, q(bom.status), q(bom.process), q(bom.line), q(bom.remark),
        '', '', '', '', '', '', '', '', ''
      ].join(','));
      continue;
    }
    for (const c of bom.components) {
      csvLines.push([
        bom.id, q(bom.bom_code), q(bom.description), q(bom.qty), q(bom.unit),
        bom.version, q(bom.status), q(bom.process), q(bom.line), q(bom.remark),
        c.no, q(c.item_code), q(c.description), q(c.unit), q(c.qty),
        q(c.use_tolerance), q(c.pct_tolerance), q(c.tolerance_value), q(c.remark)
      ].join(','));
    }
  }
  
  fs.writeFileSync('bom_data.csv', csvLines.join('\n'));
  console.log(`📁 bom_data.csv — ${csvLines.length - 1} rows`);
  
  // Summary
  const totalComps = allBoms.reduce((s, b) => s + (b.components?.length || 0), 0);
  const withComps = allBoms.filter(b => b.components?.length > 0).length;
  console.log(`\n📊 Summary:`);
  console.log(`   Total active BOMs: ${allBoms.length}`);
  console.log(`   BOMs with components: ${withComps}`);
  console.log(`   Total component rows: ${totalComps}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
