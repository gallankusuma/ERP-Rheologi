const https = require('https');
let cookies = '';

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const o = {
      hostname: u.hostname, path: u.pathname + u.search, method: opts.method || 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies, ...(opts.headers || {}) },
      rejectUnauthorized: false,
    };
    if (opts.body) { o.headers['Content-Type'] = 'application/x-www-form-urlencoded'; o.headers['Content-Length'] = Buffer.byteLength(opts.body); }
    const r = https.request(o, res => {
      if (res.headers['set-cookie']) cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      let b = ''; res.on('data', d => b += d); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

async function main() {
  // Step 1: GET login page for CSRF
  const lp = await req('https://jbox.salimagrochemical.com/login');
  const csrf = (lp.body.match(/name="_token"[^>]*value="([^"]+)"/) || [])[1] || '';
  console.log('CSRF:', csrf.substring(0, 20) + '...');
  
  // Step 2: POST login
  const loginBody = `_token=${encodeURIComponent(csrf)}&username=${encodeURIComponent('adi anggoro10')}&password=123456`;
  const lr = await req('https://jbox.salimagrochemical.com/login', { method: 'POST', body: loginBody });
  console.log('Login status:', lr.status, 'Redirect:', (lr.headers.location || 'none'));
  
  // Step 3: Follow redirect
  if (lr.headers.location) {
    const redir = lr.headers.location.startsWith('http') ? lr.headers.location : 'https://jbox.salimagrochemical.com' + lr.headers.location;
    await req(redir);
    console.log('Followed redirect to', redir);
  }
  
  // Step 4: GET BOM page
  const bl = await req('https://jbox.salimagrochemical.com/master_bom2');
  console.log('BOM GET status:', bl.status, 'body length:', bl.body.length);
  
  const links1 = (bl.body.match(/add_bom_detail\/\d+/g) || []);
  console.log('Links on GET:', links1.length);
  
  // Step 5: Extract CSRF from BOM page
  const bomCsrf = (bl.body.match(/name="_token"[^>]*value="([^"]+)"/) || [])[1] || '';
  console.log('BOM page CSRF:', bomCsrf.substring(0, 20) + '...');
  
  // Step 6: POST search
  const searchBody = `_token=${encodeURIComponent(bomCsrf)}&process=&line_id=&bom_code=&bom_desc=&rm_code=&rm_desc=&status=&version_from=&version_to=`;
  const sr = await req('https://jbox.salimagrochemical.com/master_bom2', { method: 'POST', body: searchBody });
  console.log('Search POST status:', sr.status, 'body length:', sr.body.length);
  
  const links2 = (sr.body.match(/add_bom_detail\/\d+/g) || []);
  console.log('Links on POST:', links2.length);
  if (links2.length > 0) console.log('Sample:', links2.slice(0, 5));
  
  // Step 7: Try a detail page
  if (links2.length > 0) {
    const firstId = links2[0].match(/\d+/)[0];
    console.log('\nFetching detail for ID:', firstId);
    const detail = await req(`https://jbox.salimagrochemical.com/master_bom2/add_bom_detail/${firstId}`);
    console.log('Detail status:', detail.status, 'body length:', detail.body.length);
    
    // Print first 500 chars of the detail body to see structure
    const bodySnippet = detail.body.substring(0, 2000);
    console.log('\n--- Detail body snippet ---');
    console.log(bodySnippet);
  }
}

main().catch(console.error);
