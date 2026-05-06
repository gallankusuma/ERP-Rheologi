import { Router, Request, Response } from 'express';
import { dbAll } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import https from 'https';

const router = Router();

// ─── AI helper (supports Gemini + OpenAI fallback) ────────────────────────────
async function callAI(prompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Try Gemini first (free tier available), then OpenAI as fallback
  if (geminiKey && geminiKey !== 'your-gemini-api-key-here') {
    try {
      return await callGemini(prompt, geminiKey);
    } catch (geminiErr: any) {
      console.error('[AI] Gemini failed, trying OpenAI fallback:', geminiErr.message);
      if (openaiKey && !openaiKey.startsWith('your-')) {
        return callOpenAI(prompt, openaiKey);
      }
      throw geminiErr;
    }
  }
  if (openaiKey && !openaiKey.startsWith('your-')) {
    return callOpenAI(prompt, openaiKey);
  }
  throw new Error('No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.');
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a procurement assistant for an Indonesian manufacturing company. Always respond in valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'OpenAI API error'));
            return;
          }
          const text = parsed?.choices?.[0]?.message?.content || '';
          resolve(text);
        } catch (e) {
          reject(new Error('Failed to parse OpenAI response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // gemini-2.5-flash may have multiple parts (thinking + response)
          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          // Concatenate all text parts (skip thinking parts if any)
          const text = parts
            .filter((p: any) => p.text !== undefined)
            .map((p: any) => p.text)
            .join('');
          console.log('[Gemini] Parts count:', parts.length, '| Total text length:', text.length);
          if (!text) {
            console.error('[Gemini] Empty response. Full structure:', JSON.stringify(parsed).substring(0, 500));
          }
          resolve(text);
        } catch (e) {
          console.error('[Gemini] Parse error. Raw data (first 500):', data.substring(0, 500));
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── POST /api/ai/price-check ─────────────────────────────────────────────────
// Body: { product_id, product_name, quantity, uom, currency }
router.post('/price-check', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { product_id, product_name, quantity, uom, currency = 'IDR', search_query } = req.body;

    if (!product_name && !search_query) {
      return res.status(400).json({ error: 'product_name or search_query is required' });
    }

    // ── 1. Pull PO history from DB ────────────────────────────────────────────
    let history: any[] = [];
    if (product_id) {
      history = await dbAll(
        `SELECT
           poi.unit_price,
           poi.quantity,
           po.currency,
           po.po_date,
           v.name  AS vendor_name,
           po.type AS po_type
         FROM purchase_order_items poi
         JOIN purchase_orders po ON poi.purchase_order_id = po.id
         JOIN vendors v          ON po.vendor_id          = v.id
         WHERE poi.product_id = ?
         ORDER BY po.po_date DESC
         LIMIT 20`,
        [product_id]
      ) as any[];
    }

    // ── 2. Pull vendor price list (if table exists) ───────────────────────────
    let vendorPrices: any[] = [];
    try {
      if (product_id) {
        vendorPrices = await dbAll(
          `SELECT vp.price, vp.min_qty, vp.lead_time_days, v.name AS vendor_name
           FROM vendor_prices vp
           JOIN vendors v ON vp.vendor_id = v.id
           WHERE vp.product_id = ?
           ORDER BY vp.price ASC`,
          [product_id]
        ) as any[];
      }
    } catch {
      // vendor_prices table may not exist; silently skip
    }

    // ── 3. Compute stats from history ─────────────────────────────────────────
    const prices = history.map((h) => Number(h.unit_price)).filter((p) => p > 0);
    const stats =
      prices.length > 0
        ? {
            count: prices.length,
            avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
            min: Math.min(...prices),
            max: Math.max(...prices),
            latest: prices[0],
          }
        : null;

    // ── 4. Build Gemini prompt ────────────────────────────────────────────────
    const historyText =
      history.length > 0
        ? history
            .slice(0, 10)
            .map(
              (h) =>
                `- ${h.vendor_name}: ${Number(h.unit_price).toLocaleString('id-ID')} ${h.currency} × ${h.quantity} ${uom || ''} (${h.po_date?.slice(0, 10) || '-'})`
            )
            .join('\n')
        : 'Belum ada histori pembelian.';

    const vendorText =
      vendorPrices.length > 0
        ? vendorPrices
            .map(
              (vp) =>
                `- ${vp.vendor_name}: ${Number(vp.price).toLocaleString('id-ID')} ${currency} (min qty: ${vp.min_qty || 1}, lead: ${vp.lead_time_days || '-'} hari)`
            )
            .join('\n')
        : 'Tidak ada data harga vendor.';

    // User search query for additional context
    const searchContext = search_query
      ? `\nUser juga meminta pencarian tambahan dengan kata kunci: "${search_query}"\nGunakan pengetahuanmu untuk mencari harga pasar terkini berdasarkan keyword tersebut.\n`
      : '';

    const prompt = `Kamu adalah asisten pengadaan (procurement) untuk perusahaan manufaktur di Indonesia.

Item yang ingin dibeli:
- Nama: ${product_name || search_query}
- Qty: ${quantity || '?'} ${uom || ''}
- Mata Uang: ${currency}
${searchContext}
Histori pembelian sebelumnya:
${historyText}

Daftar harga vendor (dari master data):
${vendorText}

${
  stats
    ? `Statistik harga historis:
- Jumlah transaksi: ${stats.count}
- Rata-rata: Rp ${stats.avg.toLocaleString('id-ID')}
- Terendah: Rp ${stats.min.toLocaleString('id-ID')}
- Tertinggi: Rp ${stats.max.toLocaleString('id-ID')}
- Harga terakhir: Rp ${stats.latest.toLocaleString('id-ID')}`
    : ''
}

Tolong berikan:
1. **Harga yang direkomendasikan** (satu angka dalam ${currency}) berdasarkan data di atas
2. **Range harga wajar** (min - max)
3. **Analisis singkat** (2-3 kalimat): kenapa harga segitu, tren naik/turun, atau catatan penting
4. **Tips negosiasi** (1-2 tips singkat)

Format jawaban dalam JSON seperti ini (HANYA JSON, tanpa markdown/backtick):
{
  "recommended_price": 45000,
  "price_range": { "min": 42000, "max": 48000 },
  "analysis": "...",
  "negotiation_tips": ["...", "..."],
  "confidence": "high|medium|low"
}`;

    // ── 5. Call Gemini ────────────────────────────────────────────────────────
    let aiResult: any = null;
    let aiError: string | null = null;
    let rawText = '';

    try {
      rawText = await callAI(prompt);
      console.log('[AI Price Check] Raw response (first 500 chars):', rawText.substring(0, 500));
      
      // Strip markdown code block wrapping (```json ... ```)
      let cleanText = rawText;
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleanText = codeBlockMatch[1].trim();
      }
      
      // Extract JSON from the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
        console.log('[AI Price Check] Parsed AI result:', JSON.stringify(aiResult).substring(0, 200));
      } else {
        console.error('[AI Price Check] No JSON found in AI response');
      }
    } catch (e: any) {
      aiError = e.message || 'AI call failed';
      console.error('[AI Price Check] AI error:', e.message);
    }

    // ── 6. Respond ────────────────────────────────────────────────────────────
    res.json({
      data: {
        product_id,
        product_name,
        quantity,
        uom,
        currency,
        history: history.slice(0, 10),
        vendor_prices: vendorPrices,
        stats,
        ai: aiResult,
        ai_error: aiError,
        ai_raw: aiResult ? undefined : rawText?.slice(0, 500),
      },
    });
  } catch (error: any) {
    console.error('[AI Price Check] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to check price' });
  }
});

export default router;
