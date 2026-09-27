// api/check-admin.js
// نسخة مضمونة — تتحقق من الجدول + fallback

const FALLBACK_ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const access_token =
      (req.body && req.body.access_token) ||
      (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', isAdmin: false, message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', isAdmin: false, message: 'Config manquante' });
    }

    // 1. الحصول على المستخدم
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', isAdmin: false, message: 'Token invalide' });
    }

    const user = await userRes.json();
    const userEmail = (user.email || '').toLowerCase().trim();

    let isAdmin = false;
    let source = 'none';

    // 2. حاول من الجدول
    try {
      const adminRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );
      if (adminRes.ok) {
        const rows = await adminRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          isAdmin = true;
          source = 'table';
        }
      }
    } catch (e) { console.warn('table check failed:', e); }

    // 3. Fallback: تحقق من الإيميل
    if (!isAdmin && FALLBACK_ADMIN_EMAILS.includes(userEmail)) {
      isAdmin = true;
      source = 'fallback';
      console.warn('⚠️ Admin via fallback:', userEmail);
    }

    return res.status(200).json({
      status: 'OK',
      isAdmin: isAdmin,
      source: source,
      user_id: user.id,
      email: user.email
    });

  } catch (e) {
    console.error('check-admin error:', e);
    return res.status(500).json({ status: 'ERROR', isAdmin: false, message: String(e).slice(0, 200) });
  }
}
