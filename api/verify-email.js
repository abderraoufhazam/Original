// api/verify-email.js
// ?action=send  → إرسال كود
// ?action=check → التحقق من الكود

import crypto from 'crypto';
import { verifyTurnstile, getClientIp } from './_turnstile.js';

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
    const { email, brand_name, turnstile_token } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ status: 'ERROR', message: 'Email invalide' });
    }

    const ip = getClientIp(req);
    const turnstileResult = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileResult.success) {
      return res.status(403).json({ status: 'ERROR', message: 'Vérification anti-bot échouée.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanBrand = (brand_name || 'Client').trim().slice(0, 80);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(cleanEmail)}&created_at=gte.${since}&select=id`,
      { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Prefer': 'count=exact' } }
    );
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);

    if (count >= 3) {
      return res.status(429).json({ status: 'ERROR', message: 'Trop de demandes. Réessayez dans 15 minutes.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email: cleanEmail, code: code, expires_at: expiresAt, ip: ip || 'unknown' })
    });

    if (!insertRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur sauvegarde' });
    }

    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_42s5mbn';
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_VERIFY;
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'juoh_rOKaec16kxrH';

    if (!EMAILJS_TEMPLATE_ID) {
      return res.status(500).json({ status: 'ERROR', message: 'EMAILJS_TEMPLATE_VERIFY manquant dans Vercel' });
    }

    // ✅ إرسال عبر EmailJS (تم إصلاح الخطأ البرمجي هنا)
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
      const emailText = await emailRes.text();
      console.error("EmailJS Error:", emailRes.status, emailText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur envoi email',
        detail: emailText.slice(0, 200)
      });
    }

    return res.status(200).json({ status: 'OK', message: 'Code envoyé à ' + cleanEmail });

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
    const { email, code, turnstile_token } = req.body || {};

    if (!email || !code) return res.status(400).json({ status: 'ERROR', message: 'Email + code obligatoires' });

    const ip = getClientIp(req);
    const turnstileResult = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileResult.success) return res.status(403).json({ status: 'ERROR', message: 'Vérification anti-bot échouée.' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    if (!/^\d{6}$/.test(cleanCode)) return res.status(400).json({ status: 'ERROR', message: 'Code invalide (6 chiffres)' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_email_code`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: cleanEmail, p_code: cleanCode })
    });

    if (!rpcRes.ok) return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur' });

    const result = await rpcRes.json();
    return res.status(result.status === 'OK' ? 200 : 400).json(result);

  } catch (e) {
    console.error('handleCheck error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}
