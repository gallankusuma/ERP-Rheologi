/**
 * FBox Specification Scraper - Optimized 
 * Scrapes product specification data from fbox.salimagrochemical.com
 * 
 * Usage: node scrape_fbox_spec.js
 * Output: spec_data.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'https://fbox.salimagrochemical.com';
const LOGIN_URL = BASE_URL + '/login';
const LIST_URL = BASE_URL + '/ck_spesifikasi';
const USERNAME = 'adi anggoro10';
const PASSWORD = '123456';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page) {
  console.log('[LOGIN] Navigating to login page...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(2000);
  
  // Wait for button to be enabled (jQuery removes disabled attr after page load)
  await page.waitForFunction(() => {
    const btn = document.querySelector('.btn-login');
    return btn && !btn.disabled;
  }, { timeout: 10000 });
  
  await page.type('input[name="username"]', USERNAME, { delay: 20 });
  await page.type('input[name="password"]', PASSWORD, { delay: 20 });
  
  // The form uses submitForm() which does an AJAX POST to /ck_user/login
  // We need to click the button and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    page.click('.btn-login'),
  ]);
  await delay(2000);
  
  // Verify login - check if we see dashboard content
  const url = page.url();
  console.log(`[LOGIN] Current URL: ${url}`);
  if (url.includes('login') || url === BASE_URL + '/') {
    // May need to manually navigate after AJAX login
    await page.goto(BASE_URL + '/ck_spesifikasi', { waitUntil: 'networkidle2', timeout: 30000 });
  }
  console.log('[LOGIN] Logged in successfully');
  await delay(1000);
}

async function getActiveSpecIds(page) {
  console.log('[LIST] Getting active specification IDs...');
  await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(2000);

  // Click submit to load all specs
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);
    await delay(3000);
  } catch (e) {
    console.log('[LIST] No submit button found, page may already be loaded');
  }

  // Get all spec IDs from edit links
  const specIds = await page.evaluate(() => {
    const ids = new Set();
    document.querySelectorAll('a[href*="/ck_spesifikasi/edit/"]').forEach(link => {
      const m = link.href.match(/\/ck_spesifikasi\/edit\/(\d+)/);
      if (m) ids.add(parseInt(m[1]));
    });
    return Array.from(ids).sort((a, b) => a - b);
  });

  console.log(`[LIST] Found ${specIds.length} spec IDs`);
  return specIds;
}

async function scrapeSpecDetail(page, specId) {
  const url = `${BASE_URL}/ck_spesifikasi/edit/${specId}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await delay(1000);

  const data = await page.evaluate((sid) => {
    const spec = { fbox_id: sid };

    // === HEADER FIELDS ===
    // No Documents - readonly input
    const allInputs = document.querySelectorAll('input.form-control');
    const labels = document.querySelectorAll('label, .control-label');
    
    // Try to find "No. Documents" field by looking at form layout
    // The first input usually has the doc number
    const docInput = allInputs[0]; // Usually S-FPL-xxxx
    if (docInput) spec.doc_number = docInput.value.trim();
    
    // Alternative: scan all inputs for pattern S-xxx
    if (!spec.doc_number || !spec.doc_number.startsWith('S-')) {
      allInputs.forEach(inp => {
        if (inp.value && inp.value.match(/^S-[A-Z]+-[A-Z0-9]+/)) {
          spec.doc_number = inp.value.trim();
        }
      });
    }

    // Date (id=tgl)
    const tglInput = document.getElementById('tgl');
    spec.doc_date = tglInput ? tglInput.value.trim() : '';

    // Jenis Proses (select)
    const selects = document.querySelectorAll('select.form-control');
    if (selects.length >= 1) {
      const jpSelect = selects[0]; // First select is usually Jenis Proses
      const opt = jpSelect.options[jpSelect.selectedIndex];
      spec.process_type = opt ? opt.text.trim() : '';
      spec.process_type_code = opt ? opt.value : '';
    }

    // Keterangan (id=ket)
    const ketInput = document.getElementById('ket');
    spec.notes = ketInput ? ketInput.value.trim() : '';

    // Nama Sample (id=nama_sample)
    const namaSample = document.getElementById('nama_sample');
    spec.sample_name = namaSample ? namaSample.value.trim() : '';

    // Jenis Sample (second select)
    if (selects.length >= 2) {
      const jsSelect = selects[1]; // Second select
      const opt = jsSelect.options[jsSelect.selectedIndex];
      spec.sample_type = opt ? opt.text.trim() : '';
      spec.sample_type_code = opt ? opt.value : '';
    }

    // Active - look for input with value "Yes"/"No" 
    allInputs.forEach(inp => {
      if (inp.value === 'Yes' || inp.value === 'No') {
        // Check if label nearby says "Active"
        const parent = inp.closest('.form-group, .row, td, div');
        const lbl = parent ? parent.querySelector('label') : null;
        if (lbl && lbl.textContent.includes('Active')) {
          spec.active = inp.value === 'Yes' ? 1 : 0;
        } else if (spec.active === undefined) {
          spec.active = inp.value === 'Yes' ? 1 : 0;
        }
      }
    });
    if (spec.active === undefined) spec.active = 1;

    // Revision info
    allInputs.forEach(inp => {
      const val = inp.value.trim();
      const prevSib = inp.previousElementSibling;
      const prevText = prevSib ? prevSib.textContent.trim() : '';
      
      if (prevText.includes('Revisi No')) spec.revision_no = parseInt(val) || 0;
      if (prevText.includes('Revisi By')) spec.revision_by = val;
      if (prevText.includes('Tgl Revisi')) spec.revision_date = val;
      if (prevText === 'Revisi') spec.revision = val === 'Yes' ? 1 : 0;
      if (prevText.includes('Approve #1 By')) spec.approve_1_by = val;
      if (prevText.includes('Approve #1') && !prevText.includes('By') && !prevText.includes('Date')) {
        spec.approve_1 = val === 'Yes' ? 1 : 0;
      }
    });

    // === DETAIL SAMPLES ===
    spec.samples = [];
    
    // Find the Details Samples tab content (#home)
    const homeTab = document.getElementById('home');
    if (homeTab) {
      // Find sample rows - they are in a table under #home
      const tables = homeTab.querySelectorAll('table');
      
      tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th'))
          .map(th => th.textContent.trim().toLowerCase());
        const headerJoined = headers.join('|');
        
        // Sample table has "no sample" or "name sample"
        if (headerJoined.includes('no sample') || headerJoined.includes('name sample')) {
          const rows = table.querySelectorAll('tbody > tr');
          rows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 7) {
              // Cell order: No., Action, No Sample, Name Sample, Sample Point, Jenis Sample, Status Spek, Status Off Spek
              // But first 2 might be No. and Action (with buttons)
              let startIdx = 0;
              // Skip No. column and Action column
              cells.forEach((c, ci) => {
                if (c.querySelector('button, a.btn') && ci < 3) startIdx = ci + 1;
              });
              
              const sample = {
                sort_order: idx + 1,
                sample_code: cells[startIdx]?.textContent.trim() || '',
                sample_name: cells[startIdx + 1]?.textContent.trim() || '',
                sample_point: cells[startIdx + 2]?.textContent.trim() || '',
                sample_type: cells[startIdx + 3]?.textContent.trim() || '',
                status_spek: cells[startIdx + 4]?.textContent.trim() || '',
                status_off_spek: cells[startIdx + 5]?.textContent.trim() || '',
                brand: '',
                parameters: []
              };
              
              // Check if there's a nested table for parameters
              const nestedTables = row.querySelectorAll('table');
              nestedTables.forEach(nt => {
                const ntHeaders = Array.from(nt.querySelectorAll('th'))
                  .map(th => th.textContent.trim().toLowerCase());
                if (ntHeaders.join('|').includes('parameter') && ntHeaders.join('|').includes('metode')) {
                  const paramRows = nt.querySelectorAll('tbody > tr');
                  paramRows.forEach((pr, pi) => {
                    const pCells = Array.from(pr.querySelectorAll('td'));
                    if (pCells.length >= 6) {
                      let pStart = 0;
                      pCells.forEach((c, ci) => {
                        if (c.querySelector('button, a.btn') && ci < 3) pStart = ci + 1;
                      });
                      
                      sample.parameters.push({
                        sort_order: pi + 1,
                        parameter_name: pCells[pStart]?.textContent.trim() || '',
                        method: pCells[pStart + 1]?.textContent.trim() || '',
                        unit: pCells[pStart + 2]?.textContent.trim() || '',
                        specification: pCells[pStart + 3]?.textContent.trim() || '',
                        frequency: pCells[pStart + 4]?.textContent.trim() || '',
                        setup_type: pCells[pStart + 5]?.textContent.trim() || '',
                        active: pCells[pStart + 6]?.textContent.trim() || 'Yes'
                      });
                    }
                  });
                }
              });
              
              spec.samples.push(sample);
            }
          });
        }
      });
    }
    
    // Also try direct approach - look for all tables with Parameter header
    if (spec.samples.length === 0) {
      // Fallback: parse any table structure
      const allTables = document.querySelectorAll('table');
      allTables.forEach(table => {
        const ths = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        if (ths.includes('No Sample') || ths.includes('Name Sample')) {
          table.querySelectorAll('tbody > tr').forEach((row, idx) => {
            const tds = Array.from(row.querySelectorAll(':scope > td'));
            if (tds.length >= 5) {
              spec.samples.push({
                sort_order: idx + 1,
                sample_code: tds[2]?.textContent.trim() || tds[1]?.textContent.trim() || '',
                sample_name: tds[3]?.textContent.trim() || tds[2]?.textContent.trim() || '',
                sample_point: tds[4]?.textContent.trim() || tds[3]?.textContent.trim() || '',
                sample_type: tds[5]?.textContent.trim() || tds[4]?.textContent.trim() || '',
                brand: '',
                parameters: []
              });
            }
          });
        }
      });
    }

    // === DETAIL ITEMS ===
    spec.items = [];
    
    const brgTab = document.getElementById('brg');
    if (brgTab) {
      const tables = brgTab.querySelectorAll('table');
      tables.forEach(table => {
        const ths = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        if (ths.includes('Item Code') || ths.includes('Item Description')) {
          table.querySelectorAll('tbody > tr').forEach(row => {
            const tds = Array.from(row.querySelectorAll('td'));
            if (tds.length >= 4) {
              const code = tds[2]?.textContent.trim() || tds[1]?.textContent.trim() || '';
              const desc = tds[3]?.textContent.trim() || tds[2]?.textContent.trim() || '';
              const unit = tds[4]?.textContent.trim() || tds[3]?.textContent.trim() || '';
              if (code && code.length > 3) {
                spec.items.push({ item_code: code, item_description: desc, unit: unit });
              }
            }
          });
        }
      });
    }

    return spec;
  }, specId);

  return data;
}

async function main() {
  const testMode = process.argv.includes('--test');
  const testId = parseInt(process.argv.find(a => a.match(/^\d+$/))) || 520;
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    await login(page);

    if (testMode) {
      // Test single spec
      console.log(`\n[TEST] Scraping spec ID ${testId}...\n`);
      const spec = await scrapeSpecDetail(page, testId);
      console.log(JSON.stringify(spec, null, 2));
      console.log(`\nSamples: ${spec.samples.length}, Items: ${spec.items.length}`);
      spec.samples.forEach((s, i) => {
        console.log(`  Sample ${i+1}: ${s.sample_code} - ${s.parameters.length} params`);
      });
      fs.writeFileSync('spec_test.json', JSON.stringify(spec, null, 2), 'utf8');
      console.log('[TEST] Saved spec_test.json');
      await browser.close();
      return;
    }

    // Full scrape
    const specIds = await getActiveSpecIds(page);
    console.log(`\n[SCRAPE] Starting to scrape ${specIds.length} specifications...\n`);

    const allSpecs = [];
    let successCount = 0, errorCount = 0;

    for (let i = 0; i < specIds.length; i++) {
      const sid = specIds[i];
      try {
        process.stdout.write(`\r[SCRAPE] ${i + 1}/${specIds.length} - ID ${sid}...                    `);
        const spec = await scrapeSpecDetail(page, sid);
        allSpecs.push(spec);
        successCount++;
        
        // Save progress every 50
        if (successCount % 50 === 0) {
          fs.writeFileSync('spec_data_progress.json', JSON.stringify(allSpecs, null, 2), 'utf8');
          console.log(`\n[PROGRESS] Saved ${successCount} specs`);
        }
      } catch (err) {
        console.log(`\n[ERROR] Spec ID ${sid}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n\n[DONE] Scraped ${successCount} specs, ${errorCount} errors`);

    fs.writeFileSync('spec_data.json', JSON.stringify(allSpecs, null, 2), 'utf8');
    console.log(`[SAVED] spec_data.json (${allSpecs.length} specs)`);

    // Stats
    let totalSamples = 0, totalParams = 0, totalItems = 0;
    allSpecs.forEach(s => {
      totalSamples += (s.samples || []).length;
      s.samples?.forEach(sm => totalParams += (sm.parameters || []).length);
      totalItems += (s.items || []).length;
    });
    console.log(`[STATS] Specs: ${allSpecs.length}, Samples: ${totalSamples}, Parameters: ${totalParams}, Items: ${totalItems}`);

  } catch (err) {
    console.error('[FATAL]', err);
  } finally {
    await browser.close();
  }
}

main();
