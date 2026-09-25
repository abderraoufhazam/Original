// api/batch-actions.js
// API موحّد: تفعيل (activate) + إيقاف (disable) الدفعات
// الاستخدام: POST /api/batch-actions?action=activate

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

    const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (action === 'activate')    return handleActivate(req, res);
  if (action === 'disable')     return handleDisable(req, res);
  if (action === 'list-brands') return handleListBrands(req, res);

  return res.status(400).json({
    status: 'ERROR',
    message: 'Action invalide. Utilisez ?action=activate, ?action=disable ou ?action=list-brands'
  });
}

// ============================================================
// ACTIVATE — يحوّل PENDING → UNUSED
// ============================================================
async function handleActivate(req, res) {
  try {
    const { lot, access_token } = req.body || {};

    if (!lot || typeof lot !== 'string' || lot.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Lot obligatoire' });
    }
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const caller = await userRes.json();

    const ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];
    const callerEmail = (caller.email || '').toLowerCase().trim();
    if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail)) {
      return res.status(403).json({ status: 'ERROR', message: 'Accès refusé' });
    }

    const cleanLot = lot.trim();

    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}&secret_status=eq.PENDING&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'count=exact'
        }
      }
    );

    const pendingCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);

    if (pendingCount === 0) {
      return res.status(200).json({
        status: 'ERROR',
        message: 'Aucun code PENDING trouvé dans ce lot',
        activated: 0
      });
    }

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}&secret_status=eq.PENDING`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ secret_status: 'UNUSED' })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Update error:', err);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur activation',
        detail: err.slice(0, 200)
      });
    }

    fetch(`${SUPABASE_URL}/rest/v1/qr_delete_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        lot: cleanLot,
        count: pendingCount,
        action: 'ACTIVATE'
      })
    }).catch(err => console.warn('Log error:', err));

    return res.status(200).json({
      status: 'OK',
      message: `Lot activé : ${pendingCount} code(s)`,
      activated: pendingCount,
      lot: cleanLot
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

// ============================================================
// DISABLE — يحوّل UNUSED → DISABLED
// ============================================================
async function handleDisable(req, res) {
  try {
    const { lot, access_token } = req.body || {};

    if (!lot || typeof lot !== 'string' || lot.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Lot obligatoire' });
    }
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const caller = await userRes.json();

    const ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];
    const callerEmail = (caller.email || '').toLowerCase().trim();
    if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail)) {
      return res.status(403).json({ status: 'ERROR', message: 'Accès refusé' });
    }

    const cleanLot = lot.trim();

    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}&secret_status=eq.UNUSED&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'count=exact'
        }
      }
    );

    const unusedCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);

    if (unusedCount === 0) {
      return res.status(200).json({
        status: 'ERROR',
        message: 'Aucun code UNUSED trouvé dans ce lot',
        disabled: 0
      });
    }

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}&secret_status=eq.UNUSED`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ secret_status: 'DISABLED' })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Update error:', err);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur désactivation',
        detail: err.slice(0, 200)
      });
    }

    fetch(`${SUPABASE_URL}/rest/v1/qr_delete_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        lot: cleanLot,
        count: unusedCount,
        action: 'DISABLE'
      })
    }).catch(err => console.warn('Log error:', err));

    return res.status(200).json({
      status: 'OK',
      message: `Lot désactivé : ${unusedCount} code(s)`,
      disabled: unusedCount,
      lot: cleanLot
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

// ============================================================
// LIST-BRANDS — قائمة الماركات (admin فقط)
// ============================================================
async function handleListBrands(req, res) {
  try {
    const { access_token } = req.body || {};

    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // التحقق من المستخدم
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const caller = await userRes.json();

    // التحقق من الأدمن
    const ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];
    const callerEmail = (caller.email || '').toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail);

    if (!isAdmin) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Accès refusé',
        detail: 'Email non autorisé : ' + callerEmail
      });
    }

    // جلب كل المستخدمين
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      console.error('List users error:', err);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération' });
    }

    const listData = await listRes.json();
    const users = listData.users || [];

    // فلترة الماركات فقط (استثناء الأدمن)
    const brands = users
      .filter(u => {
        const email = (u.email || '').toLowerCase();
        const role = u.user_metadata?.role || 'brand';
        return role === 'brand' && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
      })
      .map(u => ({
        id: u.id,
        email: u.email,
        brand_name: u.user_metadata?.brand_name || null,
        phone: u.user_metadata?.phone || null,
        role: u.user_metadata?.role || 'brand',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      status: 'OK',
      count: brands.length,
      brands: brands
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 300)
    });
  }
}
