// api/analyze-product.js
// Analyse une image avec Gemini Vision (modèles vérifiés)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

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

    // ✅ Modèles vérifiés comme disponibles dans votre compte
    const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash'
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
                maxOutputTokens: 500,
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
