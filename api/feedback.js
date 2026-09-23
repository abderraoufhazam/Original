
// api/feedback.js
// Reçoit les avis et signalements des clients

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { secret_code, type, rating, comment } = req.body || {};

    // Validation
    if (!type || (type !== 'rating' && type !== 'report')) {
      return res.status(400).json({ status: 'ERROR', message: 'Type invalide' });
    }

    const cleanCode = (secret_code || '').trim().toUpperCase();

    if (type === 'rating') {
      if (!cleanCode) {
        return res.status(400).json({ status: 'ERROR', message: 'Code manquant' });
      }
      const r = parseInt(rating, 10);
      if (!r || r < 1 || r > 5) {
        return res.status(400).json({ status: 'ERROR', message: 'Note invalide (1 à 5)' });
      }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration serveur manquante' });
    }

    // IP + user-agent
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Construction de l'enregistrement
    const row = {
      secret_code: cleanCode || null,
      type: type,
      rating: type === 'rating' ? parseInt(rating, 10) : null,
      comment: (comment || '').trim().slice(0, 1000) || null,
      ip: ip,
      user_agent: userAgent
    };

    // Insertion via REST
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Feedback insert error:', errText);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur' });
    }

    return res.status(200).json({
      status: 'OK',
      message: type === 'rating' ? 'Merci pour votre avis !' : 'Signalement enregistré.'
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}
