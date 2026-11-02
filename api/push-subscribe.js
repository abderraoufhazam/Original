// api/push-subscribe.js
// حفظ/حذف اشتراك Push

export default async function handler(req, res) {
  // ✅ CORS محمي — قائمة أصول مسموحة
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://ordiz.online,https://www.ordiz.online,https://original-indol.vercel.app')
  .split(',').map(o => o.trim()).filter(Boolean);
const _origin = req.headers.origin;
if (_origin && ALLOWED_ORIGINS.includes(_origin)) {
  res.setHeader('Access-Control-Allow-Origin', _origin);
  res.setHeader('Vary', 'Origin');
}
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const action = (req.query && req.query.action) || 'subscribe';

  if (action === 'subscribe') return handleSubscribe(req, res);
  if (action === 'unsubscribe') return handleUnsubscribe(req, res);

  return res.status(400).json({ status: 'ERROR', message: 'Action invalide' });
}

async function handleSubscribe(req, res) {
  try {
    const { brand_name, user_id, subscription } = req.body || {};

    if (!brand_name || !subscription || !subscription.endpoint) {
      return res.status(400).json({ status: 'ERROR', message: 'Données manquantes' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const userAgent = req.headers['user-agent'] || 'unknown';

    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          brand_name: brand_name.trim(),
          user_id: user_id || null,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh || '',
          auth: subscription.keys?.auth || '',
          user_agent: userAgent.slice(0, 300),
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur sauvegarde', detail: err.slice(0, 200) });
    }

    return res.status(200).json({ status: 'OK', message: 'Subscription enregistrée' });
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}

async function handleUnsubscribe(req, res) {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ status: 'ERROR', message: 'endpoint obligatoire' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    return res.status(200).json({ status: 'OK', message: 'Désabonné' });
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}
