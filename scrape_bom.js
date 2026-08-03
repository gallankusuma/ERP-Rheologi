/**
 * JBox BOM Scraper v4 — HTTP with proper cookie management
 * Only scrapes ACTIVE BOMs + detail components
 */
const https = require('https');
const fs = require('fs');

const BASE = 'https://jbox.salimagrochemical.com';
let cookies = {};

function getCookieHeader() {
  return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
}

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const o = {
      hostname: u.hostname, path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': getCookieHeader(),
        ...(opts.headers || {}),
      },
      rejectUnauthorized: false,
    };
    if (opts.body) {
      o.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      o.headers['Content-Length'] = Buffer.byteLength(opts.body);
    }
    const r = https.request(o, res => {
      if (res.headers['set-cookie']) {
        for (const c of res.headers['set-cookie']) {
          const part = c.split(';')[0];
          const i = part.indexOf('=');
          if (i > 0) cookies[part.substring(0, i)] = part.substring(i + 1);
        }
      }
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login() {
  console.log('🔑 Login...');
  await req(`${BASE}/user/login`);
  const lr = await req(`${BASE}/user/login_to_bcrypt`, {
    method: 'POST',
    body: 'username=adi+anggoro10&password=123456&submit=Submit',
  });
  if (lr.status === 302) {
    const loc = lr.headers.location || '';
    const redir = loc.startsWith('http') ? loc : `${BASE}${loc}`;
    await req(redir);
    console.log('✅ Login success! Redirect:', loc);
    return true;
  }
  console.log('❌ Login failed:', lr.status);
  return false;
}

async function main() {
  if (!await login()) return;
  
  // Step 1: Get BOM list via AJAX endpoint
  console.log('\n📋 Fetching BOM list (active only)...');
  const listRes = await req(`${BASE}/master_bom2/list_data_ajax`);
  console.log('   List page:', listRes.status, listRes.body.length, 'chars');
  
  if (listRes.body.includes('Portal Login')) {
    console.log('❌ Session expired. Retry login...');
    return;
  }
  
  // Parse all BOM rows — only Active
  const bomList = [];
  const html = listRes.body;
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const tr = trMatch[1];
    const linkMatch = tr.match(/add_bom_detail\/(\d+)/);
    if (!linkMatch) continue;
    
    const tds = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(tr)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
    
    const status = (tds[7] || '').trim();
    if (status.toLowerCase() !== 'active') continue;
    
    bomList.push({
      id: parseInt(linkMatch[1]),
      bom_code: tds[2] || '',
      description: tds[3] || '',
      qty: tds[4] || '',
      unit: tds[5] || '',
      version: tds[6] || '',
      status: status,
      process: tds[8] || '',
      line: tds[9] || '',
      remark: tds[10] || '',
    });
  }
  
  console.log(`✅ Found ${bomList.length} active BOMs\n`);
  
  if (bomList.length === 0) {
    fs.writeFileSync('bom_debug_list.html', html);
    console.log('Saved debug HTML. Check bom_debug_list.html');
    return;
  }
  
  // Step 2: Fetch detail for each BOM
  console.log(`🔄 Scraping ${bomList.length} BOM details...\n`);
  const allBoms = [];
  let count = 0;
  let totalComps = 0;
  
  for (const bom of bomList) {
    count++;
    try {
      const dRes = await req(`${BASE}/master_bom2/add_bom_detail/${bom.id}`);
      const dHtml = dRes.body;
      
      // Parse header
      const header = {};
      const inputRx = /name="([^"]+)"[^>]*value="([^"]*)"/gi;
      let im;
      while ((im = inputRx.exec(dHtml)) !== null) {
        if (!im[1].endsWith('[]')) header[im[1]] = im[2];
      }
      const textareaRx = /name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/gi;
      let tm;
      while ((tm = textareaRx.exec(dHtml)) !== null) {
        header[tm[1]] = tm[2].trim();
      }
      
      // Parse component rows
      const components = [];
      const dTrRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let dTrMatch;
      while ((dTrMatch = dTrRx.exec(dHtml)) !== null) {
        const row = dTrMatch[1];
        const cells = [];
        const dTdRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let dTdMatch;
        while ((dTdMatch = dTdRx.exec(row)) !== null) {
          // Get input value first, fallback to text
          const inputVal = (dTdMatch[1].match(/value="([^"]*)"/) || [])[1];
          const selVal = (dTdMatch[1].match(/<option[^>]*selected[^>]*>([^<]*)/) || [])[1];
          const text = dTdMatch[1].replace(/<[^>]+>/g, '').trim();
          cells.push(inputVal !== undefined ? inputVal : (selVal || text));
        }
        
        // Valid component row: first cell is a number
        if (cells.length >= 6 && cells[0].match(/^\d+$/)) {
          components.push({
            no: cells[0],
            item_code: cells[2] || cells[1] || '',
            description: cells[3] || cells[2] || '',
            unit: cells[4] || cells[3] || '',
            qty: cells[5] || cells[4] || '',
            use_tolerance: cells[6] || '',
            pct_tolerance: cells[7] || '',
            tolerance_value: cells[8] || '',
            remark: cells[9] || '',
          });
        }
      }
      
      totalComps += components.length;
      allBoms.push({ ...bom, header, components });
      
      if (count <= 5 || count % 100 === 0 || count === bomList.length) {
        console.log(`[${count}/${bomList.length}] ${bom.bom_code} — ${bom.description.substring(0,40)} (${components.length} comps)`);
      }
    } catch (e) {
      console.error(`[${count}] BOM ${bom.id} ERROR: ${e.message}`);
      allBoms.push({ ...bom, header: {}, components: [], error: e.message });
    }
    
    if (count % 50 === 0) {
      process.stdout.write(`  [${count}/${bomList.length}] ${totalComps} total comps...\n`);
      await sleep(500);
    }
  }
  
  // Save
  console.log('\n💾 Saving...');
  fs.writeFileSync('bom_data.json', JSON.stringify(allBoms, null, 2));
  
  const q = s => { if (!s) return ''; return `"${String(s).replace(/"/g, '""')}"`; };
  const csv = ['BOM_ID,BOM_Code,BOM_Description,BOM_Qty,BOM_Unit,BOM_Version,BOM_Status,BOM_Process,BOM_Line,BOM_Remark,Comp_No,Comp_ItemCode,Comp_Description,Comp_Unit,Comp_Qty,Comp_UseTolerance,Comp_PctTolerance,Comp_ToleranceValue,Comp_Remark'];
  for (const b of allBoms) {
    if (!b.components?.length) {
      csv.push([b.id, q(b.bom_code), q(b.description), q(b.qty), q(b.unit), b.version, q(b.status), q(b.process), q(b.line), q(b.remark), '', '', '', '', '', '', '', '', ''].join(','));
      continue;
    }
    for (const c of b.components) {
      csv.push([b.id, q(b.bom_code), q(b.description), q(b.qty), q(b.unit), b.version, q(b.status), q(b.process), q(b.line), q(b.remark), c.no, q(c.item_code), q(c.description), q(c.unit), q(c.qty), q(c.use_tolerance), q(c.pct_tolerance), q(c.tolerance_value), q(c.remark)].join(','));
    }
  }
  fs.writeFileSync('bom_data.csv', csv.join('\n'));
  
  const withC = allBoms.filter(b => b.components?.length > 0).length;
  console.log(`\n📊 Summary:`);
  console.log(`   Active BOMs: ${allBoms.length}`);
  console.log(`   With components: ${withC}`);
  console.log(`   Total components: ${totalComps}`);
  console.log(`   Files: bom_data.json, bom_data.csv`);
}

main().catch(e => console.error('Fatal:', e));
