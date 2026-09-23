// api/test.js — Diagnostic Gemini

export default async function handler(req, res) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(200).json({
      step: "1",
      error: "GEMINI_API_KEY manquant dans Vercel",
      hint: "Ajoutez la variable et faites un Redeploy"
    });
  }

  // Test avec l'API Gemini
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );
    const data = await r.json();

    return res.status(200).json({
      step: "2",
      keyPrefix: GEMINI_API_KEY.slice(0, 8) + "...",
      keyLength: GEMINI_API_KEY.length,
      httpStatus: r.status,
      response: data
    });
  } catch (e) {
    return res.status(200).json({
      step: "3",
      error: e.message
    });
  }
}
