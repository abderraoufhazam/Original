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

// استخراج IP من الطلب — ⚠️ يُستخدم لتحديد المعدل (rate limit)
//
// قاعدة الأمان: لا نثق أبداً بأول قيمة في x-forwarded-for، لأن العميل
// يستطيع إرسالها بأي قيمة (curl -H "X-Forwarded-For: 1.2.3.4").
// على Vercel:
//   1) x-real-ip يضبطه الـ proxy دائماً → المصدر الموثوق الأول.
//   2) x-forwarded-for: الـ proxy يُلحق IP الحقيقي في النهاية، فيكون
//      آخر عنصر هو القيمة الموثوقة، وما قبلها قد يكون مزوّراً.
export function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (!forwarded) return null;

  const raw = Array.isArray(forwarded) ? forwarded.join(',') : String(forwarded);
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // آخر عنصر = أقرب proxy (موثوق)، وليس أول عنصر (قابل للتزوير)
  return parts[parts.length - 1];
}
