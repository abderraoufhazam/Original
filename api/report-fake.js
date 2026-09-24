// api/report-fake.js
// Enregistre les signalements de contrefaçon avec wilaya

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { attempted_code, wilaya, comment } = req.body || {};

    // Validation
    if (!wilaya || typeof wilaya !== 'string' || wilaya.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Wilaya manquante' });
    }

    const cleanWilaya = wilaya.trim().slice(0, 50);
    const cleanCode = (attempted_code || '').trim().toUpperCase().slice(0, 20);
    const cleanComment = (comment || '').trim().slice(0, 500) || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // IP + user-agent
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Insert dans Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/fake_reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        attempted_code: cleanCode || null,
        wilaya: cleanWilaya,
        comment: cleanComment,
        ip: ip,
        user_agent: userAgent
      })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Insert error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur enregistrement',
        detail: errText.slice(0, 200)
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: 'Signalement enregistré. Merci !'
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
