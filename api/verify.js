// api/verify.js
// Vérification via hash (nouveau) + plaintext (fallback) + rate limiting

import { hashCode } from './_crypto.js';
import { getClientIp } from './_turnstile.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { secret_code } = req.body || {};

    if (!secret_code || typeof secret_code !== 'string' || secret_code.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Code secret manquant' });
    }

    const cleanCode = secret_code.trim().toUpperCase();

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // 🔒 Rate Limiting
    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
      const rlRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            p_key: 'verify:' + ip,
            p_limit: 20,
            p_window_seconds: 60
          })
        }
      );

      if (rlRes.ok) {
        const allowed = await rlRes.json();
        if (allowed === false) {
          return res.status(429).json({
            status: 'ERROR',
            message: 'Trop de tentatives. Réessayez dans une minute.'
          });
        }
      }
    } catch (rlErr) {
      // لا نُفشل الطلب إذا فشل فحص rate limit — نكمل بحذر
      console.warn('Rate limit check failed:', rlErr);
    }

    // Calculer le hash SHA-256
    const codeHash = hashCode(cleanCode);

    // Appeler verify_code_v3 (nouvelle version sécurisée)
const rpcResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/verify_code_v3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          p_code_hash: codeHash,
          p_plaintext_code: cleanCode
        })
      }
    );

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text();
      console.error('Supabase RPC error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur serveur'
      });
    }

    const data = await rpcResponse.json();

    // ✅ استخراج المدينة من IP (تلقائياً عبر Vercel)
    const city = req.headers['x-vercel-ip-city'] || null;
    const country = req.headers['x-vercel-ip-country'] || null;

    // Journaliser la tentative (fire-and-forget)
    const logRow = {
      secret_code: cleanCode,
      result: data.status || 'UNKNOWN',
      brand: data.product?.brand || null,
      product_name: data.product?.product_name || null,
      lot: data.product?.lot || null,
      ip: ip,
      city: city ? decodeURIComponent(city) : null, // ✅ إضافة المدينة
      country: country,
      user_agent: userAgent
    };

    // ✅ تسجيل التحقق مع انتظار النتيجة لضمان الحفظ
    try {
      const logRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_verifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(logRow)
      });
      
      if (!logRes.ok) {
        const errText = await logRes.text();
        console.error('Log insert error:', errText);
      } else {
        console.log('✅ Verification logged successfully');
      }
    } catch (logErr) {
      console.error('Log fetch error:', logErr);
    }
    return res.status(200).json(data);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue'
    });
  }
}
