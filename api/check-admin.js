// api/check-admin.js
// يُرجع isAdmin + role (admin / brand / shop)

const FALLBACK_ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraouf hazam'.replace(' ','')+'@gmail.com'];

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
      return res.status(401).json({
        status: 'ERROR', isAdmin: false, role: null, message: 'Non authentifié'
      });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        status: 'ERROR', isAdmin: false, role: null, message: 'Config manquante'
      });
    }

    // 1. جلب المستخدم
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({
        status: 'ERROR', isAdmin: false, role: null, message: 'Token invalide'
      });
    }

    const user = await userRes.json();
    const userEmail = (user.email || '').toLowerCase().trim();
    const userMeta = user.user_metadata || {};

    // 2. هل هو أدمن؟
    let isAdmin = false;
    let adminSource = 'none';
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
          adminSource = 'table';
        }
      }
    } catch (e) { console.warn('admins check failed:', e); }

    if (!isAdmin && FALLBACK_ADMIN_EMAILS.includes(userEmail)) {
      isAdmin = true;
      adminSource = 'fallback';
    }

    // 3. تحديد الدور
    let role = 'brand'; // افتراضي
    if (isAdmin) {
      role = 'admin';
    } else if (userMeta.role === 'shop') {
      role = 'shop';
    } else if (userMeta.role === 'brand') {
      role = 'brand';
    }

    return res.status(200).json({
      status: 'OK',
      isAdmin,
      role,
      source: adminSource,
      user_id: user.id,
      email: user.email,
      shop_name: userMeta.shop_name || null,
      brand_name: userMeta.brand_name || null
    });

  } catch (e) {
    console.error('check-admin error:', e);
    return res.status(500).json({
      status: 'ERROR', isAdmin: false, role: null, message: String(e).slice(0, 200)
    });
  }
}
