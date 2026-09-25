// api/disable-batch.js
// يحوّل UNUSED → DISABLED (عند اكتشاف سرقة)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

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

    // 1. التحقق من المستخدم
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

    // 2. التحقق من الأدمن
    const ADMIN_EMAILS = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];
    const callerEmail = (caller.email || '').toLowerCase().trim();
    if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail)) {
      return res.status(403).json({ status: 'ERROR', message: 'Accès refusé' });
    }

    const cleanLot = lot.trim();

    // 3. عدّ الأكواد UNUSED
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

    // 4. تحديث كل UNUSED → DISABLED
    // ملاحظة: الأكواد USED لا تتأثر (مستهلكون شرعيون)
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

    // 5. تسجيل العملية
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
