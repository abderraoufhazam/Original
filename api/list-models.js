// api/list-models.js — Diagnostic
export default async function handler(req, res) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(200).json({ error: 'GEMINI_API_KEY missing' });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );
    const data = await r.json();

    const visionModels = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    return res.status(200).json({
      status: 'OK',
      httpStatus: r.status,
      totalModels: (data.models || []).length,
      visionCapableModels: visionModels
    });
  } catch (e) {
    return res.status(200).json({ error: String(e) });
  }
}
