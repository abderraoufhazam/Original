// api/submit.js
// API موحّد: feedback + report + message + signup
// + إشعارات واتساب تلقائية للأدمن عبر Green API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const type = (req.query && req.query.type) || (req.body && req.body.type);

  if (type === 'feedback') return handleFeedback(req, res);
  if (type === 'report')   return handleReport(req, res);
  if (type === 'message')  return handleMessage(req, res);
  if (type === 'signup')   return handleSignup(req, res);

  return res.status(400).json({
    status: 'ERROR',
    message: 'Type invalide. Utilisez: feedback, report, message ou signup'
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

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const row = {
      secret_code: cleanCode || null,
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
    const cleanBrand = (product_brand || '').trim().slice(0, 100) || null;
    const cleanProductName = (product_name || '').trim().slice(0, 200) || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
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

    // 🔔 إشعار واتساب (non-bloquant)
    sendWhatsApp(buildReportMessage({
      wilaya: cleanWilaya,
      product_brand: cleanBrand,
      product_name: cleanProductName,
      comment: cleanComment,
      ai_analyzed: !!(cleanBrand || cleanProductName)
    })).catch(e => console.warn('WhatsApp report:', e));

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
// TYPE 3: MESSAGE — رسائل الماركات + إشعار واتساب
// ============================================================
async function handleMessage(req, res) {
  try {
    const { brand_name, email, phone, subject, message } = req.body || {};

    if (!brand_name || !email) {
      return res.status(400).json({ status: 'ERROR', message: 'Données manquantes' });
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
// TYPE 4: SIGNUP — تسجيل ماركة جديدة + إشعار واتساب
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
// WHATSAPP HELPER — Green API (مع Debug)
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

  if (phone) lines.push(`📱 *Téléphone:* ${phone}`);
  if (subject) lines.push('', `📌 *Sujet:* ${subject}`);
  if (message) lines.push('', `💬 *Message:*`, truncate(message, 300));

  lines.push('', '👉 Répondez depuis le dashboard admin.');

  return lines.join('\n');
}

function buildSignupMessage(body) {
  const { brand_name, email, phone } = body;

  const lines = [
    '🎉 *NOUVELLE MARQUE INSCRITE*',
    '',
    `🏢 *Nom:* ${brand_name || '—'}`,
    `📧 *Email:* ${email || '—'}`,
  ];

  if (phone) lines.push(`📱 *Téléphone:* ${phone}`);

  lines.push('', '👉 Contactez-la pour la bienvenue.');

  return lines.join('\n');
}

function truncate(text, max) {
  const str = String(text || '');
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}
