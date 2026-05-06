/**
 * IDX Broker Scraper — VPS Service
 * 
 * Uses Puppeteer to bypass Cloudflare protection on idx.co.id
 * Fetches broker summary data and stores in MySQL
 * Exposes REST API for FlowTracker frontend
 * 
 * Setup:  npm install && node server.js
 * Cron:   Run daily at 16:45 WIB (after market close)
 */

const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const puppeteer = puppeteerExtra; // alias for backward compat
const path    = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = 3100;
const DB = {
  host: 'localhost',
  user: 'erp_user',
  password: 'ErpSecure2024!',
  database: 'erp_manufacturing',
};

// Index Alpha API — Primary data source for broker summary
const INDEX_ALPHA_KEY = process.env.INDEX_ALPHA_KEY || 'ia_live_RmCCtOrgA0a49n6wchT9yCvU';
const INDEX_ALPHA_BASE = 'https://api.indexalpha.id';

// Top IDX stocks to auto-pull daily
const TOP_STOCKS = [
  'BBCA','BBRI','BMRI','TLKM','ASII','UNVR','GOTO','BREN','AMMN','CUAN',
  'BBNI','BRIS','PGAS','ANTM','INCO','MDKA','PTBA','ADRO','ARTO','BUKA',
  'EMTK','EXCL','ICBP','INDF','KLBF','MAPI','MYOR','SMGR','TPIA','UNTR'
];

const app = express();
app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatVal(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(0) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
function formatLot(n) {
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

let pool;

// ─── Database Setup ───────────────────────────────────────────────────────────
async function setupDB() {
  pool = mysql.createPool(DB);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idx_broker_summary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      broker_code VARCHAR(5) NOT NULL,
      stock_code VARCHAR(10) NOT NULL,
      buy_val BIGINT DEFAULT 0,
      buy_lot BIGINT DEFAULT 0,
      buy_avg DECIMAL(15,2) DEFAULT 0,
      sell_val BIGINT DEFAULT 0,
      sell_lot BIGINT DEFAULT 0,
      sell_avg DECIMAL(15,2) DEFAULT 0,
      net_val BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_date_broker_stock (date, broker_code, stock_code),
      INDEX idx_broker (broker_code),
      INDEX idx_date (date),
      INDEX idx_stock (stock_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS idx_stock_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      stock_code VARCHAR(10) NOT NULL,
      open_price DECIMAL(15,2) DEFAULT 0,
      high_price DECIMAL(15,2) DEFAULT 0,
      low_price DECIMAL(15,2) DEFAULT 0,
      close_price DECIMAL(15,2) DEFAULT 0,
      volume BIGINT DEFAULT 0,
      value BIGINT DEFAULT 0,
      prev_close DECIMAL(15,2) DEFAULT 0,
      change_pct DECIMAL(8,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_date_stock (date, stock_code),
      INDEX idx_stock_date (stock_code, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS idx_scrape_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      type VARCHAR(20) NOT NULL,
      broker_code VARCHAR(5),
      records_count INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      UNIQUE KEY uq_date_type_broker (date, type, broker_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('✅ Database tables ready');
}

// ─── Puppeteer Scraper ────────────────────────────────────────────────────────
async function scrapeBrokerSummary(brokerCode, dateStr) {
  const date = dateStr || getTodayDate();
  const dateCompact = date.replace(/-/g, '');
  console.log(`🔍 Scraping broker ${brokerCode} for ${date}...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });

    const page = await browser.newPage();
    
    // Anti-detection: remove webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Override chrome runtime
      window.chrome = { runtime: {} };
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });
    
    // Set realistic browser environment
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Strategy 1: Navigate to broker summary page, wait for CF challenge
    console.log('  → Navigating to IDX broker summary page...');
    await page.goto('https://www.idx.co.id/en/market-data/trading-summary/broker-summary/', {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    // Wait longer for Cloudflare challenge to fully resolve
    await delay(8000);
    
    // Check if CF challenge passed by looking at page title
    const title = await page.title();
    console.log(`  → Page title: "${title}"`);
    
    if (title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('cloudflare')) {
      console.log('  ⚠️ Cloudflare challenge not resolved, waiting longer...');
      await delay(10000);
      const title2 = await page.title();
      if (title2.toLowerCase().includes('just a moment')) {
        console.log('  ❌ Cloudflare still blocking, trying fallback...');
        return await scrapeViaAlternate(brokerCode, dateCompact, date, browser);
      }
    }

    // Now fetch the API with proper session cookies
    console.log('  → Fetching API data...');
    const apiUrl = `https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?code=${brokerCode}&date=${dateCompact}&length=500&start=0`;
    
    const result = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.idx.co.id/en/market-data/trading-summary/broker-summary/',
          },
        });
        if (!response.ok) return { error: `HTTP ${response.status}`, data: null };
        const text = await response.text();
        try { return { error: null, data: JSON.parse(text) }; }
        catch { return { error: `Not JSON: ${text.slice(0, 100)}`, data: null }; }
      } catch (e) {
        return { error: e.message, data: null };
      }
    }, apiUrl);

    if (result.error) {
      console.log(`  ❌ API error: ${result.error}`);
      
      // Fallback: try to scrape the table from the page directly
      console.log('  → Trying table scrape fallback...');
      return await scrapeTableFallback(page, brokerCode, date);
    }

    const records = parseIDXResponse(result.data, brokerCode, date);
    console.log(`  ✅ Got ${records.length} records from API`);
    
    return records;

  } catch (err) {
    console.error(`  ❌ Scrape error: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// Alternative scrape approach: use intercept to capture XHR data
async function scrapeViaAlternate(brokerCode, dateCompact, date, existingBrowser) {
  console.log('  → Trying alternate scrape via XHR interception...');
  try {
    const page = await existingBrowser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // Set up XHR interception  
    let apiData = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('GetBrokerSummary') && response.status() === 200) {
        try { apiData = await response.json(); } catch(_) {}
      }
    });
    
    // Navigate to page with broker code already set
    const targetUrl = `https://www.idx.co.id/en/market-data/trading-summary/broker-summary/?brokerCode=${brokerCode}&date=${dateCompact}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await delay(10000);
    
    if (apiData) {
      const records = parseIDXResponse(apiData, brokerCode, date);
      console.log(`  ✅ Got ${records.length} records via XHR intercept`);
      return records;
    }
    
    console.log('  → No XHR data captured, trying direct table scrape...');
    return await scrapeTableFallback(page, brokerCode, date);
  } catch(e) {
    console.log(`  ❌ Alternate scrape failed: ${e.message}`);
    return [];
  }
}


// Fallback: scrape from rendered table
async function scrapeTableFallback(page, brokerCode, date) {
  try {
    // Type broker code in the search input
    const inputSelector = 'input[type="text"]';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.click(inputSelector);
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.type(inputSelector, brokerCode);
    
    // Click search/filter button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Search') || text.includes('Cari') || text.includes('Filter'))) {
        await btn.click();
        break;
      }
    }
    
    await delay(3000);

    // Extract table data
    const tableData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const data = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
          data.push({
            stockCode: (cells[0]?.textContent || '').trim(),
            buyVal: parseFloat((cells[1]?.textContent || '0').replace(/[,.]/g, '')) || 0,
            buyLot: parseFloat((cells[2]?.textContent || '0').replace(/[,.]/g, '')) || 0,
            sellVal: parseFloat((cells[3]?.textContent || '0').replace(/[,.]/g, '')) || 0,
            sellLot: parseFloat((cells[4]?.textContent || '0').replace(/[,.]/g, '')) || 0,
          });
        }
      });
      return data;
    });

    console.log(`  → Table fallback got ${tableData.length} rows`);
    return tableData.filter(d => d.stockCode).map(d => ({
      date,
      brokerCode,
      stockCode: d.stockCode,
      buyVal: d.buyVal,
      buyLot: d.buyLot,
      buyAvg: d.buyLot > 0 ? Math.round(d.buyVal / d.buyLot) : 0,
      sellVal: d.sellVal,
      sellLot: d.sellLot,
      sellAvg: d.sellLot > 0 ? Math.round(d.sellVal / d.sellLot) : 0,
      netVal: d.buyVal - d.sellVal,
    }));
  } catch (e) {
    console.log(`  ❌ Table fallback failed: ${e.message}`);
    return [];
  }
}

function parseIDXResponse(json, brokerCode, date) {
  const items = json?.data || json?.Results || json?.Data || [];
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => item.StockCode || item.stockCode || item.Code)
    .map(item => {
      const buyVal  = Number(item.BVal  || item.buyVal  || item.BuyValue  || 0);
      const sellVal = Number(item.SVal  || item.sellVal || item.SellValue || 0);
      const buyLot  = Number(item.BLot  || item.buyLot  || item.BuyVolume || 0);
      const sellLot = Number(item.SLot  || item.sellLot || item.SellVolume|| 0);

      return {
        date,
        brokerCode,
        stockCode: (item.StockCode || item.stockCode || item.Code || '').trim(),
        buyVal,
        buyLot,
        buyAvg: buyLot > 0 ? Math.round(buyVal / buyLot) : 0,
        sellVal,
        sellLot,
        sellAvg: sellLot > 0 ? Math.round(sellVal / sellLot) : 0,
        netVal: buyVal - sellVal,
      };
    });
}

// ─── Save to DB ───────────────────────────────────────────────────────────────
async function saveBrokerData(records) {
  if (!records.length) return 0;

  const values = records.map(r => [
    r.date, r.brokerCode, r.stockCode,
    r.buyVal, r.buyLot, r.buyAvg,
    r.sellVal, r.sellLot, r.sellAvg,
    r.netVal,
  ]);

  const sql = `
    INSERT INTO idx_broker_summary 
      (date, broker_code, stock_code, buy_val, buy_lot, buy_avg, sell_val, sell_lot, sell_avg, net_val)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      buy_val = VALUES(buy_val),
      buy_lot = VALUES(buy_lot),
      buy_avg = VALUES(buy_avg),
      sell_val = VALUES(sell_val),
      sell_lot = VALUES(sell_lot),
      sell_avg = VALUES(sell_avg),
      net_val = VALUES(net_val)
  `;

  const [result] = await pool.query(sql, [values]);
  return result.affectedRows;
}

// ─── Yahoo Finance Prices ─────────────────────────────────────────────────────
async function fetchYahooPrice(ticker) {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}.JK?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;

    return {
      ticker,
      price: meta.regularMarketPrice || 0,
      open: meta.regularMarketOpen || meta.regularMarketPrice || 0,
      high: meta.regularMarketDayHigh || meta.regularMarketPrice || 0,
      low: meta.regularMarketDayLow || meta.regularMarketPrice || 0,
      prevClose: meta.chartPreviousClose || 0,
      volume: meta.regularMarketVolume || 0,
      changePct: meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100)
        : 0,
    };
  } catch { return null; }
}

async function fetchAndSaveStockPrices(tickers) {
  const date = getTodayDate();
  let saved = 0;

  for (const ticker of tickers) {
    const p = await fetchYahooPrice(ticker);
    if (!p) continue;

    await pool.query(`
      INSERT INTO idx_stock_prices (date, stock_code, open_price, high_price, low_price, close_price, volume, prev_close, change_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        open_price = VALUES(open_price), high_price = VALUES(high_price),
        low_price = VALUES(low_price), close_price = VALUES(close_price),
        volume = VALUES(volume), prev_close = VALUES(prev_close), change_pct = VALUES(change_pct)
    `, [date, ticker, p.open, p.high, p.low, p.price, p.volume, p.prevClose, p.changePct]);
    saved++;
  }

  return saved;
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// GET /api/broker-summary?code=MG&date=2026-04-28
// GET /api/broker-summary?code=MG&from=2026-04-20&to=2026-04-29  (range/accumulation mode)
app.get('/api/broker-summary', async (req, res) => {
  const code = (req.query.code || '').toUpperCase();
  const from = req.query.from;
  const to = req.query.to;
  const date = req.query.date || getTodayDate();
  const isRange = from && to && from !== to;

  if (!code || code.length < 2) {
    return res.json({ error: 'Broker code required (2 letters)', data: [] });
  }

  let rows;

  if (isRange) {
    // ─── RANGE / ACCUMULATION MODE ───
    // Aggregate buy/sell across date range using SUM + GROUP BY stock_code
    [rows] = await pool.query(
      `SELECT stock_code,
              SUM(buy_val) as buy_val, SUM(buy_lot) as buy_lot,
              SUM(sell_val) as sell_val, SUM(sell_lot) as sell_lot,
              SUM(buy_val) - SUM(sell_val) as net_val,
              CASE WHEN SUM(buy_lot) > 0 THEN SUM(buy_val) / SUM(buy_lot) ELSE 0 END as buy_avg,
              CASE WHEN SUM(sell_lot) > 0 THEN SUM(sell_val) / SUM(sell_lot) ELSE 0 END as sell_avg,
              COUNT(DISTINCT date) as days_active
       FROM idx_broker_summary
       WHERE broker_code = ? AND date >= ? AND date <= ?
       GROUP BY stock_code
       ORDER BY ABS(SUM(buy_val) - SUM(sell_val)) DESC`,
      [code, from, to]
    );
    console.log(`📊 Range query ${code} [${from} → ${to}]: ${rows.length} stocks`);
  } else {
    // ─── SINGLE DATE MODE ───
    [rows] = await pool.query(
      'SELECT * FROM idx_broker_summary WHERE broker_code = ? AND date = ? ORDER BY ABS(net_val) DESC',
      [code, date]
    );

    // If no data or force refresh, scrape fresh
    const forceRefresh = req.query.refresh === 'true';
    if (rows.length === 0 || forceRefresh) {
      console.log(`📡 No cached data for ${code}/${date}, scraping...`);
      const records = await scrapeBrokerSummary(code, date);
      if (records.length > 0) {
        await saveBrokerData(records);
        [rows] = await pool.query(
          'SELECT * FROM idx_broker_summary WHERE broker_code = ? AND date = ? ORDER BY ABS(net_val) DESC',
          [code, date]
        );
      }
    }
  }

  // Get stock prices for enrichment (use latest date)
  const latestDate = isRange ? to : date;
  const tickers = rows.map(r => r.stock_code);
  const [prices] = tickers.length > 0
    ? await pool.query('SELECT * FROM idx_stock_prices WHERE stock_code IN (?) AND date = ?', [tickers, latestDate])
    : [[]];
  const priceMap = {};
  for (const p of prices) priceMap[p.stock_code] = p;

  const data = rows.map(r => ({
    ticker: r.stock_code,
    action: Number(r.net_val) > 0 ? 'BUY' : Number(r.net_val) < 0 ? 'SELL' : 'NEUTRAL',
    buyVal: formatVal(Number(r.buy_val)),
    buyLot: formatLot(Number(r.buy_lot)),
    buyAvg: Math.round(Number(r.buy_avg)),
    sellVal: formatVal(Number(r.sell_val)),
    sellLot: formatLot(Number(r.sell_lot)),
    sellAvg: Math.round(Number(r.sell_avg)),
    netVal: formatVal(Math.abs(Number(r.net_val))),
    rawBuyVal: Number(r.buy_val),
    rawSellVal: Number(r.sell_val),
    rawNetVal: Number(r.net_val),
    daysActive: r.days_active || 1,
    price: priceMap[r.stock_code]?.close_price || 0,
    changePct: priceMap[r.stock_code]?.change_pct || 0,
  }));

  const dateLabel = isRange ? `${from} → ${to}` : date;

  res.json({
    broker: code,
    date: dateLabel,
    from: isRange ? from : undefined,
    to: isRange ? to : undefined,
    mode: isRange ? 'range' : 'single',
    source: rows.length > 0 ? 'IDX-DB' : 'none',
    count: data.length,
    buyCount: data.filter(d => d.action === 'BUY').length,
    sellCount: data.filter(d => d.action === 'SELL').length,
    data,
  });
});

// GET /api/stock-prices?tickers=BBCA,BBRI
app.get('/api/stock-prices', async (req, res) => {
  const tickers = (req.query.tickers || 'BBCA,BBRI,BMRI,TLKM,GOTO,ANTM,INCO,PGAS').split(',').map(t => t.trim().toUpperCase());
  const date = getTodayDate();

  // Check DB first
  let [rows] = tickers.length > 0
    ? await pool.query('SELECT * FROM idx_stock_prices WHERE stock_code IN (?) AND date = ?', [tickers, date])
    : [[]];

  // Fetch missing from Yahoo
  const found = new Set(rows.map(r => r.stock_code));
  const missing = tickers.filter(t => !found.has(t));

  if (missing.length > 0) {
    console.log(`📡 Fetching ${missing.length} stock prices from Yahoo...`);
    for (const t of missing) {
      const p = await fetchYahooPrice(t);
      if (p) {
        await pool.query(`
          INSERT INTO idx_stock_prices (date, stock_code, open_price, high_price, low_price, close_price, volume, prev_close, change_pct)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE close_price = VALUES(close_price), change_pct = VALUES(change_pct), volume = VALUES(volume)
        `, [date, t, p.open, p.high, p.low, p.price, p.volume, p.prevClose, p.changePct]);
      }
    }
    // Re-fetch from DB
    [rows] = await pool.query('SELECT * FROM idx_stock_prices WHERE stock_code IN (?) AND date = ?', [tickers, date]);
  }

  const data = rows.map(r => ({
    ticker: r.stock_code,
    price: Number(r.close_price),
    change: Number(r.close_price) - Number(r.prev_close),
    changePct: Number(r.change_pct),
    volume: Number(r.volume),
    high: Number(r.high_price),
    low: Number(r.low_price),
    open: Number(r.open_price),
    previousClose: Number(r.prev_close),
  }));

  res.json({
    count: data.length,
    updated: new Date().toISOString(),
    data: data.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
  });
});

// ─── FLOW ANALYZER — Top broker concentration per stock ──────────────────────
app.get('/api/flow-analyzer', async (req, res) => {
  try {
    // Get latest date with data
    const [dateRows] = await pool.query('SELECT DISTINCT date FROM idx_broker_summary ORDER BY date DESC LIMIT 5');
    if (dateRows.length === 0) return res.json({ data: [], source: 'empty' });

    const dates = dateRows.map(r => r.date);
    const latestDate = dates[0];

    // Get top stocks by total value on latest date
    const [stockRows] = await pool.query(`
      SELECT stock_code, SUM(buy_val + sell_val) as total_val, SUM(buy_val) as total_buy, SUM(sell_val) as total_sell
      FROM idx_broker_summary WHERE date = ?
      GROUP BY stock_code ORDER BY total_val DESC LIMIT 20
    `, [latestDate]);

    const result = [];
    for (const stock of stockRows) {
      // Get top 3 broker concentration for each of the last 5 days
      const days = [];
      for (const d of dates) {
        const [brokers] = await pool.query(`
          SELECT broker_code, buy_val, sell_val, (buy_val - sell_val) as net
          FROM idx_broker_summary WHERE date = ? AND stock_code = ?
          ORDER BY (buy_val + sell_val) DESC LIMIT 3
        `, [d, stock.stock_code]);

        const totalVal = brokers.reduce((a, b) => a + Number(b.buy_val) + Number(b.sell_val), 0);
        const stockTotal = Number(stock.total_val) || 1;
        const concentration = totalVal > 0 ? ((totalVal / stockTotal) * 100) : 0;
        const netFlow = brokers.reduce((a, b) => a + Number(b.net), 0);
        days.push(netFlow > 0 ? concentration : -concentration);
      }

      // Get price data
      const [priceRows] = await pool.query(
        'SELECT close_price, change_pct FROM idx_stock_prices WHERE stock_code = ? ORDER BY date DESC LIMIT 1',
        [stock.stock_code]
      );

      result.push({
        ticker: stock.stock_code,
        lastVal: formatVal(Number(stock.total_val)),
        days: days.reverse(), // oldest to newest
        dailyChange: priceRows[0] ? Number(priceRows[0].change_pct) : 0,
        price: priceRows[0] ? Number(priceRows[0].close_price) : 0,
      });
    }

    res.json({ data: result, date: latestDate, dates, source: 'database' });
  } catch (err) {
    console.error('Flow analyzer error:', err.message);
    res.json({ data: [], error: err.message });
  }
});

// ─── ACCUMULATION STREAK — Multi-day consistent buying detection ─────────────
app.get('/api/accumulation-streak', async (req, res) => {
  const streakDays = Number(req.query.days) || 2;
  try {
    const [dateRows] = await pool.query('SELECT DISTINCT date FROM idx_broker_summary ORDER BY date DESC LIMIT ?', [streakDays + 1]);
    if (dateRows.length < streakDays) return res.json({ data: [], source: 'insufficient_data' });

    const dates = dateRows.map(r => r.date).reverse();
    const targetDates = dates.slice(-streakDays);

    // Find broker-stock combos that appear as net buyers on ALL target dates
    const placeholders = targetDates.map(() => '?').join(',');
    const [rows] = await pool.query(`
      SELECT stock_code, broker_code, 
        COUNT(DISTINCT date) as days_active,
        SUM(buy_val) as total_buy_val, SUM(buy_lot) as total_buy_lot,
        SUM(sell_val) as total_sell_val, SUM(sell_lot) as total_sell_lot,
        AVG(buy_avg) as avg_buy_price
      FROM idx_broker_summary 
      WHERE date IN (${placeholders}) AND buy_val > sell_val
      GROUP BY stock_code, broker_code
      HAVING days_active >= ?
      ORDER BY total_buy_val DESC
    `, [...targetDates, streakDays]);

    // Group by stock
    const stockMap = {};
    for (const r of rows) {
      if (!stockMap[r.stock_code]) stockMap[r.stock_code] = { buyers: [], sellers: [] };
      stockMap[r.stock_code].buyers.push({
        code: r.broker_code,
        bVal: formatVal(Number(r.total_buy_val)),
        bLot: formatLot(Number(r.total_buy_lot)),
        avg: Math.round(Number(r.avg_buy_price)),
        rawBuyVal: Number(r.total_buy_val),
      });
    }

    // Also find consistent sellers
    const [sellRows] = await pool.query(`
      SELECT stock_code, broker_code,
        COUNT(DISTINCT date) as days_active,
        SUM(sell_val) as total_sell_val, SUM(sell_lot) as total_sell_lot,
        AVG(sell_avg) as avg_sell_price
      FROM idx_broker_summary
      WHERE date IN (${placeholders}) AND sell_val > buy_val
      GROUP BY stock_code, broker_code
      HAVING days_active >= ?
      ORDER BY total_sell_val DESC
    `, [...targetDates, streakDays]);

    for (const r of sellRows) {
      if (!stockMap[r.stock_code]) stockMap[r.stock_code] = { buyers: [], sellers: [] };
      stockMap[r.stock_code].sellers.push({
        code: r.broker_code,
        sVal: formatVal(Number(r.total_sell_val)),
        sLot: formatLot(Number(r.total_sell_lot)),
        avg: Math.round(Number(r.avg_sell_price)),
      });
    }

    // Build response with price data
    const result = [];
    for (const [stockCode, data] of Object.entries(stockMap)) {
      if (data.buyers.length === 0) continue;
      const [priceRows] = await pool.query(
        'SELECT close_price, change_pct FROM idx_stock_prices WHERE stock_code = ? ORDER BY date DESC LIMIT 1',
        [stockCode]
      );
      const price = priceRows[0] ? Number(priceRows[0].close_price) : 0;
      const totalBuyVal = data.buyers.reduce((a, b) => a + (b.rawBuyVal || 0), 0);

      result.push({
        stockCode,
        lastPrice: price,
        lastValue: formatVal(totalBuyVal),
        buyers: data.buyers.slice(0, 3).map(b => ({
          ...b,
          gainPct: price > 0 && b.avg > 0 ? Number(((price - b.avg) / b.avg * 100).toFixed(2)) : 0,
        })),
        sellers: data.sellers.slice(0, 3),
      });
    }

    result.sort((a, b) => (b.buyers[0]?.rawBuyVal || 0) - (a.buyers[0]?.rawBuyVal || 0));
    res.json({ data: result.slice(0, 15), days: streakDays, dates: targetDates, source: 'database' });
  } catch (err) {
    console.error('Accumulation streak error:', err.message);
    res.json({ data: [], error: err.message });
  }
});

// ─── DASHBOARD SUMMARY — Aggregated market overview ──────────────────────────
app.get('/api/dashboard-summary', async (req, res) => {
  try {
    const date = getTodayDate();

    // Market signals from stock prices
    const [priceRows] = await pool.query(
      'SELECT * FROM idx_stock_prices ORDER BY date DESC, ABS(change_pct) DESC LIMIT 6'
    );
    const signals = priceRows.map(r => ({
      ticker: r.stock_code,
      price: Number(r.close_price),
      change: Number(r.change_pct),
      volume: Number(r.volume),
      signal: Number(r.change_pct) > 2 ? 'ACCUMULATION' : Number(r.change_pct) < -2 ? 'DISTRIBUTION' : 'NEUTRAL',
    }));

    // Active brokers count
    const [brokerCount] = await pool.query('SELECT COUNT(DISTINCT broker_code) as cnt FROM idx_broker_summary');
    // Total stocks tracked
    const [stockCount] = await pool.query('SELECT COUNT(DISTINCT stock_code) as cnt FROM idx_broker_summary');
    // Latest data date
    const [latestDate] = await pool.query('SELECT MAX(date) as latest FROM idx_broker_summary');
    // Total records
    const [totalRec] = await pool.query('SELECT COUNT(*) as cnt FROM idx_broker_summary');

    res.json({
      signals,
      stats: {
        activeBrokers: brokerCount[0]?.cnt || 0,
        trackedStocks: stockCount[0]?.cnt || 0,
        latestDate: latestDate[0]?.latest || date,
        totalRecords: totalRec[0]?.cnt || 0,
      },
      source: signals.length > 0 ? 'database' : 'empty',
    });
  } catch (err) {
    res.json({ signals: [], stats: {}, error: err.message });
  }
});

// GET /api/market-signals
app.get('/api/market-signals', async (req, res) => {
  const date = getTodayDate();
  const [rows] = await pool.query(
    'SELECT * FROM idx_stock_prices WHERE date = ? ORDER BY ABS(change_pct) DESC LIMIT 20',
    [date]
  );

  const data = rows.map(r => ({
    ticker: r.stock_code,
    price: Number(r.close_price),
    change: Number(r.change_pct),
    volume: Number(r.volume),
    signal: r.change_pct > 2 ? 'ACCUMULATION'
          : r.change_pct < -2 ? 'DISTRIBUTION'
          : 'NEUTRAL',
  }));

  res.json({ updated: new Date().toISOString(), count: data.length, data });
});

// POST /api/scrape — Trigger manual scrape
app.post('/api/scrape', async (req, res) => {
  const { brokerCode, date } = req.body;
  if (!brokerCode) return res.json({ error: 'brokerCode required' });

  const records = await scrapeBrokerSummary(brokerCode, date);
  let saved = 0;
  if (records.length > 0) {
    saved = await saveBrokerData(records);
  }

  res.json({ brokerCode, date: date || getTodayDate(), scraped: records.length, saved, success: records.length > 0 });
});

// POST /api/broker-summary/upload — Bulk upload broker data (JSON format)
// Body: { brokerCode: "MG", date: "2026-04-28", records: [{ stockCode, buyVal, buyLot, sellVal, sellLot }, ...] }
app.post('/api/broker-summary/upload', async (req, res) => {
  const { brokerCode, date, records } = req.body;
  if (!brokerCode || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'brokerCode, date, and records[] required' });
  }

  const dateStr = date || getTodayDate();
  const parsed = records.map(r => ({
    date: dateStr,
    brokerCode: brokerCode.toUpperCase(),
    stockCode: (r.stockCode || r.ticker || r.code || '').toUpperCase().trim(),
    buyVal: Number(r.buyVal || r.bVal || 0),
    buyLot: Number(r.buyLot || r.bLot || 0),
    buyAvg: Number(r.buyAvg || 0) || (Number(r.buyLot || 0) > 0 ? Math.round(Number(r.buyVal || 0) / Number(r.buyLot || 0)) : 0),
    sellVal: Number(r.sellVal || r.sVal || 0),
    sellLot: Number(r.sellLot || r.sLot || 0),
    sellAvg: Number(r.sellAvg || 0) || (Number(r.sellLot || 0) > 0 ? Math.round(Number(r.sellVal || 0) / Number(r.sellLot || 0)) : 0),
    netVal: Number(r.buyVal || r.bVal || 0) - Number(r.sellVal || r.sVal || 0),
  })).filter(r => r.stockCode);

  const saved = await saveBrokerData(parsed);
  res.json({ success: true, brokerCode, date: dateStr, uploaded: parsed.length, saved });
});

// POST /api/broker-summary/upload-csv — Upload CSV text directly
// Body: { brokerCode: "MG", date: "2026-04-28", csv: "StockCode,BuyVal,BuyLot,SellVal,SellLot\nBBCA,1000000,500,..." }
app.post('/api/broker-summary/upload-csv', async (req, res) => {
  const { brokerCode, date, csv } = req.body;
  if (!brokerCode || !csv) {
    return res.status(400).json({ error: 'brokerCode and csv text required' });
  }

  const dateStr = date || getTodayDate();
  const lines = csv.trim().split('\n');
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    const row = {};
    header.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    
    const stockCode = (row.stockcode || row.stock_code || row.ticker || row.code || '').toUpperCase();
    if (!stockCode) continue;

    const buyVal = parseFloat((row.buyval || row.bval || row.buy_val || '0').replace(/[^\d.]/g, '')) || 0;
    const buyLot = parseFloat((row.buylot || row.blot || row.buy_lot || '0').replace(/[^\d.]/g, '')) || 0;
    const sellVal = parseFloat((row.sellval || row.sval || row.sell_val || '0').replace(/[^\d.]/g, '')) || 0;
    const sellLot = parseFloat((row.selllot || row.slot || row.sell_lot || '0').replace(/[^\d.]/g, '')) || 0;

    records.push({
      date: dateStr,
      brokerCode: brokerCode.toUpperCase(),
      stockCode,
      buyVal,
      buyLot,
      buyAvg: buyLot > 0 ? Math.round(buyVal / buyLot) : 0,
      sellVal,
      sellLot,
      sellAvg: sellLot > 0 ? Math.round(sellVal / sellLot) : 0,
      netVal: buyVal - sellVal,
    });
  }

  const saved = await saveBrokerData(records);
  res.json({ success: true, brokerCode, date: dateStr, parsed: records.length, saved });
});

// GET /api/available-dates — Show which dates have data
app.get('/api/available-dates', async (req, res) => {
  const code = (req.query.code || '').toUpperCase();
  
  let query = 'SELECT DISTINCT date, COUNT(*) as records FROM idx_broker_summary';
  let params = [];
  if (code) {
    query += ' WHERE broker_code = ?';
    params.push(code);
  }
  query += ' GROUP BY date ORDER BY date DESC LIMIT 30';
  
  const [rows] = await pool.query(query, params);
  res.json({ data: rows.map(r => ({ date: r.date, records: r.records })) });
});

// GET /api/brokers — List brokers with data
app.get('/api/brokers', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT broker_code, COUNT(DISTINCT stock_code) as stocks, COUNT(DISTINCT date) as days, MAX(date) as last_date FROM idx_broker_summary GROUP BY broker_code ORDER BY last_date DESC'
  );
  res.json({ data: rows });
});

// GET /api/brokers-with-data (alias)
app.get('/api/brokers-with-data', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT broker_code, COUNT(DISTINCT stock_code) as stocks, COUNT(DISTINCT date) as days, MAX(date) as last_date FROM idx_broker_summary GROUP BY broker_code ORDER BY last_date DESC'
  );
  res.json({ data: rows });
});

// GET /api/full-broker-list — complete list of all IDX registered brokers
app.get('/api/full-broker-list', (req, res) => {
  res.json({ data: FULL_BROKER_LIST });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'flowtracker-scraper',
    uptime: process.uptime(),
    sectors_api: SECTORS_API_KEY ? 'configured' : 'not_configured',
    total_brokers: FULL_BROKER_LIST.length,
  });
});

// ─── Sectors.app API Integration ─────────────────────────────────────────────
let SECTORS_API_KEY = process.env.SECTORS_API_KEY || '';
const SECTORS_BASE = 'https://api.sectors.app/v1';

// POST /api/sectors/configure — Set API key at runtime from admin panel
app.post('/api/sectors/configure', (req, res) => {
  const { api_key } = req.body;
  if (!api_key || api_key.trim().length < 5) {
    return res.json({ success: false, error: 'Invalid API key' });
  }
  SECTORS_API_KEY = api_key.trim();
  console.log('🔑 Sectors.app API key configured at runtime');
  res.json({ success: true, message: 'API key saved (runtime). Add SECTORS_API_KEY to .env for persistence.' });
});

// POST /api/sectors/pull — Pull data from Sectors.app API (requires API key)
app.post('/api/sectors/pull', async (req, res) => {
  if (!SECTORS_API_KEY) {
    return res.json({
      success: false,
      error: 'Sectors.app API key not configured. Set SECTORS_API_KEY env variable.',
      howto: 'Sign up at https://sectors.app, get API key, then: SECTORS_API_KEY=your_key pm2 restart flowtracker-scraper',
    });
  }

  const { endpoint, params } = req.body;
  const url = `${SECTORS_BASE}/${endpoint || 'companies/'}${params ? '?' + new URLSearchParams(params) : ''}`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': SECTORS_API_KEY },
    });

    if (!response.ok) {
      return res.json({ success: false, error: `Sectors API returned ${response.status}` });
    }

    const data = await response.json();
    res.json({ success: true, data, source: 'sectors.app' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /api/sectors/pull-broker — Pull broker-specific data from Sectors.app
app.post('/api/sectors/pull-broker', async (req, res) => {
  if (!SECTORS_API_KEY) {
    return res.json({ success: false, error: 'Sectors.app API key not configured' });
  }

  const { stock_code, start_date, end_date } = req.body;
  const ticker = stock_code ? `${stock_code}.JK` : 'BBCA.JK';

  try {
    const url = `${SECTORS_BASE}/companies/${ticker}/`;
    const response = await fetch(url, {
      headers: { 'Authorization': SECTORS_API_KEY },
    });

    if (!response.ok) {
      return res.json({ success: false, error: `Sectors API returned ${response.status}` });
    }

    const data = await response.json();
    res.json({ success: true, data, ticker, source: 'sectors.app' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ─── Full Indonesia Broker List ──────────────────────────────────────────────
const FULL_BROKER_LIST = [
  // Top 10 by volume
  { code: "MG", name: "Mirae Asset Sekuritas (Semesta Indovest)", category: "top10" },
  { code: "CC", name: "Mandiri Sekuritas", category: "top10" },
  { code: "YP", name: "Indo Premier Sekuritas", category: "top10" },
  { code: "AK", name: "UBS Sekuritas Indonesia", category: "top10" },
  { code: "ZP", name: "Kim Eng Sekuritas (Maybank)", category: "top10" },
  { code: "PD", name: "CGS-CIMB Sekuritas", category: "top10" },
  { code: "DH", name: "CLSA Sekuritas Indonesia", category: "top10" },
  { code: "DB", name: "Deutsche Sekuritas", category: "top10" },
  { code: "RX", name: "Macquarie Sekuritas Indonesia", category: "top10" },
  { code: "AF", name: "BCA Sekuritas", category: "top10" },
  // Major Institutional
  { code: "AZ", name: "Danareksa Sekuritas", category: "institutional" },
  { code: "KZ", name: "Bahana Sekuritas", category: "institutional" },
  { code: "NI", name: "Shinhan Sekuritas Indonesia", category: "institutional" },
  { code: "KI", name: "Nomura Sekuritas Indonesia", category: "institutional" },
  { code: "TP", name: "Trimegah Sekuritas", category: "institutional" },
  { code: "EP", name: "RHB Sekuritas Indonesia", category: "institutional" },
  { code: "GR", name: "Ciptadana Sekuritas Asia", category: "institutional" },
  { code: "MS", name: "Morgan Stanley Sekuritas", category: "institutional" },
  { code: "CP", name: "JP Morgan Sekuritas Indonesia", category: "institutional" },
  { code: "CS", name: "Credit Suisse Sekuritas", category: "institutional" },
  { code: "BK", name: "BNI Sekuritas", category: "institutional" },
  { code: "LP", name: "Panin Sekuritas", category: "institutional" },
  { code: "YJ", name: "NH Korindo Sekuritas", category: "institutional" },
  { code: "FG", name: "Phillip Sekuritas Indonesia", category: "institutional" },
  { code: "OD", name: "OCBC Sekuritas Indonesia", category: "institutional" },
  { code: "BS", name: "Sinarmas Sekuritas", category: "institutional" },
  // Local/Retail
  { code: "AI", name: "Ajaib Sekuritas Asia", category: "retail" },
  { code: "SQ", name: "Stockbit Sekuritas", category: "retail" },
  { code: "XC", name: "BNI Sekuritas (Sub)", category: "retail" },
  { code: "XL", name: "Macquarie Sekuritas (Sub)", category: "retail" },
  { code: "KK", name: "Mandiri Sekuritas (Online)", category: "retail" },
  { code: "IF", name: "Phintraco Sekuritas", category: "retail" },
  { code: "BZ", name: "KGI Sekuritas Indonesia", category: "retail" },
  { code: "DR", name: "Samuel Sekuritas", category: "retail" },
  { code: "IS", name: "Indo Capital Sekuritas", category: "retail" },
  { code: "EL", name: "Surya Fajar Sekuritas", category: "retail" },
  { code: "RI", name: "BRI Danareksa Sekuritas", category: "retail" },
  // Foreign
  { code: "CG", name: "HSBC Sekuritas Indonesia", category: "foreign" },
  { code: "BW", name: "Citigroup Sekuritas Indonesia", category: "foreign" },
  { code: "GL", name: "Goldman Sachs Sekuritas", category: "foreign" },
  { code: "LG", name: "CIMB-GK Sekuritas", category: "foreign" },
  { code: "DP", name: "DBS Vickers Sekuritas", category: "foreign" },
  { code: "MU", name: "Samsung Sekuritas Indonesia", category: "foreign" },
  { code: "IP", name: "Victoria Sekuritas Indonesia", category: "foreign" },
  { code: "PC", name: "Jasa Utama Capital", category: "foreign" },
  { code: "PF", name: "Waterfront Sekuritas", category: "foreign" },
  { code: "PS", name: "Kresna Sekuritas", category: "foreign" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatVal(val) {
  const n = Number(val);
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
  return n.toString();
}

function formatLot(lot) {
  const n = Number(lot);
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Index Alpha API Integration ─────────────────────────────────────────────
async function fetchIndexAlpha(ticker, fromDate, toDate, investor = 'all') {
  const url = `${INDEX_ALPHA_BASE}/stocks/broker-summary?ticker=${ticker}&from=${fromDate}&to=${toDate || fromDate}&investor=${investor}`;
  console.log(`  📡 IndexAlpha: ${ticker} (${fromDate})...`);
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${INDEX_ALPHA_KEY}`,
        'Accept': 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.log(`    ❌ HTTP ${resp.status}: ${text.slice(0, 100)}`);
      return [];
    }
    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data)) return [];
    
    // Transform to our format: one row per broker for this stock
    return json.data.map(b => ({
      date: fromDate,
      brokerCode: b.code,
      stockCode: ticker,
      buyVal: Math.round(b.buy_value || 0),
      buyLot: Math.round(b.buy_volume || 0),
      buyAvg: Math.round(b.buy_avg || 0),
      sellVal: Math.round(b.sell_value || 0),
      sellLot: Math.round(b.sell_volume || 0),
      sellAvg: Math.round(b.sell_avg || 0),
      netVal: Math.round((b.buy_value || 0) - (b.sell_value || 0)),
    }));
  } catch (err) {
    console.log(`    ❌ IndexAlpha error: ${err.message}`);
    return [];
  }
}

// Pull all broker data for a single stock
async function pullStockFromIndexAlpha(ticker, date) {
  const records = await fetchIndexAlpha(ticker, date);
  if (records.length === 0) return 0;
  const saved = await saveBrokerData(records);
  console.log(`    ✅ ${ticker}: ${saved} broker records saved`);
  return saved;
}

// ─── Auto-Cron: Daily Stock Pull via Index Alpha ─────────────────────────────
let cronRunning = false;
let cronStatus = { lastRun: null, lastResult: null, nextRun: null, running: false };

async function runDailyCron(dateOverride) {
  if (cronRunning) {
    console.log('⏳ Cron already running, skipping...');
    return { skipped: true };
  }
  cronRunning = true;
  cronStatus.running = true;
  const date = dateOverride || getTodayDate();
  console.log(`\n🕐 [CRON] Starting daily pull via Index Alpha for ${date} — ${TOP_STOCKS.length} stocks`);
  
  const results = { date, started: new Date().toISOString(), stocks: {}, totalRecords: 0 };
  
  for (let i = 0; i < TOP_STOCKS.length; i++) {
    const ticker = TOP_STOCKS[i];
    console.log(`  [${i+1}/${TOP_STOCKS.length}] ${ticker}...`);
    
    try {
      // Check if data exists for this stock+date
      const [existing] = await pool.query(
        'SELECT COUNT(*) as cnt FROM idx_broker_summary WHERE stock_code = ? AND date = ?',
        [ticker, date]
      );
      
      if (existing[0].cnt > 5) { // at least 5 brokers already loaded
        results.stocks[ticker] = { status: 'cached', records: existing[0].cnt };
        results.totalRecords += existing[0].cnt;
        console.log(`    → Already has ${existing[0].cnt} records, skipping`);
        continue;
      }
      
      const saved = await pullStockFromIndexAlpha(ticker, date);
      results.stocks[ticker] = { status: saved > 0 ? 'pulled' : 'empty', records: saved };
      results.totalRecords += saved;
    } catch (err) {
      results.stocks[ticker] = { status: 'error', error: err.message };
      console.log(`    → Error: ${err.message}`);
    }
    
    // Small delay between requests
    await delay(500);
  }
  
  // Also fetch stock prices from Yahoo for all stocks
  console.log('  📈 Fetching stock prices from Yahoo...');
  for (const ticker of TOP_STOCKS) {
    try {
      const p = await fetchYahooPrice(ticker);
      if (p) {
        await pool.query(`
          INSERT INTO idx_stock_prices (date, stock_code, open_price, high_price, low_price, close_price, volume, prev_close, change_pct)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE close_price = VALUES(close_price), change_pct = VALUES(change_pct), volume = VALUES(volume)
        `, [date, ticker, p.open, p.high, p.low, p.price, p.volume, p.prevClose, p.changePct]);
      }
    } catch (_) { /* skip individual failures */ }
    await delay(300);
  }
  
  results.completed = new Date().toISOString();
  cronRunning = false;
  cronStatus = { lastRun: results.completed, lastResult: results, nextRun: getNextCronTime(), running: false };
  console.log(`\n✅ [CRON] Complete! ${results.totalRecords} total records for ${date}\n`);
  return results;
}

function getNextCronTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(19, 30, 0, 0); // 19:30 WIB — Index Alpha updates at 19:00 WIB
  if (next <= now) next.setDate(next.getDate() + 1);
  // Skip weekends
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function scheduleDailyCron() {
  const checkInterval = 60000; // check every minute
  cronStatus.nextRun = getNextCronTime();
  
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();
    
    // Run at 19:30 on weekdays (Mon-Fri) — after Index Alpha updates at 19:00
    if (hours === 19 && minutes === 30 && day >= 1 && day <= 5 && !cronRunning) {
      console.log('🕐 [CRON] Scheduled daily pull triggered!');
      runDailyCron().catch(err => console.error('Cron error:', err.message));
    }
  }, checkInterval);
  
  console.log(`   ⏰ Daily cron scheduled for 19:30 WIB (Mon-Fri)`);
  console.log(`   ⏭️  Next run: ${cronStatus.nextRun}`);
}

// ─── Cron API Endpoints ──────────────────────────────────────────────────────

// POST /api/cron/run — Manually trigger daily scrape
app.post('/api/cron/run', async (req, res) => {
  const { date } = req.body;
  if (cronRunning) return res.json({ error: 'Cron already running', status: cronStatus });
  
  // Run async, don't wait
  runDailyCron(date).catch(err => console.error('Manual cron error:', err));
  res.json({ started: true, date: date || getTodayDate(), message: 'Cron started in background' });
});

// GET /api/cron/status — Check cron status
app.get('/api/cron/status', (req, res) => {
  res.json(cronStatus);
});

// GET /api/indexalpha/pull — Pull broker summary for specific stock(s) via Index Alpha
app.get('/api/indexalpha/pull', async (req, res) => {
  const ticker = (req.query.ticker || '').toUpperCase();
  const date = req.query.date || getTodayDate();
  
  if (!ticker) {
    return res.json({ error: 'ticker required (e.g. ?ticker=BBCA&date=2026-04-29)' });
  }
  
  try {
    const saved = await pullStockFromIndexAlpha(ticker, date);
    res.json({ success: true, ticker, date, recordsSaved: saved, source: 'IndexAlpha' });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// GET /api/indexalpha/usage — Check IndexAlpha usage
app.get('/api/indexalpha/usage', async (req, res) => {
  try {
    const resp = await fetch(`${INDEX_ALPHA_BASE}/usage`, {
      headers: { 'Authorization': `Bearer ${INDEX_ALPHA_KEY}`, 'Accept': 'application/json' },
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// GET /api/indexalpha/backfill?days=10&from=2026-04-29 — Backfill historical data
let backfillRunning = false;
app.get('/api/indexalpha/backfill', async (req, res) => {
  const days = parseInt(req.query.days) || 10;
  const fromDate = req.query.from;
  
  if (backfillRunning) {
    return res.json({ error: 'Backfill already running' });
  }
  
  // Generate list of trading days (skip weekends)
  const tradingDays = [];
  const start = fromDate ? new Date(fromDate + 'T12:00:00') : new Date();
  let cursor = new Date(start);
  
  for (let i = 0; tradingDays.length < days; i++) {
    cursor.setDate(cursor.getDate() - (tradingDays.length === 0 && !fromDate ? 0 : 1));
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const dateStr = cursor.toISOString().split('T')[0];
    tradingDays.push(dateStr);
    if (i > 30) break; // safety
  }
  
  console.log(`\n📅 [BACKFILL] Starting for ${tradingDays.length} trading days: ${tradingDays.join(', ')}`);
  res.json({ started: true, tradingDays, estimatedCalls: tradingDays.length * TOP_STOCKS.length });
  
  // Run in background
  backfillRunning = true;
  try {
    for (const date of tradingDays) {
      console.log(`\n📅 [BACKFILL] Processing ${date}...`);
      
      // Check if this date already has decent data
      const [existing] = await pool.query(
        'SELECT COUNT(*) as cnt FROM idx_broker_summary WHERE date = ?', [date]
      );
      if (existing[0].cnt > 100) {
        console.log(`   → ${date}: already has ${existing[0].cnt} records, skipping`);
        continue;
      }
      
      for (let i = 0; i < TOP_STOCKS.length; i++) {
        const ticker = TOP_STOCKS[i];
        try {
          const saved = await pullStockFromIndexAlpha(ticker, date);
          if (saved === 0) {
            // If first stock returns empty, likely no data for this date
            if (i === 0) {
              console.log(`   → ${date}: No data available (market closed?), skipping rest`);
              break;
            }
          }
        } catch (err) {
          console.log(`   → Error ${ticker}/${date}: ${err.message}`);
        }
        await delay(400); // rate limit
      }
    }
    console.log(`\n✅ [BACKFILL] Complete!`);
  } catch (err) {
    console.error(`❌ [BACKFILL] Error: ${err.message}`);
  } finally {
    backfillRunning = false;
  }
});


// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  await setupDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 FlowTracker Scraper API running on port ${PORT}`);
    console.log(`   📊 ${TOP_STOCKS.length} stocks tracked`);
    console.log(`   🔑 IndexAlpha: ${INDEX_ALPHA_KEY ? '✅ configured' : '❌ not configured'}`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /api/broker-summary?code=MG&date=2026-04-29`);
    console.log(`   GET  /api/stock-prices?tickers=BBCA,BBRI,GOTO`);
    console.log(`   GET  /api/market-signals`);
    console.log(`   GET  /api/flow-analyzer`);
    console.log(`   GET  /api/accumulation-streak?days=2`);
    console.log(`   GET  /api/dashboard-summary`);
    console.log(`   POST /api/cron/run — Start daily pull`);
    console.log(`   GET  /api/cron/status — Check cron status`);
    console.log(`   GET  /api/indexalpha/pull?ticker=BBCA&date=2026-04-29`);
    console.log(`   GET  /api/indexalpha/usage — Check API quota`);
    console.log(`   GET  /api/health\n`);
    
    // Start daily cron scheduler
    scheduleDailyCron();
  });
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});

