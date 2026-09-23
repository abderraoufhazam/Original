// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

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

    // ============================================================
    // ÉTAPE 1 : Récupérer la liste des modèles disponibles
    // ============================================================
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

    // Priorité : 2.0-flash d'abord (pas de thinking), puis 1.5, puis 2.5
    const preferred = ['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.5-flash'];
    availableModels.sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai !== -1 && bi === -1) return -1;
      if (bi !== -1 && ai === -1) return 1;
      if (ai !== -1 && bi !== -1) return ai - bi;
      return 0;
    });

    // ============================================================
    // ÉTAPE 2 : Essayer chaque modèle
    // ============================================================
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
                maxOutputTokens: 500,
                thinkingConfig: { thinkingBudget: 0 }
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

    // ============================================================
    // ÉTAPE 3 : Extraire la réponse (nettoyage anti-thinking)
    // ============================================================
    let reply = '';
    try {
      const candidate = geminiData.candidates[0];
      const parts = candidate.content.parts || [];

      // Concaténer tous les parts textuels
      const fullText = parts
        .map(p => p.text || '')
        .join('')
        .trim();

      // Nettoyer les artefacts de "thinking" si présents
      reply = fullText
        .replace(/^\*\s*(User question|Language|Intent|Draft\s*\d*|Brief|Refining|Acknowledge|Explain|Mention)[^\n]*\n?/gim, '')
        .replace(/\*\s*Draft\s*\d*\s*\([^)]*\):?\*?\s*/gi, '')
        .replace(/^\*+\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Si après nettoyage c'est vide, utiliser le texte brut
      if (!reply) reply = fullText;

      // Si vraiment vide, message par défaut
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
