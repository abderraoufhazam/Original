// api/analyze-product.js
// Analyse une image de produit avec Gemini Vision

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

    // Extraire le type et les données base64
    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ status: 'ERROR', message: 'Format image invalide' });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    // Prompt pour Gemini
    const prompt = `Tu es un expert en identification de produits.
Analyse cette image et identifie le produit.

Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, avec cette structure exacte :
{
  "brand": "nom de la marque si visible, sinon vide",
  "product_name": "nom court du produit, ex: 'Sérum visage 30ml'",
  "description": "description détaillée en 1-2 phrases: type, taille, couleur, packaging",
  "confidence": "high|medium|low"
}

Règles :
- Si tu ne vois pas la marque, mets brand = "".
- Écris dans la langue du produit (arabe si produit arabe, français si français).
- Sois précis et factuel, pas commercial.
- Ne mets AUCUN texte avant ou après le JSON.`;

    // Appeler Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini Vision error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur analyse',
        detail: errText.slice(0, 200)
      });
    }

    const geminiData = await geminiRes.json();

    let result = null;
    try {
      const text = geminiData.candidates[0].content.parts[0].text;
      // Nettoyer les éventuels backticks
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      console.error('Parse error:', e, geminiData);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Impossible de parser la réponse'
      });
    }

    return res.status(200).json({
      status: 'OK',
      brand: (result.brand || '').trim().slice(0, 100),
      product_name: (result.product_name || '').trim().slice(0, 200),
      description: (result.description || '').trim().slice(0, 500),
      confidence: result.confidence || 'medium'
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
