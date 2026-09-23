// api/chat.js
// Chatbot avec Google Gemini

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
      console.error('Missing GEMINI_API_KEY');
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    let systemPrompt = `Tu es l'assistant virtuel officiel de "Produit dz ORG", un service algérien de vérification d'authenticité de produits par QR code.

Tes missions :
- Aider les clients à vérifier l'authenticité des produits.
- Répondre aux questions sur l'utilisation du système (scanner le QR, gratter la zone, entrer le code).
- Expliquer les résultats : PRODUIT ORIGINAL, CODE DÉJÀ UTILISÉ, PRODUIT NON ORIGINAL.
- Si le client signale un produit contrefait, encourage-le à utiliser le bouton "Signaler une contrefaçon".
- Réponds de manière brève (2-3 phrases max), claire et sympathique.
- Si tu ne sais pas, propose de contacter la marque directement.
- Adapte-toi à la langue du client (français, arabe ou anglais).
- Ne parle que de sujets liés au produit, à l'authenticité ou au service.`;

    if (context && context.brand) {
      systemPrompt += `\n\nProduit actuellement vérifié :
- Marque : ${context.brand}
- Nom : ${context.product_name || '—'}
- Référence : ${context.reference || '—'}
- Lot : ${context.lot || '—'}
- Fabrication : ${context.manufacture_date || '—'}
- Expiration : ${context.expiry_date || '—'}`;
    }

    const contents = [];

    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role === 'user' || h.role === 'model') {
          contents.push({
            role: h.role,
            parts: [{ text: String(h.text || '').slice(0, 500) }]
          });
        }
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim().slice(0, 1000) }]
    });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            topP: 0.95,
            topK: 40
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Service momentanément indisponible'
      });
    }

    const data = await geminiRes.json();

    let reply = '';
    try {
      reply = data.candidates[0].content.parts[0].text;
    } catch (e) {
      reply = "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?";
    }

    return res.status(200).json({ status: 'OK', reply: reply.trim() });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}
