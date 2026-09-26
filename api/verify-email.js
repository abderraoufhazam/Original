// api/verify-email.js
// ?action=send  → إرسال كود
// ?action=check → التحقق من الكود

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const action = (req.query && req.query.action) || 'send';

  if (action === 'send') return handleSend(req, res);
  if (action === 'check') return handleCheck(req, res);

  return res.status(400).json({ status: 'ERROR', message: 'Action invalide' });
}

// ============================================================
// 📤 إرسال كود
// ============================================================
async function handleSend(req, res) {
  try {
    const { email, brand_name } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ status: 'ERROR', message: 'Email invalide' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanBrand = (brand_name || 'Client').trim().slice(0, 80);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    // 🚦 Rate limiting: 3 max par 15 min
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(cleanEmail)}&created_at=gte.${since}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'count=exact'
        }
      }
    );
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);

    if (count >= 3) {
      return res.status(429).json({
        status: 'ERROR',
        message: 'Trop de demandes. Réessayez dans 15 minutes.'
      });
    }

    // 🎲 كود 6 أرقام
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // ⏰ صلاحية 10 دقائق
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';

    // 💾 حفظ الكود
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: cleanEmail,
        code: code,
        expires_at: expiresAt,
        ip: ip
      })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Insert error:', err);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur sauvegarde' });
    }

    // 📧 إرسال عبر EmailJS
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_42s5mbn';
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_VERIFY;
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'juoh_rOKaec16kxrH';

    if (!EMAILJS_TEMPLATE_ID) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'EMAILJS_TEMPLATE_VERIFY manquant dans Vercel'
      });
    }

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: cleanEmail,
          brand_name: cleanBrand,
          code: code
        }
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('EmailJS error:', err);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur envoi email',
        detail: err.slice(0, 200)
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: 'Code envoyé à ' + cleanEmail
    });

  } catch (e) {
    console.error('handleSend error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}

// ============================================================
// ✅ التحقق من الكود
// ============================================================
async function handleCheck(req, res) {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ status: 'ERROR', message: 'Email + code obligatoires' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ status: 'ERROR', message: 'Code invalide (6 chiffres)' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(cleanEmail)}&used=eq.false&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!checkRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur' });
    }

    const rows = await checkRes.json();

    if (!rows || rows.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Aucun code actif. Demandez un nouveau code.' });
    }

    const v = rows[0];

    if (new Date(v.expires_at) < new Date()) {
      return res.status(400).json({ status: 'ERROR', message: 'Code expiré. Demandez un nouveau code.' });
    }

    if (v.attempts >= 5) {
      return res.status(400).json({ status: 'ERROR', message: 'Trop de tentatives. Demandez un nouveau code.' });
    }

    if (v.code !== cleanCode) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${v.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ attempts: v.attempts + 1 })
        }
      );
      const remaining = 4 - v.attempts;
      return res.status(400).json({
        status: 'ERROR',
        message: `Code incorrect. ${remaining} tentative(s) restante(s).`
      });
    }

    // ✅ صحيح → علّمه كمستعمل
    await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${v.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ used: true })
      }
    );

    return res.status(200).json({
      status: 'OK',
      message: 'Code vérifié',
      email: cleanEmail
    });

  } catch (e) {
    console.error('handleCheck error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}
