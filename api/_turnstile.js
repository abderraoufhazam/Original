// api/_turnstile.js
// التحقق من Cloudflare Turnstile token

export async function verifyTurnstile(token, remoteIp = null) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing-token' };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
if (!secret) {
  console.error('❌ CRITICAL: TURNSTILE_SECRET_KEY not configured');
  return { success: false, error: 'server-misconfigured' };
}

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      return { success: false, error: 'turnstile-http-' + res.status };
    }

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: 'verification-failed',
        codes: data['error-codes'] || []
      };
    }

    return { success: true };

  } catch (e) {
    console.error('Turnstile verify error:', e);
    return { success: false, error: 'exception-' + String(e).slice(0, 100) };
  }
}

// استخراج IP من الطلب
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
    || req.headers['x-real-ip']
    || null;
}
