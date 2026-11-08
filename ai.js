// api/ai.js
// Gemini AI موحّد: chat + analyze + analytics + read-label

import { getClientIp } from './_turnstile.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const mode = (req.query && req.query.mode) || (req.body && req.body.mode);

  // الفحص التشخيصي يعمل بـGET مباشرة من شريط المتصفح
  if (mode === 'diag') return handleDiag(req, res);
  if (mode === 'vtest') return handleVTest(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }


  // 🔒 حد المحاولات — fail-open: لا نُعطّل الخدمة إن تعذّر الفحص
  try {
    const __ip = getClientIp(req) || 'unknown';
    const __rl = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ p_key: 'ai:' + __ip, p_limit: 15, p_window_seconds: 60 })
    });
    if (__rl.ok) {
      const __allowed = await __rl.json();
      if (__allowed === false) {
        return res.status(429).json({ status: 'ERROR', message: 'Trop de requêtes. Réessayez dans une minute.' });
      }
    }
  } catch (__e) {
    console.warn('rate limit skipped:', __e && __e.message);
  }

  if (mode === 'chat')         return handleChat(req, res);
  if (mode === 'analyze')      return handleAnalyze(req, res);
  if (mode === 'vtest')        return handleVTest(req, res);
  if (mode === 'analytics')  return handleAnalytics(req, res);
  if (mode === 'read-label') return handleReadLabel(req, res);

  return res.status(400).json({ status: 'ERROR', message: 'Mode invalide' });
}

// ============================================================
// دالة مساعدة: جلب الموديلات المتاحة لمفتاحك
// ============================================================
async function getAvailableModels(apiKey) {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const models = (listData.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      if (models.length > 0) return models;
    }
  } catch (e) { console.warn("List models error:", e); }
  
  // احتياط في حال فشل الجلب
  return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-2.0-flash'];
}

// ============================================================
// MODE 1: CHAT
// ============================================================
async function handleChat(req, res) {
  try {
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ status: 'ERROR', message: 'Message manquant' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });

    let systemPrompt = `Tu es l'assistant virtuel officiel de "ORDIZ". Réponds en 2-3 phrases maximum, dans la langue du client.`;
    if (context && context.brand) {
      systemPrompt += `\nProduit actuel: ${context.brand} - ${context.product_name || ''}`;
    }

    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role === 'user' || h.role === 'model') contents.push({ role: h.role, parts: [{ text: String(h.text || '').slice(0, 500) }] });
      });
    }
    contents.push({ role: 'user', parts: [{ text: message.trim().slice(0, 1000) }] });

    const models = await getAvailableModels(GEMINI_API_KEY);
    let geminiData = null;
    let lastError = null;

    for (const model of models) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: contents })
        });
        if (r.ok) { geminiData = await r.json(); break; }
        else { lastError = await r.text(); }
      } catch (e) { lastError = String(e); }
    }

    if (!geminiData) return res.status(500).json({ status: 'ERROR', message: 'Gemini error', detail: lastError });

    let reply = geminiData.candidates[0].content.parts.map(p => p.text || '').join('').trim();
    if (!reply) reply = "Désolé, je n'ai pas compris.";

    return res.status(200).json({ status: 'OK', reply: reply });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: String(error).slice(0, 200) });
  }
}

// ============================================================
// ============================================================
// تحليل احتياطي عبر Google Gemini (عند فشل المزوّد الأساسي)
// ============================================================

// اختيار أفضل نموذج flash متاح — يتكيّف مع تحديثات Google تلقائياً
async function pickFlashModels(key) {
  const fallback = ["gemini-3.8-flash", "gemini-3-flash", "gemini-2.5-pro"];
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + key;
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      const names = (j.models || [])
        .filter(function (m) { return (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1; })
        .map(function (m) { return String(m.name).replace("models/", ""); })
        .filter(function (n) {
          return /gemini/i.test(n) && /flash|pro/i.test(n) && !/image|tts|embedding|aqa|audio|thinking/i.test(n);
        });

      if (names.length) {
        names.sort(function (a, b) {
          const va = parseFloat((a.match(/(\d+\.\d+|\d+)/) || [0, 0])[1]) || 0;
          const vb = parseFloat((b.match(/(\d+\.\d+|\d+)/) || [0, 0])[1]) || 0;
          return vb - va;
        });
        // الأحدث أولاً + بقية الخيارات
        return names.slice(0, 4).concat(fallback);
      }
    }
  } catch (e) {}
  return fallback;
}

// إعادة محاولة عند 503 (ازدحام مؤقت)
async function fetchWithRetry(url, options, attempts) {
  let last = null;
  for (let i = 0; i < (attempts || 3); i++) {
    try {
      const r = await fetch(url, options);
      if (r.status !== 503) return r;
      last = r;
    } catch (e) {
      last = null;
    }
    await new Promise(function (res) { setTimeout(res, 700 * (i + 1)); });
  }
  return last;
}


let GEMINI_ERRORS = [];

async function analyzeWithGemini(mimeType, base64Data, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  GEMINI_ERRORS = [];
  let available = [];
  try {
    available = await getAvailableModels(key);
  } catch (e) {
    console.warn('Liste des modèles indisponible:', String(e).slice(0, 100));
  }

  const vision = available.filter(function (m) {
    return /gemini/i.test(m) && !/embedding|aqa|imagen|veo/i.test(m);
  });
  const preferred = vision.filter(function (m) { return /2\.5-flash|2\.0-flash/i.test(m); });
  const rest = vision.filter(function (m) { return preferred.indexOf(m) === -1; });

  let models = preferred.concat(rest);
  models = models.filter(function (m, i) { return models.indexOf(m) === i; }).slice(0, 5);
  if (!models.length) models = (await pickFlashModels(key)).slice(0, 4);

  for (const model of models) {
    let controller = null, timeoutId = null;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(function () { controller.abort(); }, 25000);

      // نوقف "التفكير" دائماً: يستهلك رصيد الإخراج ويعيد نصاً فارغاً
      const gen = {
        temperature: 0.1,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 }
      };

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: gen
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      let raw = await r.text();

      // إن رُفض thinkingConfig (400) → أعد المحاولة بدونه
      if (!r.ok && r.status === 400 && /thinking/i.test(raw)) {
        const gen2 = { temperature: 0.1, maxOutputTokens: 4096 };
        const r2 = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
              generationConfig: gen2
            })
          }
        );
        raw = await r2.text();
        if (r2.ok) {
          let jr2;
          try { jr2 = JSON.parse(raw); } catch (e) { jr2 = null; }
          const c2 = jr2 && jr2.candidates && jr2.candidates[0];
          const p2 = c2 && c2.content && c2.content.parts;
          const t2 = Array.isArray(p2) ? p2.map(function (x) { return x.text || ''; }).join('') : '';
          if (t2 && t2.trim()) {
            console.log(`✅ Gemini (${model}) sans thinking`);
            return t2;
          }
        }
      }

      if (!r.ok) {
        console.warn(`Gemini ${model} → ${r.status}: ${raw.slice(0, 150)}`);
        GEMINI_ERRORS.push(model + ':' + r.status + ':' + raw.replace(/\s+/g, ' ').slice(0, 90));
        continue;
      }

      let jr;
      try { jr = JSON.parse(raw); } catch (e) { continue; }

      const cand = jr.candidates && jr.candidates[0];
      const parts = cand && cand.content && cand.content.parts;
      const txt = Array.isArray(parts) ? parts.map(function (x) { return x.text || ''; }).join('') : '';

      if (txt && txt.trim()) {
        console.log(`✅ Gemini (${model})`);
        return txt;
      }
      console.warn(`Gemini ${model} réponse vide. finishReason=`, cand && cand.finishReason);
        GEMINI_ERRORS.push(model + ':empty:' + (cand && cand.finishReason));
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn(`Gemini ${model} exception:`, String(e).slice(0, 100));
    }
  }
  return null;
}

// ============================================================
// مزوّد عام متوافق مع OpenAI (Groq · OpenRouter · z.ai · Mistral)
// ============================================================
async function analyzeWithOpenAICompat(opts) {
  const name = opts.name || 'provider';
  const models = opts.models || [];
  let lastErr = null;

  for (const model of models) {
    let controller = null, timeoutId = null;
    try {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs || 25000);

      const r = await fetch(opts.url, {
        method: 'POST',
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + opts.key
        }, opts.headers || {}),
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: opts.prompt },
              { type: 'image_url', image_url: { url: opts.image } }
            ]
          }],
          temperature: 0.1,
          max_tokens: 800
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const raw = await r.text();

      if (!r.ok) {
        lastErr = name + ' ' + r.status;
        console.warn(`[${name}] ${model} → ${r.status}: ${raw.slice(0, 110)}`);
        // 429/5xx: جرّب النموذج التالي — لا فائدة من تكرار نفس الطلب
        continue;
      }

      let j;
      try { j = JSON.parse(raw); } catch (e) { lastErr = 'json'; continue; }
      const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (txt && String(txt).trim()) {
        console.log(`✅ Analyse réussie avec ${name} (${model})`);
        return { text: String(txt) };
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      lastErr = name + ' exception';
      console.warn(`[${name}] ${model} exception:`, String(e).slice(0, 100));
    }
  }
  return { text: null, error: lastErr };
}

// ============================================================
// فحص حقيقي: يجرّب كل مزوّد على صورة صغيرة ويعيد خطأه بالضبط



// ============================================================
// فحص سريع: يستدعي Gemini بصورة صغيرة ويعيد الخطأ الخام
// ============================================================

// ============================================================
// تشخيص: المفاتيح + النماذج المتاحة
// ============================================================
async function handleDiag(req, res) {
  const out = {
    build: 'ai-gemini-1',
    gemini_key: !!process.env.GEMINI_API_KEY
  };

  if (out.gemini_key) {
    try {
      const models = await pickFlashModels(process.env.GEMINI_API_KEY);
      out.models = models.slice(0, 6);
    } catch (e) {
      out.models = ['erreur: ' + String(e).slice(0, 120)];
    }
  }

  return res.status(200).json(out);
}

async function handleVTest(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ ok: false, step: "key", message: "GEMINI_API_KEY manquante" });

  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const models = (await pickFlashModels(key)).slice(0, 2);
  const out = [];

  for (const model of models) {
    const body = {
      contents: [{ parts: [
        { text: "Reponds uniquement: {\"brand\":\"test\"}" },
        { inline_data: { mime_type: "image/png", data: png } }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
    };
    try {
      const r = await fetchWithRetry(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        1
      );
      const raw = r ? await r.text() : "no-response";
      out.push({ model: model, status: r ? r.status : 0, body: raw.slice(0, 200) });
      if (r && r.ok) return res.status(200).json({ ok: true, model: model, tried: out });
    } catch (e) {
      out.push({ model: model, error: String(e).slice(0, 120) });
    }
  }

  return res.status(200).json({ ok: false, tried: out });
}

async function handleAnalyze(req, res) {
  try {
    const { image } = req.body || {};
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ status: 'ERROR', message: 'Image manquante' });
    }

    const GEMINI_API_KEY_LOCAL = process.env.GEMINI_API_KEY;

    // يكفي مزوّد واحد: Gemini أساسي أو z.ai احتياطي
    if (!GEMINI_API_KEY_LOCAL) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'GEMINI_API_KEY manquante'
      });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ status: 'ERROR', message: 'Format invalide' });
    }

    const prompt = `Tu es un expert en contrefaçon. Analyse cette image avec précision.
ATTENTION: Concentre-toi UNIQUEMENT sur le logo et le nom de la marque situés dans la partie SUPÉRIEURE de l'emballage. Lis le texte exactement comme il est écrit, lettre par lettre, sans l'inventer.
Réponds UNIQUEMENT avec un objet JSON valide :
{
  "brand": "le nom COMPLET de la marque lu sur le logo (ex: 'MAKE COSMETIC', pas juste 'A')", 
  "product_name": "nom complet du produit", 
  "description": "Décris le produit en détail", 
  "confidence": "high|medium|low"
}
Ne mets AUCUN texte avant ou après le JSON.`;

    // ── سلسلة المزوّدين: كل مزوّد يعمل فقط إذا وُجد مفتاحه ──
    let text = null;
    let source = null;
    const tried = [];

    // 1) Gemini
    text = await analyzeWithGemini(match[1], match[2], prompt);
    tried.push('gemini');
    if (text) source = 'gemini';

    // ── 3) فشل كامل ──
    if (!text) {
      console.error('Aucun service vision disponible. Essayés:', tried.join(', '));
      return res.status(503).json({
        status: 'ERROR',
        message: 'فشل التحليل — ' + (GEMINI_ERRORS[0] || 'سبب غير معروف'),
        detail: GEMINI_ERRORS.join(' | ').slice(0, 400)
      });
    }

    // استخراج JSON
    let result = null;
    try {
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      if (start !== -1) {
        let depth = 0, end = -1;
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++;
          else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end !== -1) cleaned = cleaned.substring(start, end);
      }
      result = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ status: 'ERROR', message: 'Réponse invalide', detail: String(e) });
    }

    // تصحيح الماركة (Fuzzy Matching)
    let correctedBrand = (result.brand || '').trim();
    if (correctedBrand) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const brandsRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_codes?select=brand&limit=1000`, {
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
          });
          if (brandsRes.ok) {
            const codes = await brandsRes.json();
            const knownBrands = [...new Set(codes.map(c => c.brand).filter(Boolean))];
            
            function similarity(a, b) {
              if (!a || !b) return 0;
              a = a.toLowerCase(); b = b.toLowerCase();
              if (a === b) return 1;
              if (a.includes(b) || b.includes(a)) return 0.8;
              const matrix = [];
              for (let i = 0; i <= b.length; i++) matrix[i] = [i];
              for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
              for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                  matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
              }
              return 1 - (matrix[b.length][a.length] / Math.max(a.length, b.length));
            }
            
            let bestMatch = null, bestScore = 0;
            knownBrands.forEach(kb => {
              const score = similarity(correctedBrand, kb);
              if (score > bestScore) { bestScore = score; bestMatch = kb; }
            });
            if (bestMatch && bestScore > 0.7) correctedBrand = bestMatch;
          }
        } catch (e) { console.warn('Brand correction error:', e); }
      }
    }

    return res.status(200).json({
      status: 'OK',
      source: source,
      brand: correctedBrand.slice(0, 100),
      product_name: (result.product_name || '').trim().slice(0, 200),
      description: (result.description || '').trim().slice(0, 500),
      confidence: result.confidence || 'medium'
    });

  } catch (error) {
    console.error('handleAnalyze error:', error);
    return res.status(500).json({ status: 'ERROR', message: String(error).slice(0, 200) });
  }
}

// ============================================================
// MODE 3: ANALYTICS
// ============================================================
async function handleAnalytics(req, res) {
  try {
    const { brand_name, days = 30 } = req.body || {};
    if (!brand_name) return res.status(400).json({ status: 'ERROR', message: 'brand_name obligatoire' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const reportsRes = await fetch(`${SUPABASE_URL}/rest/v1/fake_reports?select=wilaya,comment,product_name,product_brand,status,created_at&order=created_at.desc&limit=500&created_at=gte.${since}`, {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    const allReports = await reportsRes.json();
    
    const reports = (allReports || []).filter(r => {
      const brand = (r.product_brand || '').toLowerCase();
      const target = brand_name.trim().toLowerCase();
      return brand.includes(target) || target.includes(brand);
    });

    if (reports.length === 0) {
      return res.status(200).json({ 
        status: 'OK', 
        report_count: 0, 
        analysis: { summary: "لا توجد بلاغات", patterns: [], recommendations: [], risk_level: 'LOW' } 
      });
    }

    const prompt = `Tu es un analyste expert pour la marque "${brand_name}". Voici ${reports.length} signalements. Analyse-les et réponds en JSON: {"summary": "en arabe", "patterns": ["en arabe"], "recommendations": ["en arabe"], "risk_level": "LOW|MEDIUM|HIGH|CRITICAL"}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${(await pickFlashModels(GEMINI_API_KEY))[0]}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt + "\n\nData: " + JSON.stringify(reports.slice(0, 30)) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        })
      }
    );

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error('Gemini analytics error:', errorText);
      return res.status(500).json({ status: 'ERROR', message: "Erreur d'analyse", detail: errorText.slice(0, 200) });
    }

    const aiData = await aiRes.json();
    const text = (aiData.candidates?.[0]?.content?.parts || []).map(function (x) { return x.text || ''; }).join('');

    if (!text) {
      return res.status(500).json({ status: 'ERROR', message: 'Réponse vide du service' });
    }

    let analysis = null;
    try {
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      if (start !== -1) {
        let depth = 0, end = -1;
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++;
          else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end !== -1) cleaned = cleaned.substring(start, end);
      }
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.warn('Failed to parse AI response:', text);
      analysis = { 
        summary: "تم استلام البلاغات لكن تعذّر تحليلها.", 
        patterns: [], 
        recommendations: [], 
        risk_level: 'MEDIUM' 
      };
    }

    return res.status(200).json({ 
      status: 'OK', 
      report_count: reports.length, 
      analysis: analysis 
    });

  } catch (error) {
    console.error('handleAnalytics error:', error);
    return res.status(500).json({ status: 'ERROR', message: String(error).slice(0, 200) });
  }
}

// ============================================================
// MODE 4: READ LABEL
// ============================================================
async function handleReadLabel(req, res) {
  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ status: 'ERROR', message: 'Image manquante' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ status: 'ERROR', message: 'Format invalide' });

    const prompt = `Lis le code secret sur cette image (7 caractères, sans I, O, L). Réponds en JSON: {"code": "XXXXXXX", "confidence": "high|medium|low"}`;
    
    const models = await getAvailableModels(GEMINI_API_KEY);
    let geminiData = null;
    let lastError = null;

    for (const model of models) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        if (r.ok) { geminiData = await r.json(); break; }
        else { lastError = await r.text(); }
      } catch (err) { lastError = String(err); }
    }

    if (!geminiData) return res.status(500).json({ status: 'ERROR', message: 'Erreur lecture IA', detail: lastError });

    let result = null;
    try {
      const text = geminiData.candidates[0].content.parts.map(p => p.text || '').join('');
      let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      if (!cleaned.startsWith('{')) {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
      }
      result = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ status: 'ERROR', message: 'Réponse IA invalide' });
    }

    let cleanCode = String(result.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode || cleanCode.length < 6) return res.status(200).json({ status: 'OK', code: '', confidence: 'low' });

    return res.status(200).json({ status: 'OK', code: cleanCode, confidence: result.confidence || 'medium' });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: String(error).slice(0, 200) });
  }
}
