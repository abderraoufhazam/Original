// api/ai.js
// Gemini AI موحّد: chat (محادثة) + analyze (تحليل صور) + analytics (تحليل بلاغات)

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

  return res.status(400).json({
    status: 'ERROR',
    message: 'Mode invalide. Utilisez ?mode=chat, ?mode=analyze ou ?mode=analytics'
  });
}

// ============================================================
// MODE 1: CHAT — روبوت الدردشة
// ============================================================
async function handleChat(req, res) {
  try {
    const { message, history, context } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Message manquant' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Configuration manquante',
        detail: 'GEMINI_API_KEY not set'
      });
    }

    let systemPrompt = `Tu es l'assistant virtuel officiel de "Produit dz ORG", un service algérien de vérification d'authenticité de produits par QR code.
Aide les clients avec la vérification d'authenticité, le scan du QR, la zone à gratter, et les résultats (PRODUIT ORIGINAL, CODE DÉJÀ UTILISÉ, PRODUIT NON ORIGINAL).

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec la réponse finale pour le client.
- N'affiche JAMAIS ton raisonnement, tes brouillons, tes notes, ton "thinking", tes préfixes ou tes listes internes.
- Pas de "* Role:", "* Goal:", "* User says:", "* Constraints:", "* Draft:", etc.
- Réponds en 2-3 phrases maximum.
- Adapte-toi à la langue du client (français, arabe ou anglais).
- Sois chaleureux et professionnel.`;

    if (context && context.brand) {
      systemPrompt += `\n\nProduit actuellement vérifié par le client :
- Marque : ${context.brand}
- Nom : ${context.product_name || '—'}
- Référence : ${context.reference || '—'}
- Lot : ${context.lot || '—'}`;
    }

    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role === 'user' || h.role === 'model') {
          contents.push({ role: h.role, parts: [{ text: String(h.text || '').slice(0, 500) }] });
        }
      });
    }
    contents.push({ role: 'user', parts: [{ text: message.trim().slice(0, 1000) }] });

    // جلب قائمة الموديلات
    let availableModels = [];
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        availableModels = (listData.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
      }
    } catch (e) { /* ignore */ }

    if (availableModels.length === 0) {
      availableModels = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest'
      ];
    }

    const preferred = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];
    availableModels.sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai !== -1 && bi === -1) return -1;
      if (bi !== -1 && ai === -1) return 1;
      if (ai !== -1 && bi !== -1) return ai - bi;
      return 0;
    });

    let lastError = null;
    let geminiData = null;
    let usedModel = null;

    for (const model of availableModels) {
      try {
        const is25 = model.includes('2.5');
        const generationConfig = {
          temperature: 0.7,
          maxOutputTokens: 500
        };
        if (is25) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contents,
              generationConfig
            })
          }
        );
        const text = await r.text();
        if (r.ok) {
          geminiData = JSON.parse(text);
          usedModel = model;
          console.log('✅ Chat success with model:', model);
          break;
        } else {
          lastError = { status: r.status, model: model, body: text.slice(0, 200) };
        }
      } catch (e) {
        lastError = { status: 'exception', model: model, body: String(e).slice(0, 200) };
      }
    }

    if (!geminiData) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Gemini error',
        detail: JSON.stringify(lastError)
      });
    }

    let reply = '';
    try {
      const candidate = geminiData.candidates[0];
      const allParts = candidate.content.parts || [];
      const realParts = allParts.filter(p => !p.thought);
      const fullText = realParts.map(p => p.text || '').join('').trim();

      reply = fullText
        .replace(/^\*\s*(User says|Role|Goal|Constraints|The user|I need|Language|Draft\s*\d*|Brief|Refining|Acknowledge|Explain|Mention|Max\s+\d)[^\n]*\n?/gim, '')
        .replace(/\*\s*Draft\s*\d*\s*\([^)]*\):?\*?\s*/gi, '')
        .replace(/^\*+\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!reply) reply = fullText;
      if (!reply) reply = "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?";
    } catch (e) {
      reply = "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?";
    }

    return res.status(200).json({
      status: 'OK',
      reply: reply,
      model: usedModel
    });

  } catch (error) {
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 300)
    });
  }
}

// ============================================================
// MODE 2: ANALYZE — تحليل صور المنتجات
// ============================================================
async function handleAnalyze(req, res) {
  try {
    const { image } = req.body || {};

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ status: 'ERROR', message: 'Image manquante' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ status: 'ERROR', message: 'Format image invalide' });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const prompt = `Tu es un expert en identification de produits.
Analyse cette image et identifie le produit.

Réponds UNIQUEMENT en JSON valide :
{
  "brand": "nom de la marque si visible, sinon vide",
  "product_name": "nom court du produit",
  "description": "description en 1-2 phrases: type, taille, couleur, packaging",
  "confidence": "high|medium|low"
}

Ne mets AUCUN texte avant ou après le JSON.`;

    const MODELS = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest'
    ];

    let lastError = null;
    let geminiData = null;
    let usedModel = null;

    for (const model of MODELS) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Data } }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 300,
                responseMimeType: "application/json"
              }
            })
          }
        );

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          usedModel = model;
          console.log('✅ Analyze success with model:', model);
          break;
        } else {
          const errText = await geminiRes.text();
          lastError = { status: geminiRes.status, model, body: errText.slice(0, 250) };
        }
      } catch (err) {
        lastError = { status: 'exception', model, body: String(err).slice(0, 250) };
      }
    }

    if (!geminiData) {
      const isOverload = lastError && (lastError.status === 503 || lastError.status === 429);
      return res.status(isOverload ? 503 : 500).json({
        status: 'ERROR',
        message: isOverload
          ? 'IA temporairement surchargée. Réessayez dans 1 minute.'
          : 'Erreur analyse IA',
        detail: JSON.stringify(lastError).slice(0, 300)
      });
    }

    let result = null;
    try {
      const candidate = geminiData.candidates[0];
      const allParts = candidate.content.parts || [];
      const realParts = allParts.filter(p => !p.thought);
      const text = realParts.map(p => p.text || '').join('');
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Réponse IA invalide',
        model: usedModel
      });
    }

    return res.status(200).json({
      status: 'OK',
      brand: (result.brand || '').trim().slice(0, 100),
      product_name: (result.product_name || '').trim().slice(0, 200),
      description: (result.description || '').trim().slice(0, 500),
      confidence: result.confidence || 'medium',
      model: usedModel
    });

  } catch (error) {
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 200)
    });
  }
}

// ============================================================
// MODE 3: ANALYTICS — تحليل بلاغات التقليد
// ============================================================
async function handleAnalytics(req, res) {
  try {
    const { brand_name, days = 30 } = req.body || {};

    if (!brand_name || typeof brand_name !== 'string' || brand_name.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'brand_name obligatoire' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    // اجلب البلاغات للفترة المطلوبة
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const cleanBrand = brand_name.trim();

    const reportsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/fake_reports?select=wilaya,comment,product_name,product_brand,status,created_at,ai_analyzed&order=created_at.desc&limit=500&created_at=gte.${since}`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!reportsRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération' });
    }

    const allReports = await reportsRes.json();

    // فلترة بحسب اسم الماركة (fuzzy match)
    const reports = (allReports || []).filter(r => {
      const brand = (r.product_brand || '').toLowerCase();
      const name = (r.product_name || '').toLowerCase();
      const target = cleanBrand.toLowerCase();
      return brand.includes(target) || target.includes(brand) || name.includes(target);
    });

    if (reports.length === 0) {
      return res.status(200).json({
        status: 'OK',
        report_count: 0,
        analysis: {
          summary: `لا توجد بلاغات تقليد على "${cleanBrand}" خلال آخر ${days} يومًا.`,
          patterns: [],
          recommendations: ['استمر في المراقبة الدورية'],
          risk_level: 'LOW'
        }
      });
    }

    // إحصائيات أساسية
    const wilayaCounts = {};
    let totalWithImage = 0;
    let totalAnalyzed = 0;

    reports.forEach(r => {
      if (r.wilaya) wilayaCounts[r.wilaya] = (wilayaCounts[r.wilaya] || 0) + 1;
      if (r.ai_analyzed) totalAnalyzed++;
      if (r.comment) totalWithImage++;
    });

    const topWilayas = Object.entries(wilayaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count})`);

    // جهّز ملخص للـ AI
    const reportsSummary = reports.slice(0, 30).map(r => ({
      wilaya: r.wilaya || '—',
      brand: r.product_brand || '—',
      product: r.product_name || '—',
      comment: (r.comment || '').slice(0, 150),
      date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '—'
    }));

    const dataSummary = `
Brand: ${cleanBrand}
Période: derniers ${days} jours
Total signalements: ${reports.length}
Top wilayas: ${topWilayas.join(', ') || 'aucune'}
Signalements analysés par IA: ${totalAnalyzed}
`;

    const prompt = `Tu es un analyste expert en détection de contrefaçon pour la marque "${cleanBrand}".

Voici les données des signalements reçus :

${dataSummary}

Détails des derniers signalements :
${JSON.stringify(reportsSummary, null, 2)}

Analyse ces données et identifie :
1. Les tendances géographiques (où se concentre la contrefaçon ?)
2. Les patterns temporels (périodes d'activité accrue ?)
3. Les types de produits visés
4. Le niveau de risque global

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "summary": "résumé en 2-3 phrases en arabe",
  "patterns": [
    "pattern 1 en arabe",
    "pattern 2 en arabe"
  ],
  "recommendations": [
    "recommandation 1 en arabe",
    "recommandation 2 en arabe"
  ],
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "top_wilayas": ["wilaya1", "wilaya2"]
}

IMPORTANT :
- Réponds en arabe dans les champs texte
- Sois précis et concret
- Ne mets AUCUN texte avant ou après le JSON`;

    // جرّب الموديلات بالترتيب
    const MODELS = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest'
    ];

    let lastError = null;
    let geminiData = null;
    let usedModel = null;

    for (const model of MODELS) {
      try {
        const is25 = model.includes('2.5');
        const generationConfig = {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: "application/json"
        };
        if (is25) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig
            })
          }
        );

        if (r.ok) {
          geminiData = await r.json();
          usedModel = model;
          console.log('✅ Analytics success with model:', model);
          break;
        } else {
          const errText = await r.text();
          lastError = { status: r.status, model, body: errText.slice(0, 250) };
        }
      } catch (err) {
        lastError = { status: 'exception', model, body: String(err).slice(0, 250) };
      }
    }

    if (!geminiData) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur analyse IA',
        detail: JSON.stringify(lastError).slice(0, 300)
      });
    }

    // استخرج JSON
    let analysis = null;
    try {
      const candidate = geminiData.candidates[0];
      const allParts = candidate.content.parts || [];
      const realParts = allParts.filter(p => !p.thought);
      const text = realParts.map(p => p.text || '').join('');
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('Analytics parse error:', e);
      analysis = {
        summary: `تم استلام ${reports.length} بلاغ على "${cleanBrand}".`,
        patterns: [`التركيز الجغرافي: ${topWilayas.join(', ')}`],
        recommendations: ['راجع الموردين في المناطق المذكورة'],
        risk_level: reports.length > 20 ? 'HIGH' : 'MEDIUM',
        top_wilayas: topWilayas
      };
    }

    return res.status(200).json({
      status: 'OK',
      report_count: reports.length,
      analysis: analysis,
      model: usedModel
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 300)
    });
  }
}

// ============================================================
// MODE 4: READ LABEL — قراءة الكود من صورة الملصق
// ============================================================
async function handleReadLabel(req, res) {
  try {
    const { image } = req.body || {};

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ status: 'ERROR', message: 'Image manquante' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ status: 'ERROR', message: 'Format invalide' });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const prompt = `Tu es un expert en lecture de codes d'authentification.

Lis le code secret visible sur cette image (sous la zone à gratter ou imprimé sur le label).

RÈGLES :
- Le code contient exactement 7 caractères
- Caractères autorisés : A-Z (sauf I, O, L) et 2-9 (sauf 0, 1)
- Peut contenir un tiret (ex: DHY-583T) → ignore-le
- Réponds UNIQUEMENT en JSON valide

Format de réponse :
{
  "code": "XXXXXXX",
  "confidence": "high|medium|low",
  "notes": "raison si low"
}

Si aucun code n'est lisible :
{ "code": "", "confidence": "low", "notes": "aucun code visible" }`;

    const MODELS = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest'
    ];

    let lastError = null;
    let geminiData = null;
    let usedModel = null;

    for (const model of MODELS) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 200,
                responseMimeType: "application/json"
              }
            })
          }
        );

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          usedModel = model;
          break;
        } else {
          const errText = await geminiRes.text();
          lastError = { status: geminiRes.status, model, body: errText.slice(0, 200) };
        }
      } catch (err) {
        lastError = { status: 'exception', model, body: String(err).slice(0, 200) };
      }
    }

    if (!geminiData) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur lecture IA',
        detail: JSON.stringify(lastError).slice(0, 200)
      });
    }

    let result = null;
    try {
      const candidate = geminiData.candidates[0];
      const allParts = candidate.content.parts || [];
      const realParts = allParts.filter(p => !p.thought);
      const text = realParts.map(p => p.text || '').join('');
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ status: 'ERROR', message: 'Réponse IA invalide' });
    }

    let cleanCode = String(result.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleanCode || cleanCode.length < 6) {
      return res.status(200).json({
        status: 'OK',
        code: '',
        confidence: 'low',
        message: 'لم نتمكن من قراءة الكود، اكتبه يدويًا'
      });
    }

    return res.status(200).json({
      status: 'OK',
      code: cleanCode,
      confidence: result.confidence || 'medium',
      notes: result.notes || '',
      model: usedModel
    });

  } catch (error) {
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 200)
    });
  }
}
