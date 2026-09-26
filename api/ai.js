// api/ai.js
// Gemini AI موحّد: chat (محادثة) + analyze (تحليل صور)
// الاستخدام:
//   POST /api/ai?mode=chat      { message, history, context }
//   POST /api/ai?mode=analyze   { image }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const mode = (req.query && req.query.mode) || (req.body && req.body.mode);

  if (mode === 'chat')    return handleChat(req, res);
  if (mode === 'analyze') return handleAnalyze(req, res);

  return res.status(400).json({
    status: 'ERROR',
    message: 'Mode invalide. Utilisez ?mode=chat ou ?mode=analyze'
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

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec la réponse finale pour le client.
- N'affiche JAMAIS ton raisonnement, tes brouillons, tes notes, ton "thinking" ou des préfixes comme "* User question:", "* Intent:", "* Draft:", "* Language:" etc.
- Pas de listes numérotées internes ni de meta-commentaires.
- Réponds en 2-3 phrases maximum, directement et clairement.
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

    // جلب قائمة الموديلات المتاحة
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
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro'
      ];
    }

    const preferred = ['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.5-flash'];
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
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contents,
              generationConfig: {
               temperature: 0.7,
               maxOutputTokens: 500
             }
            })
          }
        );
        const text = await r.text();
        if (r.ok) {
          geminiData = JSON.parse(text);
          usedModel = model;
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
        detail: JSON.stringify(lastError),
        availableModels: availableModels
      });
    }

    let reply = '';
    try {
      const candidate = geminiData.candidates[0];
      const parts = candidate.content.parts || [];
      const fullText = parts.map(p => p.text || '').join('').trim();

      reply = fullText
        .replace(/^\*\s*(User question|Language|Intent|Draft\s*\d*|Brief|Refining|Acknowledge|Explain|Mention)[^\n]*\n?/gim, '')
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
// MODE 2: ANALYZE — تحليل صور المنتجات بـ Gemini Vision
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
          console.log('✅ Success with model:', model);
          break;
        } else {
          const errText = await geminiRes.text();
          lastError = { status: geminiRes.status, model, body: errText.slice(0, 250) };
          console.warn(`⚠️ Model ${model} failed:`, geminiRes.status);
        }
      } catch (err) {
        lastError = { status: 'exception', model, body: String(err).slice(0, 250) };
        console.warn(`❌ Model ${model} exception:`, err);
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
      const text = geminiData.candidates[0].content.parts[0].text;
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      console.error('Parse error:', e);
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
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 200)
    });
  }
}
