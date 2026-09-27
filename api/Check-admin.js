// api/check-admin.js
// يتحقق إن كان المستخدم الحالي أدمن — بدون كشف الإيميلات

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

    // 1. التحقق من صحة التوكن
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

    // 2. استدعاء دالة is_admin() بتوكن المستخدم
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    let isAdmin = false;
    if (rpcRes.ok) {
      isAdmin = await rpcRes.json();
    }

    return res.status(200).json({
      status: 'OK',
      isAdmin: !!isAdmin,
      user_id: user.id,
      email: user.email
    });

  } catch (e) {
    console.error('check-admin error:', e);
    return res.status(500).json({ status: 'ERROR', isAdmin: false, message: String(e).slice(0, 200) });
  }
}
