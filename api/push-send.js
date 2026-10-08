// api/push-send.js
// إرسال إشعار Push لماركة

import webpush from 'web-push';

export default async function handler(req, res) {
  // ✅ CORS محمي — قائمة أصول مسموحة
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://originaldz.online,https://www.originaldz.online,https://original-indol.vercel.app')
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

  try {
    const { brand_name, title, body, url, tag } = req.body || {};

    if (!brand_name || !title) {
      return res.status(400).json({ status: 'ERROR', message: 'brand_name + title obligatoires' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@example.com';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config Supabase manquante' });
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'VAPID keys manquantes' });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?brand_name=eq.${encodeURIComponent(brand_name.trim())}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!subsRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur lecture subs' });
    }

    const subscriptions = await subsRes.json();

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        status: 'OK',
        message: 'Aucun abonnement actif',
        sent: 0,
        failed: 0
      });
    }

    const payload = JSON.stringify({
      title: title,
      body: body || '',
      url: url || '/brand',
      tag: tag || 'order-update',
      icon: '/icon.svg',
      badge: '/icon.svg'
    });

    let sent = 0;
    let failed = 0;
    const invalidEndpoints = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        sent++;
      } catch (e) {
        failed++;
        if (e.statusCode === 410 || e.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        }
        console.warn(`Push failed for ${sub.endpoint.slice(0, 50)}:`, e.statusCode);
      }
    }

    if (invalidEndpoints.length > 0) {
      for (const ep of invalidEndpoints) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          }
        ).catch(() => {});
      }
    }

    return res.status(200).json({
      status: 'OK',
      sent: sent,
      failed: failed,
      total: subscriptions.length
    });
  } catch (e) {
    console.error('push-send error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 300) });
  }
}
