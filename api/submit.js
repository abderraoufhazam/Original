// api/submit.js
// API موحّد: feedback + report + message + signup + notify-shop
// + إشعارات واتساب تلقائية للأدمن عبر Green API
// + إشعار بريد إلكتروني عبر Resend

import { verifyTurnstile, getClientIp } from './_turnstile.js';
import { hashCode, maskCode } from './_crypto.js';

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
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }


  // 🔒 حد المحاولات — fail-open: لا نُعطّل الخدمة إن تعذّر الفحص
  try {
    const __ip = getClientIp(req) || 'unknown';
    const __rl = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ p_key: 'submit:' + __ip, p_limit: 10, p_window_seconds: 60 })
    });
    if (__rl.ok) {
      const __allowed = await __rl.json();
      if (__allowed === false) {
        return res.status(429).json({ status: 'ERROR', message: 'Trop de requêtes. Réessayez dans une minute.' });
      }
    }
  } catch (__e) {
    console.warn('rate limit skipped:', __e && __e.message);
  }

  const type = (req.query && req.query.type) || (req.body && req.body.type);

  if (type === 'email')       return handleEmail(req, res);
  if (type === 'feedback')    return handleFeedback(req, res);
  if (type === 'report')      return handleReport(req, res);
  if (type === 'message')     return handleMessage(req, res);
  if (type === 'signup')      return handleSignup(req, res);
  if (type === 'notify-shop') return handleNotifyShop(req, res);
  if (type === 'shop-email') return handleShopEmail(req, res);
  if (type === 'shop-complaint') return handleShopComplaint(req, res);

  // ── أسماء العلامات: فحص التوفر / الحجز / الدخول بالاسم ──
  if (type === 'brand-check')    return handleBrandCheck(req, res);
  if (type === 'brand-register') return handleBrandRegister(req, res);
  if (type === 'brand-login')    return handleBrandLogin(req, res);
  
  return res.status(400).json({
    status: 'ERROR',
    message: 'Type invalide. Utilisez: feedback, report, message, signup ou notify-shop'
  });
}

// ============================================================
// TYPE 1: FEEDBACK — التقييمات
// ============================================================
async function handleFeedback(req, res) {
  try {
    const { secret_code, type, rating, comment } = req.body || {};

    if (!type || (type !== 'rating' && type !== 'report')) {
      return res.status(400).json({ status: 'ERROR', message: 'Type invalide' });
    }

    const cleanCode = (secret_code || '').trim().toUpperCase();

    if (type === 'rating') {
      if (!cleanCode) {
        return res.status(400).json({ status: 'ERROR', message: 'Code manquant' });
      }
      const r = parseInt(rating, 10);
      if (!r || r < 1 || r > 5) {
        return res.status(400).json({ status: 'ERROR', message: 'Note invalide (1 à 5)' });
      }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration serveur manquante' });
    }

    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const row = {
      secret_code: maskCode(cleanCode),
      type: type,
      rating: type === 'rating' ? parseInt(rating, 10) : null,
      comment: (comment || '').trim().slice(0, 1000) || null,
      ip: ip,
      user_agent: userAgent
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Feedback insert error:', errText);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur' });
    }

    return res.status(200).json({
      status: 'OK',
      message: type === 'rating' ? 'Merci pour votre avis !' : 'Signalement enregistré.'
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}

// ============================================================
// TYPE 2: REPORT — بلاغات التقليد + إشعار واتساب
// ============================================================

// ============================================================
// مطابقة اسم العلامة تقريبياً (rutn / rrutn / rutin cosmetique → Rutin)
// ============================================================
function normalizeBrand(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// هيكل الاسم بلا حروف لينة (rrutne → rrtn / rutin → rtn)
function skeletonBrand(s) {
  return normalizeBrand(s)
    .replace(/[aeiouy\u064B-\u0652]/g, '')
    .replace(/\s+/g, '');
}

// Dice على ثنائيات الحروف
function bigramScore(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s) => {
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const A = grams(a), B = grams(b);
  let hits = 0;
  const pool = B.slice();
  for (const g of A) {
    const idx = pool.indexOf(g);
    if (idx !== -1) { hits++; pool.splice(idx, 1); }
  }
  return (2 * hits) / (A.length + B.length);
}

function brandScore(input, candidate) {
  const a = normalizeBrand(input);
  const b = normalizeBrand(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.88;

  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const dice = bigramScore(a, b);

  const sa = skeletonBrand(input);
  const sb = skeletonBrand(candidate);
  const skel = (sa.length >= 2 && sb.length >= 2)
    ? 1 - levenshtein(sa, sb) / Math.max(sa.length, sb.length)
    : 0;

  return Math.max(lev, dice * 0.95, skel);
}

async function resolveBrandName(input, url, key) {
  const clean = (input || '').trim();
  if (!clean) return clean;

  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    const [bm, qc] = await Promise.all([
      fetch(`${url}/rest/v1/brands_meta?select=brand_name&limit=1000`, { headers }),
      fetch(`${url}/rest/v1/qr_codes?select=brand&limit=1000`, { headers })
    ]);

    const list = [];
    if (bm.ok) {
      (await bm.json()).forEach(function (r) { if (r.brand_name) list.push(r.brand_name); });
    }
    if (qc.ok) {
      (await qc.json()).forEach(function (r) { if (r.brand) list.push(r.brand); });
    }

    const uniq = list.filter(function (v, i) { return v && list.indexOf(v) === i; });

    let best = null, score = 0, second = 0;
    for (const cand of uniq) {
      const s = brandScore(clean, cand);
      if (s > score) { second = score; score = s; best = cand; }
      else if (s > second) { second = s; }
    }

    // عتبة 0.6 + فارق واضح عن الاسم التالي (لتجنب الالتباس)
    if (best && score >= 0.6 && (score - second) >= 0.12) {
      console.log('Brand matched:', clean, '→', best, score.toFixed(2));
      return best;
    }
  } catch (e) {
    console.warn('resolveBrandName error:', String(e).slice(0, 120));
  }
  return clean;
}

async function handleReport(req, res) {
  try {
    const {
      attempted_code,
      wilaya,
      comment,
      product_image,
      product_description,
      product_brand,
      product_name
    } = req.body || {};

    if (!wilaya || typeof wilaya !== 'string' || wilaya.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Wilaya manquante' });
    }

    const cleanWilaya = wilaya.trim().slice(0, 50);
    const cleanCode = (attempted_code || '').trim().toUpperCase().slice(0, 20);
    const cleanComment = (comment || '').trim().slice(0, 500) || null;
    const cleanDesc = (product_description || '').trim().slice(0, 500) || null;
    let cleanBrand = (product_brand || '').trim().slice(0, 100) || null;
    const cleanProductName = (product_name || '').trim().slice(0, 200) || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // توجيه البلاغ للعلامة الصحيحة (مطابقة تقريبية)
    if (cleanBrand) {
      cleanBrand = await resolveBrandName(cleanBrand, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // رفع الصورة
    let imageUrl = null;

    if (product_image && typeof product_image === 'string' && product_image.startsWith('data:image/')) {
      try {
        const match = product_image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, 'base64');

          if (buffer.length > 5 * 1024 * 1024) {
            console.warn('Image trop grande:', buffer.length);
          } else {
            const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
            const fileName = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            const uploadRes = await fetch(
              `${SUPABASE_URL}/storage/v1/object/fake-products/${fileName}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': mimeType,
                  'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'x-upsert': 'false'
                },
                body: buffer
              }
            );

            if (uploadRes.ok) {
              imageUrl = `${SUPABASE_URL}/storage/v1/object/public/fake-products/${fileName}`;
            } else {
              const errText = await uploadRes.text();
              console.error('Upload error:', errText);
            }
          }
        }
      } catch (uploadErr) {
        console.error('Image processing error:', uploadErr);
      }
    }

    // إدراج في fake_reports
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/fake_reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        attempted_code: cleanCode || null,
        wilaya: cleanWilaya,
        comment: cleanComment,
        product_image: imageUrl,
        product_description: cleanDesc,
        product_brand: cleanBrand,
        product_name: cleanProductName,
        ai_analyzed: !!(cleanBrand || cleanProductName),
        ip: ip,
        user_agent: userAgent
      })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Insert error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur enregistrement',
        detail: errText.slice(0, 200)
      });
    }

    // 🔔 إشعار واتساب
    await sendWhatsApp(buildReportMessage({
      wilaya: cleanWilaya,
      product_brand: cleanBrand,
      product_name: cleanProductName,
      comment: cleanComment,
      ai_analyzed: !!(cleanBrand || cleanProductName)
    }));

    return res.status(200).json({
      status: 'OK',
      message: 'Signalement enregistré. Merci !',
      image_uploaded: !!imageUrl
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
// TYPE 3: MESSAGE — رسائل الماركات + Turnstile
// ============================================================
async function handleMessage(req, res) {
  try {
    const { brand_name, email, phone, subject, message, turnstile_token } = req.body || {};

    if (!brand_name || !email) {
      return res.status(400).json({ status: 'ERROR', message: 'Données manquantes' });
    }

    // 🔒 التحقق من Turnstile
    const ip = getClientIp(req);
    const turnstileResult = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileResult.success) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Vérification anti-bot échouée. Rechargez la page.'
      });
    }

    const result = await sendWhatsApp(buildMessageNotification({
      brand_name,
      email,
      phone,
      subject,
      message
    }));

    return res.status(200).json({
      status: 'OK',
      message: 'Notification envoyée',
      whatsapp_debug: result
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
// TYPE 4: SIGNUP — تسجيل ماركة/محل جديد + إشعار واتساب
// ============================================================
async function handleSignup(req, res) {
  try {
    const { brand_name, email, phone } = req.body || {};

    if (!brand_name || !email) {
      return res.status(400).json({ status: 'ERROR', message: 'Données manquantes' });
    }

    const result = await sendWhatsApp(buildSignupMessage({
      brand_name,
      email,
      phone
    }));

    return res.status(200).json({
      status: 'OK',
      message: 'Notification envoyée',
      whatsapp_debug: result
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
// TYPE 7: SHOP-EMAIL — إشعار المحل عبر Brevo
// ============================================================
async function handleShopEmail(req, res) {
  try {
    const {
      to_email,
      shop_name,
      shop_email,
      shop_phone,
      wilaya,
      approved_date
    } = req.body || {};

    if (!to_email || !shop_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'to_email + shop_name obligatoires'
      });
    }

    const BREVO_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_KEY) {
      console.error('BREVO_API_KEY not configured');
      return res.status(500).json({
        status: 'ERROR',
        message: 'Brevo non configuré'
      });
    }

    const date = approved_date || new Date().toLocaleDateString('ar-DZ', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const htmlContent = `
<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0, 31, 82,0.15);">

    <div style="background:linear-gradient(135deg,#16A96B,#45C98A);padding:36px 28px;text-align:center;color:#ffffff;">
      <div style="font-size:52px;line-height:1;margin-bottom:8px;">✅</div>
      <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">
        تم تفعيل حسابك!
      </h1>
    </div>

    <div style="padding:32px 28px;color:#001F52;line-height:1.8;">
      <p style="font-size:15px;margin:0 0 16px;">
        مرحبًا <b style="color:#16A96B;font-size:16px;">${escapeHtmlLocal(shop_name)}</b> 👋
      </p>

      <p style="font-size:14px;margin:0 0 20px;color:#334155;">
        يسعدنا إبلاغك بأنه تمت <b>الموافقة على تسجيل محلّك</b>
        في منصة <b>ORDIZ</b>. أصبح حسابك الآن نشطًا.
      </p>

      <div style="background:#f0fdf4;border:1.5px solid #45C98A;border-radius:14px;padding:18px 20px;margin:22px 0;">
        <div style="font-size:11px;color:#166534;font-weight:800;letter-spacing:1.5px;margin-bottom:10px;">
          📋 تفاصيل الحساب
        </div>
        <div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">🏪 المحل:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(shop_name)}</span>
        </div>
        ${shop_email ? `<div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">📧 البريد:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(shop_email)}</span>
        </div>` : ''}
        ${wilaya ? `<div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">📍 الولاية:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(wilaya)}</span>
        </div>` : ''}
        <div style="font-size:13.5px;">
          <b style="color:#166534;">📅 تاريخ الموافقة:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(date)}</span>
        </div>
      </div>

      <div style="text-align:center;margin:30px 0 22px;">
        <a href="https://ordiz.online/login?role=shop"
           style="display:inline-block;background:linear-gradient(135deg,#16A96B,#45C98A);color:#ffffff;padding:15px 34px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;">
          🔐 الدخول إلى حسابك
        </a>
      </div>

      <p style="font-size:12.5px;color:#64748b;margin:24px 0 0;text-align:center;line-height:1.7;">
        لأي استفسار، تواصل معنا على واتساب:
        <br>
        <b style="color:#16A96B;">+213 556 339 415</b>
      </p>
    </div>

    <div style="background:#001F52;padding:22px 28px;text-align:center;color:#94a3b8;">
      <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:4px;">ORDIZ</div>
      <div style="font-size:11px;letter-spacing:1px;">حماية المنتجات من التقليد</div>
      <div style="font-size:11px;margin-top:10px;">
        <a href="https://ordiz.online" style="color:#16A96B;text-decoration:none;">ordiz.online</a>
      </div>
    </div>

  </div>
</body>
</html>`;

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'ORDIZ',
          email: 'noreply@ordiz.online'
        },
        to: [{
          email: to_email,
          name: shop_name
        }],
        subject: `✅ تم تفعيل حساب محلك — ${shop_name}`,
        htmlContent: htmlContent
      })
    });

    const data = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Brevo error:', data);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur Brevo',
        detail: JSON.stringify(data).slice(0, 300)
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: 'Email envoyé',
      message_id: data.messageId
    });

  } catch (error) {
    console.error('handleShopEmail error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: String(error).slice(0, 200)
    });
  }
}

// ============================================================
// TYPE 8: SHOP-COMPLAINT — شكوى على منتج من محل موثوق
// 7 صور + بحث تلقائي عن المحل + بدون إشعار للمحل
// ============================================================
async function handleShopComplaint(req, res) {
  try {
    const {
      product_code,
      customer_name,
      customer_phone,
      customer_wilaya,
      product_price,
      purchase_location,
      notes,
      images   // مصفوفة base64 (7 صور)
    } = req.body || {};

    // ─── التحقق ───
    if (!product_code || typeof product_code !== 'string') {
      return res.status(400).json({ status: 'ERROR', message: 'Code manquant' });
    }
    if (!customer_name || customer_name.trim().length < 2) {
      return res.status(400).json({ status: 'ERROR', message: 'Nom obligatoire' });
    }
    if (!customer_phone || customer_phone.trim().length < 6) {
      return res.status(400).json({ status: 'ERROR', message: 'Téléphone obligatoire' });
    }
    if (!customer_wilaya || !customer_wilaya.trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Wilaya obligatoire' });
    }
    if (!Array.isArray(images) || images.length < 7) {
      return res.status(400).json({
        status: 'ERROR',
        message: '7 صور إلزامية (' + (images || []).length + ' مستلمة)'
      });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Config manquante' });
    }

    const cleanCode = String(product_code).trim().toUpperCase();

    // ─── 1. البحث عن الكود ───
    const codeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?secret_code_hash=eq.${hashCode(cleanCode)}&select=id,is_shop_lot,shop_name,shop_user_id,product_price&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    const codes = codeRes.ok ? await codeRes.json() : [];
    let shopId = null;
    let shopName = null;

    // ─── 2. البحث عن المحل (بدون علمه) ───
    if (codes.length > 0 && codes[0].is_shop_lot && codes[0].shop_user_id) {
      const shopRes = await fetch(
        `${SUPABASE_URL}/rest/v1/verified_shops?user_id=eq.${codes[0].shop_user_id}&select=id,shop_name,status&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );
      const shops = shopRes.ok ? await shopRes.json() : [];
      if (shops.length > 0) {
        shopId = shops[0].id;
        shopName = shops[0].shop_name;
      }
    }

    // ─── 3. رفع 7 صور ───
    const uploadedUrls = [];
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);

    for (let i = 0; i < images.length && i < 7; i++) {
      try {
        const img = images[i];
        if (!img || typeof img !== 'string') continue;

        const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!match) continue;

        const mime = match[1];
        const b64 = match[2];
        const buffer = Buffer.from(b64, 'base64');

        if (buffer.length > 2 * 1024 * 1024) {
          console.warn(`Image ${i + 1} trop grande:`, buffer.length);
          continue;
        }

        const ext = mime.split('/')[1].replace('jpeg', 'jpg');
        const fileName = `complaints/${cleanCode}-${ts}-${i}-${rand}.${ext}`;

        const up = await fetch(
          `${SUPABASE_URL}/storage/v1/object/fake-products/${fileName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': mime,
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'x-upsert': 'false'
            },
            body: buffer
          }
        );

        if (up.ok) {
          uploadedUrls.push(
            `${SUPABASE_URL}/storage/v1/object/public/fake-products/${fileName}`
          );
        } else {
          const err = await up.text();
          console.error(`Upload ${i + 1} failed:`, err.slice(0, 150));
        }
      } catch (e) {
        console.error(`Image ${i + 1} error:`, e.message);
      }
    }

    if (uploadedUrls.length < 7) {
      return res.status(500).json({
        status: 'ERROR',
        message: `فقط ${uploadedUrls.length}/7 صور رُفعت`,
        uploaded: uploadedUrls.length
      });
    }

    // ─── 4. إدراج الشكوى ───
    const ip = getClientIp(req) || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const cleanPrice = parseFloat(product_price) || 0;

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/shop_complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        shop_id: shopId,
        shop_name: shopName,
        product_code: cleanCode,
        customer_name: customer_name.trim().slice(0, 100),
        customer_phone: customer_phone.trim().slice(0, 30),
        customer_wilaya: customer_wilaya.trim().slice(0, 50),
        product_price: cleanPrice,
        purchase_location: (purchase_location || '').trim().slice(0, 300) || null,
        notes: (notes || '').trim().slice(0, 1000) || null,
        images: uploadedUrls,
        image_count: uploadedUrls.length,
        status: 'PENDING',
        ip: ip,
        user_agent: ua.slice(0, 300)
      })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Complaint insert error:', err);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur enregistrement',
        detail: err.slice(0, 200)
      });
    }

    const inserted = await insertRes.json();
    const complaint = Array.isArray(inserted) ? inserted[0] : inserted;

    // ─── 5. إشعار واتساب للأدمن فقط ───
    try {
      await sendWhatsApp([
        '🚨 *شكوى جديدة على محل*',
        '',
        `🏪 *المحل:* ${shopName || '(غير مرتبط)'}`,
        `📦 *الكود:* ${cleanCode}`,
        `👤 *الزبون:* ${customer_name}`,
        `📱 *الهاتف:* ${customer_phone}`,
        `📍 *الولاية:* ${customer_wilaya}`,
        `💰 *السعر:* ${cleanPrice} دج`,
        '',
        '👉 راجعها في /admin'
      ].join('\n'));
    } catch (e) {
      console.warn('WA notify error:', e.message);
    }

    return res.status(200).json({
      status: 'OK',
      message: 'تم استلام الشكوى بنجاح',
      complaint_id: complaint.id,
      images_count: uploadedUrls.length,
      shop_linked: !!shopId
    });

  } catch (error) {
    console.error('handleShopComplaint error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 300)
    });
  }
}

// ============================================================
// TYPE 5: NOTIFY-SHOP — إشعار محل عند الموافقة (Resend)
// ============================================================
async function handleNotifyShop(req, res) {
  try {
    const {
      to_email,
      shop_name,
      shop_email,
      shop_phone,
      wilaya,
      approved_date
    } = req.body || {};

    if (!to_email || !shop_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'to_email + shop_name obligatoires'
      });
    }

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      console.error('RESEND_API_KEY not configured');
      return res.status(500).json({
        status: 'ERROR',
        message: 'Resend non configuré'
      });
    }

    // من أين يُرسل البريد
    // - للتجربة: onboarding@resend.dev (يعمل فقط إلى إيميلك)
    // - للإنتاج: شيء@ordiz.online (بعد توثيق الدومين)
    const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
    const FROM_NAME = 'ORDIZ';

    const date = approved_date || new Date().toLocaleDateString('ar-DZ', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const html = `
<!doctype html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0, 31, 82,0.15);">

    <div style="background:linear-gradient(135deg,#16A96B,#45C98A);padding:36px 28px;text-align:center;color:#ffffff;">
      <div style="font-size:52px;line-height:1;margin-bottom:8px;">✅</div>
      <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">
        تم تفعيل حسابك!
      </h1>
    </div>

    <div style="padding:32px 28px;color:#001F52;line-height:1.8;">
      <p style="font-size:15px;margin:0 0 16px;">
        مرحبًا <b style="color:#16A96B;font-size:16px;">${escapeHtmlLocal(shop_name)}</b> 👋
      </p>

      <p style="font-size:14px;margin:0 0 20px;color:#334155;">
        يسعدنا إبلاغك بأنه تمت <b>الموافقة على تسجيل محلّك</b>
        في منصة <b>ORDIZ</b>. أصبح حسابك الآن نشطًا.
      </p>

      <div style="background:#f0fdf4;border:1.5px solid #45C98A;border-radius:14px;padding:18px 20px;margin:22px 0;">
        <div style="font-size:11px;color:#166534;font-weight:800;letter-spacing:1.5px;margin-bottom:10px;">
          📋 تفاصيل الحساب
        </div>
        <div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">🏪 المحل:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(shop_name)}</span>
        </div>
        ${shop_email ? `<div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">📧 البريد:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(shop_email)}</span>
        </div>` : ''}
        ${wilaya ? `<div style="font-size:13.5px;margin-bottom:8px;">
          <b style="color:#166534;">📍 الولاية:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(wilaya)}</span>
        </div>` : ''}
        <div style="font-size:13.5px;">
          <b style="color:#166534;">📅 تاريخ الموافقة:</b>
          <span style="color:#001F52;font-weight:700;">${escapeHtmlLocal(date)}</span>
        </div>
      </div>

      <div style="text-align:center;margin:30px 0 22px;">
        <a href="https://ordiz.online/login?role=shop"
           style="display:inline-block;background:linear-gradient(135deg,#16A96B,#45C98A);color:#ffffff;padding:15px 34px;border-radius:12px;text-decoration:none;font-weight:800;font-size:14px;">
          🔐 الدخول إلى حسابك
        </a>
      </div>

      <p style="font-size:12.5px;color:#64748b;margin:24px 0 0;text-align:center;line-height:1.7;">
        لأي استفسار، تواصل معنا على واتساب:
        <br>
        <b style="color:#16A96B;">+213 556 339 415</b>
      </p>
    </div>

    <div style="background:#001F52;padding:22px 28px;text-align:center;color:#94a3b8;">
      <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:4px;">ORDIZ</div>
      <div style="font-size:11px;letter-spacing:1px;">حماية المنتجات من التقليد</div>
      <div style="font-size:11px;margin-top:10px;">
        <a href="https://ordiz.online" style="color:#16A96B;text-decoration:none;">ordiz.online</a>
      </div>
    </div>

  </div>
</body>
</html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM}>`,
        to: [to_email],
        subject: `✅ تم تفعيل حساب محلك — ${shop_name}`,
        html: html
      })
    });

    const data = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur Resend',
        detail: JSON.stringify(data).slice(0, 300)
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: 'Email envoyé',
      email_id: data.id
    });

  } catch (error) {
    console.error('handleNotifyShop error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: String(error).slice(0, 200)
    });
  }
}

// Helper: escape HTML
function escapeHtmlLocal(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}

// ============================================================
// WHATSAPP HELPER — Green API
// ============================================================
async function sendWhatsApp(message) {
  const apiUrl = process.env.GREEN_API_URL;
  const idInstance = process.env.GREEN_ID_INSTANCE;
  const apiToken = process.env.GREEN_API_TOKEN;
  const to = process.env.WHATSAPP_TO;

  if (!apiUrl || !idInstance || !apiToken || !to) {
    return {
      success: false,
      error: 'Missing env vars',
      debug: {
        hasApiUrl: !!apiUrl,
        hasIdInstance: !!idInstance,
        hasApiToken: !!apiToken,
        hasTo: !!to,
        idInstance: idInstance || 'NOT SET',
        to: to || 'NOT SET'
      }
    };
  }

  try {
    const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`;
    const chatId = `${to}@c.us`;

    console.log('Green API: Sending to', chatId);

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chatId,
        message: message
      })
    });

    let data;
    try {
      data = await r.json();
    } catch (e) {
      data = { parse_error: String(e), raw: 'non-JSON response' };
    }

    console.log('Green API response:', r.status, data);

    if (!r.ok) {
      return {
        success: false,
        status: r.status,
        chatId: chatId,
        url_used: url.replace(apiToken, '***TOKEN***'),
        response: data
      };
    }

    return {
      success: true,
      status: r.status,
      chatId: chatId,
      response: data
    };

  } catch (e) {
    return {
      success: false,
      error: String(e),
      stack: e.stack ? e.stack.slice(0, 200) : null
    };
  }
}

// ============================================================
// TYPE 9: EMAIL — إرسال بريد إلكتروني عبر EmailJS
// ============================================================
async function handleEmail(req, res) {
  try {
    const {
      template,        // 'contact' أو 'verify' أو 'admin'
      to_email,
      brand_name,
      email,
      phone,
      subject,
      message,
      code,            // للتحقق
      turnstile_token
    } = req.body || {};

    // ─── التحقق الأساسي ───
    if (!template || !['contact', 'verify', 'admin'].includes(template)) {
      return res.status(400).json({ status: 'ERROR', message: 'template invalide' });
    }

    // 🔒 التحقق من Turnstile (للبريد العام فقط)
    if (template === 'contact') {
      const ip = getClientIp(req);
      const turnstileResult = await verifyTurnstile(turnstile_token, ip);
      if (!turnstileResult.success) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Vérification anti-bot échouée.'
        });
      }
    }

    // ─── جلب مفاتيح EmailJS من البيئة ───
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;

    let templateId;
    let templateParams;

    if (template === 'contact') {
      templateId = process.env.EMAILJS_TEMPLATE_ID;
      if (!to_email || !brand_name) {
        return res.status(400).json({ status: 'ERROR', message: 'to_email + brand_name obligatoires' });
      }
      templateParams = {
        to_email: to_email,
        brand_name: brand_name,
        email: email || 'guest@ordiz.online',
        phone: phone || '—',
        subject: subject || '(sans sujet)',
        message: message || ''
      };
    } else if (template === 'verify') {
      templateId = process.env.EMAILJS_TEMPLATE_VERIFY;
      if (!to_email || !brand_name || !code) {
        return res.status(400).json({ status: 'ERROR', message: 'to_email + brand_name + code obligatoires' });
      }
      templateParams = {
        to_email: to_email,
        brand_name: brand_name,
        code: code
      };
    } else if (template === 'admin') {
      templateId = process.env.EMAILJS_TEMPLATE_ADMIN;
      if (!to_email || !subject) {
        return res.status(400).json({ status: 'ERROR', message: 'to_email + subject obligatoires' });
      }
      templateParams = {
        to_email: to_email,
        subject: subject,
        message: message || ''
      };
    }

    if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !templateId) {
      console.error('❌ EmailJS env vars manquantes pour template:', template);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Configuration email manquante'
      });
    }

    // ─── إرسال البريد ───
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('EmailJS error:', emailRes.status, errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur envoi email',
        detail: errText.slice(0, 200)
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: 'Email envoyé'
    });

  } catch (error) {
    console.error('handleEmail error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: String(error).slice(0, 200)
    });
  }
}

// ============================================================
// BUILDERS
// ============================================================
function buildReportMessage(body) {
  const { wilaya, product_brand, product_name, comment, ai_analyzed } = body;

  const lines = [
    '🚨 *NOUVEAU SIGNALEMENT*',
    '',
    `📍 *Wilaya:* ${wilaya || '—'}`,
  ];

  if (product_brand) lines.push(`🏢 *Marque:* ${product_brand}`);
  if (product_name) lines.push(`📦 *Produit:* ${product_name}`);
  if (ai_analyzed) lines.push(`🤖 *Analysé par IA:* Oui`);
  if (comment) lines.push('', `💬 *Commentaire:*`, truncate(comment, 200));

  lines.push('', '👉 Ouvrez votre dashboard pour traiter.');

  return lines.join('\n');
}

function buildMessageNotification(body) {
  const { brand_name, email, phone, subject, message } = body;

  const lines = [
    '📩 *NOUVEAU MESSAGE*',
    '',
    `🏢 *Marque:* ${brand_name || '—'}`,
    `📧 *Email:* ${email || '—'}`,
  ];

  lines.push(`📱 *Téléphone:* ${phone || '—'}`);
  if (subject) lines.push('', `📌 *Sujet:* ${subject}`);
  if (message) lines.push('', `💬 *Message:*`, truncate(message, 300));

  lines.push('', '👉 Répondez depuis le dashboard admin.');

  return lines.join('\n');
}

function buildSignupMessage(body) {
  const { brand_name, email, phone } = body;

  const lines = [
    '🎉 *NOUVELLE INSCRIPTION*',
    '',
    `🏢 *Nom:* ${brand_name || '—'}`,
    `📧 *Email:* ${email || '—'}`,
  ];

  lines.push(`📱 *Téléphone:* ${phone || '—'}`);

  lines.push('', '👉 Vérifiez dans votre dashboard admin.');

  return lines.join('\n');
}

function truncate(text, max) {
  const str = String(text || '');
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

// ============================================================
// أسماء العلامات — فحص التوفر / الحجز / الدخول بالاسم
// ============================================================

/** تطبيع اسم العلامة: تشذيب + توحيد المسافات + حروف صغيرة */
function normBrandName(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function brandSvc(key) {
  return { "apikey": key, "Authorization": `Bearer ${key}` };
}

// ── 1) فحص توفر الاسم (قبل التسجيل) ──
async function handleBrandCheck(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !KEY) {
      return res.status(500).json({ status: "ERROR", message: "Configuration manquante" });
    }

    const raw = String((req.body && req.body.brand_name) || "").trim();
    if (raw.length < 2) return res.status(400).json({ status: "ERROR", message: "Nom trop court (2 caractères min)" });
    if (raw.length > 80) return res.status(400).json({ status: "ERROR", message: "Nom trop long (80 caractères max)" });

    const norm = normBrandName(raw);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/brand_names?brand_name_norm=eq.${encodeURIComponent(norm)}&select=user_id&limit=1`,
      { headers: brandSvc(KEY) }
    );
    if (!r.ok) return res.status(500).json({ status: "ERROR", message: "Erreur serveur" });

    const rows = await r.json();
    return res.status(200).json({ status: "OK", available: !(Array.isArray(rows) && rows.length > 0) });
  } catch (e) {
    console.error("brand-check:", e);
    return res.status(500).json({ status: "ERROR", message: "Erreur inattendue" });
  }
}

// ── 2) حجز الاسم بعد نجاح التسجيل ──
async function handleBrandRegister(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !KEY) {
      return res.status(500).json({ status: "ERROR", message: "Configuration manquante" });
    }

    const body = req.body || {};
    const token = String(req.headers.authorization || body.access_token || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ status: "ERROR", message: "Non authentifié" });

    const uRes2 = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": KEY, "Authorization": `Bearer ${token}` }
    });
    if (!uRes2.ok) return res.status(401).json({ status: "ERROR", message: "Token invalide" });

    const user = await uRes2.json();
    const raw = String(body.brand_name || (user.user_metadata && user.user_metadata.brand_name) || "").trim();
    if (raw.length < 2) return res.status(400).json({ status: "ERROR", message: "Nom invalide" });

    const norm = normBrandName(raw);
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/brand_names`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": KEY,
        "Authorization": `Bearer ${KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify([{ brand_name_norm: norm, brand_name: raw, user_id: user.id }])
    });

    if (ins.status === 409) {
      return res.status(409).json({ status: "CONFLICT", message: "Ce nom de marque est déjà utilisé" });
    }
    if (!ins.ok) {
      const t = await ins.text();
      console.error("brand-register:", ins.status, t.slice(0, 200));
      return res.status(500).json({ status: "ERROR", message: "Erreur enregistrement" });
    }

    return res.status(200).json({ status: "OK", brand_name: raw });
  } catch (e) {
    console.error("brand-register:", e);
    return res.status(500).json({ status: "ERROR", message: "Erreur inattendue" });
  }
}

// ── 3) الدخول باسم العلامة ──
async function handleBrandLogin(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";
    if (!SUPABASE_URL || !KEY) {
      return res.status(500).json({ status: "ERROR", message: "Configuration manquante" });
    }

    const body = req.body || {};
    const raw = String(body.brand_name || "").trim();
    const password = String(body.password || "");
    const fail = () => res.status(401).json({ status: "ERROR", message: "Nom de marque ou mot de passe incorrect" });

    if (raw.length < 2 || password.length < 1) return fail();

    const norm = normBrandName(raw);

    // حد إضافي موجّه للاسم نفسه (يحمي من هجوم موزّع على ماركة واحدة)
    try {
      const rl = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...brandSvc(KEY) },
        body: JSON.stringify({ p_key: "brandlogin:" + norm, p_limit: 8, p_window_seconds: 60 })
      });
      if (rl.ok) {
        const allowed = await rl.json();
        if (allowed === false) {
          return res.status(429).json({ status: "ERROR", message: "Trop de tentatives. Réessayez dans une minute." });
        }
      }
    } catch (e) { /* fail-open */ }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/brand_names?brand_name_norm=eq.${encodeURIComponent(norm)}&select=user_id&limit=1`,
      { headers: brandSvc(KEY) }
    );
    if (!r.ok) return res.status(500).json({ status: "ERROR", message: "Erreur serveur" });

    const rows = await r.json();
    let userId = Array.isArray(rows) && rows.length > 0 ? rows[0].user_id : null;

    // ── احتياط: اسم موجود في الحسابات لكن لم يُسجَّل بعد في السجل
    //    (حساب قديم أو لم يؤكّد بريده وقت التسجيل)
    if (!userId) {
      for (let page = 1; page <= 5 && !userId; page++) {
        const listRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`,
          { headers: brandSvc(KEY) }
        );
        if (!listRes.ok) break;

        const list = await listRes.json();
        const users = (list && list.users) || [];
        if (users.length === 0) break;

        const found = users.find(u => {
          const meta = u.user_metadata || {};
          const role = String(meta.role || "brand").toLowerCase();
          if (role !== "brand") return false;
          return normBrandName(meta.brand_name) === norm;
        });

        if (found) userId = found.id;
      }
    }

    if (!userId) return fail();

    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: brandSvc(KEY)
    });
    if (!uRes.ok) return fail();

    const u = await uRes.json();
    if (!u || !u.email) return fail();

    const tok = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ANON },
      body: JSON.stringify({ email: u.email, password })
    });
    if (!tok.ok) return fail();

    const session = await tok.json();
    if (!session || !session.access_token) return fail();

    // تسجيل الاسم في السجل تلقائياً (إن لم يكن مسجّلاً) — لضمان التفرد مستقبلاً
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/brand_names`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": KEY,
          "Authorization": `Bearer ${KEY}`,
          "Prefer": "return=minimal,resolution=ignore-duplicates"
        },
        body: JSON.stringify([{ brand_name_norm: norm, brand_name: raw, user_id: userId }])
      });
    } catch (e) { /* لا نُفشل الدخول بسبب ذلك */ }

    return res.status(200).json({
      status: "OK",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user
      }
    });
  } catch (e) {
    console.error("brand-login:", e);
    return res.status(500).json({ status: "ERROR", message: "Erreur inattendue" });
  }
}
