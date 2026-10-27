// api/ai.js
// Gemini AI موحّد: chat + analyze + analytics + read-label

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const mode = (req.query && req.query.mode) || (req.body && req.body.mode);

  if (mode === 'chat')       return handleChat(req, res);
  if (mode === 'analyze')    return handleAnalyze(req, res);
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

    let systemPrompt = `Tu es l'assistant virtuel officiel de "OriginalDz". Réponds en 2-3 phrases maximum, dans la langue du client.`;
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
// MODE 2: ANALYZE (سريع + تصحيح تلقائي)
// ============================================================
async function handleAnalyze(req, res) {
  try {
    const { image } = req.body || {};
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ status: 'ERROR', message: 'Image manquante' });
    }

    const ZAI_API_KEY = process.env.ZAI_API_KEY;
    if (!ZAI_API_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'ZAI_API_KEY manquant dans Vercel' });
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

        // ✅ إعادة المحاولة القوية (5 محاولات) لمعالجة فشل z.ai المتكرر
    let response = null;
    let lastErrorText = null;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let controller = null;
      let timeoutId = null;
      
      try {
        console.log(`Tentative ${attempt}/${maxRetries} avec z.ai...`);
        
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30 ثانية لكل محاولة

        response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ZAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'glm-4.6v-flash',
            region: "top",
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: image } }
                ]
              }
            ],
            temperature: 0.1
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ Succès avec z.ai (tentative ${attempt})`);
          break; // نجح، اخرج
        } else {
          lastErrorText = await response.text();
          const status = response.status;
          
          // ✅ معالجة جميع الأخطاء المؤقتة (400 و 429)
          // 400: قد يكون توجيه خاطئ (1214) أو نصي فقط
          // 429: ازدحام (1305) أو حد المعدل
          if (status === 400 || status === 429) {
            console.warn(`⚠️ z.ai erreur temporaire (${status}). Tentative ${attempt}/${maxRetries}.`);
            
            if (attempt < maxRetries) {
              // انتظار متزايد: 2s, 3s, 4s, 5s
              const delay = (attempt + 1) * 1000;
              console.log(`Attente de ${delay}ms avant la prochaine tentative...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue; // جرب مرة أخرى
            }
          } else {
            // أخطاء أخرى (401, 403) لا داعي لإعادة المحاولة
            break;
          }
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (err.name === 'AbortError') {
          lastErrorText = 'Timeout (30s)';
        } else {
          lastErrorText = String(err);
        }
        console.warn(`Tentative ${attempt} échouée: ${lastErrorText}`);
        
        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    
    // ✅ التحقق من النتيجة النهائية
    if (!response || !response.ok) {
      console.error('Z.ai error final:', lastErrorText);
      return res.status(500).json({ 
        status: 'ERROR', 
        message: 'خدمة التحليل مزدحمة حالياً. يرجى المحاولة بعد قليل أو كتابة البيانات يدوياً.',
        detail: lastErrorText ? lastErrorText.slice(0, 200) : 'Unknown error'
      });
    }

    // ✅ استخراج البيانات من الاستجابة (مرة واحدة فقط)
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(500).json({ status: 'ERROR', message: 'Réponse vide du service' });
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

    const ZAI_API_KEY = process.env.ZAI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!ZAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          { role: 'user', content: prompt + "\n\nData: " + JSON.stringify(reports.slice(0, 30)) }
        ],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Z.ai analytics error:', errorText);
      return res.status(500).json({ 
        status: 'ERROR', 
        message: 'Erreur du service d\'analyse z.ai.', 
        detail: errorText.slice(0, 200) 
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

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
