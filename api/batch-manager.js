// api/batch-manager.js
// API Ù…ÙˆØ­Ù‘Ø¯: create (Ø¥Ù†Ø´Ø§Ø¡ Ø¯ÙØ¹Ø©) + print (ÙÙƒ ØªØ´ÙÙŠØ± Ù„Ù„Ø·Ø¨Ø§Ø¹Ø©)
// Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…:
//   POST /api/batch-manager?action=create   { brand, quantity, ... }
//   POST /api/batch-manager?action=print    { lot }

import { hashCode, encryptCode, generateSecretCode, decryptCode, encryptCodeWith, decryptCodeWith } from './_crypto.js';
import { getClientIp } from './_turnstile.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
export default async function handler(req, res) {
  // âœ… CORS Ù…Ø­Ù…ÙŠ â€” Ù‚Ø§Ø¦Ù…Ø© Ø£ØµÙˆÙ„ Ù…Ø³Ù…ÙˆØ­Ø©
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

  const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (action === 'create') return handleCreate(req, res);
  if (action === 'update-lot') return handleUpdateLot(req, res);
  if (action === 'print')  return handlePrint(req, res);
  if (action === 'export') return handleExportCodes(req, res);
  if (action === 'stats')  return handleWilayaStats(req, res);
  if (action === 'rekey')  return handleRekey(req, res);
  if (action === 'rekey-status') return handleRekeyStatus(req, res);
  if (action === 'reports') return handleWilayaReports(req, res);
  if (action === 'trend')   return handleWilayaTrend(req, res);
  if (action === 'add-codes') return handleAddCodes(req, res);

  return res.status(400).json({
    status: 'ERROR',
    message: 'Action invalide. Utilisez ?action=create ou ?action=print'
  });
}

// ============================================================
// ACTION 1: CREATE â€” Ø¥Ù†Ø´Ø§Ø¡ Ø¯ÙØ¹Ø© Ø¬Ø¯ÙŠØ¯Ø©
// ============================================================

// ============================================================
// ACTION: UPDATE-LOT — تعديل معلومات لوط (أدمن أو مالك العلامة)
// ============================================================
async function handleUpdateLot(req, res) {
  try {
    const {
      lot, brand, product_name, reference, manufacture_date, expiry_date,
      description, product_image, logo_url, instagram_url, facebook_url, tiktok_url,
      access_token
    } = req.body || {};

    if (!lot || !lot.trim()) return res.status(400).json({ status: 'ERROR', message: 'lot obligatoire' });
    if (!brand || !brand.trim()) return res.status(400).json({ status: 'ERROR', message: 'brand obligatoire' });
    if (!access_token) return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userRes.ok) return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });

    const userData = await userRes.json();
    const userEmail = String(userData.email || '').toLowerCase();
    const userBrand = String((userData.user_metadata && userData.user_metadata.brand_name) || '').trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail);
    const isOwner = userBrand !== '' && userBrand === brand.trim().toLowerCase();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ status: 'ERROR', message: 'لا تملك صلاحية تعديل هذه الدفعة.' });
    }

    const fields = {
      product_name: product_name && product_name.trim ? product_name.trim() || null : null,
      reference: reference && reference.trim ? reference.trim() || null : null,
      manufacture_date: manufacture_date || null,
      expiry_date: expiry_date || null,
      description: description && description.trim ? description.trim() || null : null,
      product_image: product_image || null,
      logo_url: logo_url || null,
      instagram_url: instagram_url || null,
      facebook_url: facebook_url || null,
      tiktok_url: tiktok_url || null
    };

    const updRes = await fetch(
      SUPABASE_URL + '/rest/v1/qr_codes?lot=eq.' + encodeURIComponent(lot.trim()) + '&brand=eq.' + encodeURIComponent(brand.trim()),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(fields)
      }
    );

    if (!updRes.ok) {
      const errText = await updRes.text();
      console.error('update-lot error:', updRes.status, errText.slice(0, 200));
      return res.status(500).json({ status: 'ERROR', message: 'فشل تحديث الدفعة', detail: errText.slice(0, 200) });
    }

    return res.status(200).json({ status: 'OK', message: 'تم تحديث معلومات الدفعة.' });
  } catch (e) {
    console.error('handleUpdateLot error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 200) });
  }
}


async function handleCreate(req, res) {
  try {
    const {
      brand, product_name, reference, lot,
      manufacture_date, expiry_date, product_image, logo_url,
      instagram_url, facebook_url, tiktok_url, description,
      quantity, access_token, initial_status
    } = req.body || {};

    if (!brand || typeof brand !== 'string' || brand.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Marque obligatoire' });
    }
    const MIN_BATCH = 1;
    const MAX_BATCH = 200000;
    const rawQty = parseInt(quantity, 10) || 0;

    if (!rawQty || rawQty < MIN_BATCH) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'أدخل كمية صحيحة أكبر من صفر',
        minimum: MIN_BATCH
      });
    }

    const qty = Math.min(MAX_BATCH, rawQty);
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });
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

    // 🔒 الأمن: أدمن أو مالك العلامة فقط يستطيع إنشاء دفعة باسمها
    const userData = await userRes.json();
    const userEmail = String(userData.email || '').toLowerCase();
    const userBrand = String((userData.user_metadata && userData.user_metadata.brand_name) || '').trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail);
    const isOwner = userBrand !== '' && userBrand === brand.trim().toLowerCase();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'لا تملك صلاحية إنشاء دفعة لهذه العلامة التجارية.'
      });
    }

    // âœ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø¹Ø¯Ù… ÙˆØ¬ÙˆØ¯ Ø¯ÙØ¹Ø© Ø¨Ù†ÙØ³ Ø±Ù‚Ù… Ø§Ù„Ù„ÙˆØª
    const lotToCheck = lot?.trim();
    if (lotToCheck) {
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/qr_codes?lot=ilike.${encodeURIComponent(lotToCheck)}&select=id&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );

      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing && existing.length > 0) {
          return res.status(400).json({
            status: 'ERROR',
            message: `Ø±Ù‚Ù… Ø§Ù„Ø¯ÙØ¹Ø© "${lotToCheck}" Ù…Ø³ØªØ¹Ù…Ù„ Ø¨Ø§Ù„ÙØ¹Ù„. Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø§Ø®ØªÙŠØ§Ø± Ø±Ù‚Ù… Ø¢Ø®Ø± Ø£Ùˆ Ø­Ø°Ù Ø§Ù„Ø¯ÙØ¹Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ø£ÙˆÙ„Ø§Ù‹.`
          });
        }
      }
    }
    const codes = [];
    // âœ… Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† user_id Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„Ù…Ø§Ø±ÙƒØ©
    let brandUserId = null;
    try {
      const usersRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const users = usersData.users || [];
        const matchedUser = users.find(u => 
          (u.user_metadata?.brand_name || '').toLowerCase() === brand.trim().toLowerCase()
        );
        if (matchedUser) {
          brandUserId = matchedUser.id;
          console.log('âœ… Found brand user_id:', brandUserId, 'for brand:', brand.trim());
        } else {
          console.warn('âš ï¸ No user found for brand:', brand.trim());
        }
      }
    } catch (e) {
      console.warn('User lookup error:', e);
    }

    const rows = [];

    const status = (initial_status === 'PENDING') ? 'PENDING' : 'UNUSED';

    for (let i = 0; i < qty; i++) {
      const code = generateSecretCode();
      codes.push(code);
      rows.push({
        secret_code: code,
        secret_code_hash: hashCode(code),
        secret_code_encrypted: encryptCode(code),
        secret_status: status,
        brand: brand.trim(),
        user_id: brandUserId, // âœ… Ø±Ø¨Ø· Ø§Ù„ÙƒÙˆØ¯ Ø¨Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø§Ø±ÙƒØ©
        product_name: product_name?.trim() || null,
        reference: reference?.trim() || null,
        lot: lot?.trim() || null,
        manufacture_date: manufacture_date || null,
        expiry_date: expiry_date || null,
        product_image: product_image?.trim() || null,
        logo_url: logo_url?.trim() || null,
        instagram_url: instagram_url?.trim() || null,
        facebook_url: facebook_url?.trim() || null,
        tiktok_url: tiktok_url?.trim() || null,
        description: description?.trim() || null
      });
    }

    const chunkSize = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(chunk)
      });

      if (!insertRes.ok) {
        const err = await insertRes.text();
        console.error('Insert error:', err);
        return res.status(500).json({
          status: 'ERROR',
          message: 'Erreur insertion',
          detail: err.slice(0, 300),
          inserted: inserted
        });
      }
      inserted += chunk.length;
    }

    return res.status(200).json({
      status: 'OK',
      inserted: inserted,
      codes: codes,
      lot: lot || null,
      brand: brand.trim(),
      initial_status: status
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


// ============================================================
// ACTION: ADD-CODES — إضافة أكواد إلى لوت موجود (دون تغيير القديم)
// ============================================================
async function handleAddCodes(req, res) {
  try {
    const { lot, quantity, access_token, initial_status } = req.body || {};
    const lotTrim = String(lot || '').trim();
    const qty = Math.min(200000, parseInt(quantity, 10) || 0);

    if (!lotTrim) return res.status(400).json({ status: 'ERROR', message: 'رقم اللوت مطلوب' });
    if (!qty || qty < 1) return res.status(400).json({ status: 'ERROR', message: 'أدخل كمية صحيحة أكبر من صفر' });
    if (!access_token) return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // 1) مصادقة المستخدم
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${access_token}` }
    });
    if (!userRes.ok) return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    const userData = await userRes.json();
    const userEmail = String(userData.email || '').toLowerCase();
    const userBrand = String((userData.user_metadata && userData.user_metadata.brand_name) || '').trim().toLowerCase();

    // 2) جلب بيانات اللوت الحالي
    const lotRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(lotTrim)}&select=brand,product_name,reference,manufacture_date,expiry_date,product_image,logo_url,instagram_url,facebook_url,tiktok_url,description,user_id&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    if (!lotRes.ok) return res.status(500).json({ status: 'ERROR', message: 'تعذّر قراءة اللوت' });
    const lotRows = await lotRes.json();
    if (!Array.isArray(lotRows) || lotRows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: `اللوت "${lotTrim}" غير موجود` });
    }
    const meta = lotRows[0];
    const metaBrand = String(meta.brand || '').trim().toLowerCase();

    // 3) صلاحية: أدمن أو مالك العلامة
    const isAdmin = ADMIN_EMAILS.includes(userEmail);
    const isOwner = userBrand !== '' && userBrand === metaBrand;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ status: 'ERROR', message: 'لا تملك صلاحية الإضافة لهذه العلامة' });
    }

    // 4) توليد الأكواد الجديدة (بنفس بيانات اللوت)
    const status = (initial_status === 'PENDING') ? 'PENDING' : 'UNUSED';
    const rows = [];
    const codes = [];
    for (let i = 0; i < qty; i++) {
      const code = generateSecretCode();
      codes.push(code);
      rows.push({
        secret_code: code,
        secret_code_hash: hashCode(code),
        secret_code_encrypted: encryptCode(code),
        secret_status: status,
        brand: meta.brand || null,
        user_id: meta.user_id || null,
        product_name: meta.product_name || null,
        reference: meta.reference || null,
        lot: lotTrim,
        manufacture_date: meta.manufacture_date || null,
        expiry_date: meta.expiry_date || null,
        product_image: meta.product_image || null,
        logo_url: meta.logo_url || null,
        instagram_url: meta.instagram_url || null,
        facebook_url: meta.facebook_url || null,
        tiktok_url: meta.tiktok_url || null,
        description: meta.description || null
      });
    }

    // 5) إدراج على دفعات
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(chunk)
      });
      if (!insertRes.ok) {
        const err = await insertRes.text();
        console.error('add-codes insert error:', err);
        return res.status(500).json({ status: 'ERROR', message: 'خطأ في الإدراج', detail: err.slice(0, 300), inserted });
      }
      inserted += chunk.length;
    }

    return res.status(200).json({
      status: 'OK',
      inserted,
      added: inserted,
      codes,
      lot: lotTrim,
      brand: meta.brand || null,
      initial_status: status
    });
  } catch (error) {
    console.error('handleAddCodes error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'خطأ غير متوقع', detail: String(error).slice(0, 300) });
  }
}

// ============================================================
// ACTION 2: PRINT â€” ÙÙƒ ØªØ´ÙÙŠØ± Ø¯ÙØ¹Ø© Ù„Ù„Ø·Ø¨Ø§Ø¹Ø©
// ============================================================
async function handlePrint(req, res) {
  try {
    const { lot, access_token } = req.body || {};

    if (!lot || typeof lot !== 'string' || lot.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Lot obligatoire' });
    }
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”’ ÙØ­Øµ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©: Ø§Ù„Ø£Ø¯Ù…Ù† Ø£Ùˆ ØµØ§Ø­Ø¨ Ø§Ù„Ø¯ÙØ¹Ø© ÙÙ‚Ø·
    // Ù‚Ø¨Ù„ Ù‡Ø°Ø§ Ø§Ù„Ø¥ØµÙ„Ø§Ø­ ÙƒØ§Ù† Ø£ÙŠ Ù…Ø³ØªØ®Ø¯Ù… Ù…Ø³Ø¬Ù‘Ù„ ÙŠØ³ØªØ·ÙŠØ¹ Ù‚Ø±Ø§Ø¡Ø© Ø£ÙƒÙˆØ§Ø¯
    // Ø£ÙŠ Ø¯ÙØ¹Ø© Ø¨Ù…Ø¹Ø±ÙØ© Ø±Ù‚Ù…Ù‡Ø§ ÙÙ‚Ø· (ØªØ¬Ø§ÙˆØ² ØµÙ„Ø§Ø­ÙŠØ§Øª / IDOR).
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const user = await userRes.json();
    const userId = user && user.id;

    if (!userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const svcHeaders = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    };
    const cleanLot = lot.trim();

    // 1) Ù‡Ù„ Ø§Ù„Ø·Ø§Ù„Ø¨ Ø£Ø¯Ù…Ù†ØŸ
    let isAdmin = false;
    try {
      const adminRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id`,
        { headers: svcHeaders }
      );
      if (adminRes.ok) {
        const admins = await adminRes.json();
        if (Array.isArray(admins) && admins.length > 0) isAdmin = true;
      }
    } catch (e) {
      console.warn('print: admins check failed', e);
    }

    if (!isAdmin) {
      const email = String(user.email || '').toLowerCase().trim();
      if (email && ADMIN_EMAILS.includes(email)) isAdmin = true;
    }

    // 2) Ø¥Ù† Ù„Ù… ÙŠÙƒÙ† Ø£Ø¯Ù…Ù† â†’ ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø§Ù„Ø¯ÙØ¹Ø© Ù…Ù…Ù„ÙˆÙƒØ© Ù„Ù‡
    if (!isAdmin) {
      const ownRes = await fetch(
        `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}&select=user_id&limit=1`,
        { headers: svcHeaders }
      );

      if (!ownRes.ok) {
        return res.status(500).json({ status: 'ERROR', message: 'خطأ في التحقق' });
      }

      const own = await ownRes.json();
      const ownerId = Array.isArray(own) && own.length > 0 ? own[0].user_id : null;

      if (!ownerId || ownerId !== userId) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'رفض الوصول: هذه الدفعة لا تخصّك'
        });
      }
    }

    // Supabase ÙŠØ¹ÙŠØ¯ 1000 ØµÙ ÙƒØ­Ø¯ Ø£Ù‚ØµÙ‰ â€” Ù†Ù‚Ø±Ø£ Ø§Ù„Ù„ÙˆØª Ø¹Ù„Ù‰ ØµÙØ­Ø§Øª Ø­ØªÙ‰ Ø§Ù„Ù†Ù‡Ø§ÙŠØ©
    const PAGE_SIZE = 1000;
    const HARD_CAP = 25000;
    let rows = [];
    let offset = 0;

    while (true) {
      const pageRes = await fetch(
        `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(cleanLot)}` +
        `&select=id,secret_code,secret_code_encrypted,secret_status,brand,product_name,reference,manufacture_date,expiry_date,logo_url,created_at` +
        `&order=created_at.asc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );

      if (!pageRes.ok) {
        const err = await pageRes.text();
        console.error('Fetch error:', err);
        return res.status(500).json({ status: 'ERROR', message: 'Erreur rÃ©cupÃ©ration' });
      }

      const batch = await pageRes.json();

      if (!Array.isArray(batch) || batch.length === 0) break;
      rows = rows.concat(batch);
      offset += batch.length;

      if (batch.length < PAGE_SIZE) break;
      if (rows.length >= HARD_CAP) break;
    }

    if (!rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Aucun code trouvÃ©' });
    }

    const codes = [];
    const decryptionErrors = [];

    for (const row of rows) {
      try {
        let code = null;

        if (row.secret_code_encrypted) {
          code = decryptCode(row.secret_code_encrypted);
        } else if (row.secret_code) {
          code = row.secret_code;
        }

        if (code) {
          codes.push({
            id: row.id,
            code: code,
            status: row.secret_status
          });
        }
      } catch (e) {
        decryptionErrors.push({ id: row.id, error: String(e).slice(0, 100) });
      }
    }

    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    fetch(`${SUPABASE_URL}/rest/v1/qr_print_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        lot: lot.trim(),
        count: codes.length,
        ip: ip,
        user_agent: userAgent
      })
    }).catch(err => console.error('Log error:', err));

    const first = rows[0];

    return res.status(200).json({
      status: 'OK',
      lot: lot.trim(),
      brand: first.brand || 'MARQUE',
      product_name: first.product_name || null,
      reference: first.reference || null,
      logo_url: first.logo_url || null,
      count: codes.length,
      codes: codes,
      decryptionErrors: decryptionErrors.length > 0 ? decryptionErrors : undefined
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

// ============================================================
// ACTION 3: EXPORT â€” ØªØµØ¯ÙŠØ± ÙƒÙ„ Ø§Ù„Ø£ÙƒÙˆØ§Ø¯ (Ù„Ù„Ø£Ø¯Ù…Ù† ÙÙ‚Ø·)
// ============================================================
// ÙŠÙØ±Ø¬Ø¹ secret_code Ø§Ù„ØµØ±ÙŠØ­ Ù…Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯ÙØ¹Ø©ØŒ Ù„ØªØµØ¯ÙŠØ±Ù‡Ø§ Excel Ù…Ù† Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ….
// Ø§Ù„ÙØ­Øµ Ù‡Ù†Ø§ ÙÙŠ Ø§Ù„Ø³ÙŠØ±ÙØ± (Ø¬Ø¯ÙˆÙ„ admins Ø«Ù… ADMIN_EMAILS) Ù…Ø¹ service_roleØŒ
// ÙÙ„Ø§ ÙŠØ¹ØªÙ…Ø¯ Ø£Ù…Ù†Ù Ø§Ù„Ø£ÙƒÙˆØ§Ø¯ Ø¹Ù„Ù‰ Ø³ÙŠØ§Ø³Ø§Øª RLS ÙÙŠ Ø§Ù„Ù‚Ø§Ø¹Ø¯Ø©.
//
//   POST /api/batch-manager?action=export
//   { access_token, q?, status?, dateFrom?, dateTo?, limit? }

const EXPORT_PAGE_SIZE = 1000;   // Ø³Ù‚Ù Supabase Ù„ÙƒÙ„ Ø·Ù„Ø¨
const EXPORT_MAX_ROWS = 10000;   // Ø³Ù‚Ù Ø§Ù„ØªØµØ¯ÙŠØ± Ø§Ù„ÙˆØ§Ø­Ø¯
const EXPORT_STATUSES = ['PENDING', 'UNUSED', 'USED', 'DISABLED', 'EXPIRED'];
const EXPORT_COLUMNS = [
  'id', 'secret_code_encrypted', 'brand', 'product_name', 'reference', 'lot',
  'secret_status', 'created_at', 'shop_name', 'is_shop_lot', 'product_price'
].join(',');

// ØªÙ†Ø¸ÙŠÙ Ù†Øµ Ø§Ù„Ø¨Ø­Ø« Ù…Ù† Ù…Ø­Ø§Ø±Ù ØªÙÙØ³Ø¯ ØµÙŠØ§ØºØ© ÙÙ„ØªØ± PostgREST (or=(...) )
function sanitizeExportTerm(value) {
  return String(value || '')
    .replace(/[,()*"\\]/g, ' ')
    .replace(/%/g, '')
    .trim()
    .slice(0, 100);
}

// ÙŠØªØ­Ù‚Ù‚ Ø£Ù† ØµØ§Ø­Ø¨ Ø§Ù„ØªÙˆÙƒÙ† Ø£Ø¯Ù…Ù† ÙØ¹Ù„Ø§Ù‹
async function requireAdminToken(req, SUPABASE_URL, SERVICE_KEY) {
  const raw = req.headers.authorization || (req.body && req.body.access_token) || '';
  const token = String(raw).replace(/^Bearer\s+/i, '').trim();

  if (!token) return { ok: false, code: 401, message: 'غير مصادق عليه' };

  let user;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!userRes.ok) return { ok: false, code: 401, message: 'Token invalide' };
    user = await userRes.json();
  } catch (e) {
    console.error('export: user lookup failed', e);
    return { ok: false, code: 401, message: 'Token invalide' };
  }

  if (!user || !user.id) return { ok: false, code: 401, message: 'Token invalide' };

  const svc = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

  // 1) Ø¬Ø¯ÙˆÙ„ admins
  try {
    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,
      { headers: svc }
    );
    if (adminRes.ok) {
      const rows = await adminRes.json();
      if (Array.isArray(rows) && rows.length > 0) return { ok: true, user };
    }
  } catch (e) {
    console.warn('export: admins check failed', e);
  }

  // 2) Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©
  const email = String(user.email || '').toLowerCase().trim();
  if (email && ADMIN_EMAILS.includes(email)) return { ok: true, user };

  return { ok: false, code: 403, message: 'رفض الوصول' };
}

async function handleExportCodes(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // ðŸ”’ Ø§Ù„Ø£Ø¯Ù…Ù† ÙÙ‚Ø·
    const auth = await requireAdminToken(req, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (!auth.ok) {
      return res.status(auth.code).json({ status: 'ERROR', message: auth.message });
    }

    const body = req.body || {};
    const limitRaw = parseInt(body.limit, 10);
    const limit = Math.min(EXPORT_MAX_ROWS, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : EXPORT_MAX_ROWS));

    const filters = [];

    const term = sanitizeExportTerm(body.q);
    if (term) {
      const p = `*${term}*`;
      const orParts = [
        `brand.ilike.${p}`,
        `product_name.ilike.${p}`,
        `lot.ilike.${p}`,
        `reference.ilike.${p}`
      ];
      // Ø¨Ø­Ø« Ø¨ÙƒÙˆØ¯ ÙƒØ§Ù…Ù„ (7 Ù…Ø­Ø§Ø±Ù) â†’ Ø¹Ø¨Ø± Ø§Ù„Ø¨ØµÙ…Ø©ØŒ Ø¨Ù„Ø§ Ø§Ù„Ø­Ø§Ø¬Ø© Ù„Ù„Ù†Øµ Ø§Ù„ØµØ±ÙŠØ­
      const codeCandidate = term.replace(/\s+/g, '').toUpperCase();
      if (/^[A-Z0-9]{7}$/.test(codeCandidate)) {
        orParts.push(`secret_code_hash.eq.${hashCode(codeCandidate)}`);
      }
      filters.push('or=(' + orParts.join(',') + ')');
    }

    const status = String(body.status || '').toUpperCase().trim();
    if (status && EXPORT_STATUSES.includes(status)) {
      filters.push(`secret_status=eq.${status}`);
    }

    if (body.dateFrom) {
      const d = new Date(body.dateFrom);
      if (!isNaN(d.getTime())) filters.push(`created_at=gte.${d.toISOString()}`);
    }

    if (body.dateTo) {
      const d = new Date(body.dateTo);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        filters.push(`created_at=lte.${d.toISOString()}`);
      }
    }

    const filterQuery = filters.length ? '&' + filters.join('&') : '';
    const svc = { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

    const rows = [];
    let offset = 0;

    while (rows.length < limit) {
      const pageSize = Math.min(EXPORT_PAGE_SIZE, limit - rows.length);
      const url = `${SUPABASE_URL}/rest/v1/qr_codes?select=${EXPORT_COLUMNS}`
        + `${filterQuery}&order=created_at.desc&limit=${pageSize}&offset=${offset}`;

      const r = await fetch(url, { headers: svc });

      if (!r.ok) {
        const errText = await r.text();
        console.error('export: query failed', r.status, errText);
        return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur' });
      }

      const batch = await r.json();
      if (!Array.isArray(batch) || batch.length === 0) break;

      rows.push(...batch);
      offset += batch.length;

      if (batch.length < pageSize) break; // Ø¢Ø®Ø± ØµÙØ­Ø©
    }

    // ÙÙƒÙ‘ Ø§Ù„ØªØ´ÙÙŠØ± Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± â€” Ø§Ù„Ù†Øµ Ø§Ù„ØµØ±ÙŠØ­ Ù„Ø§ ÙŠØ¹ÙˆØ¯ Ù…Ø®Ø²Ù‘Ù†Ø§Ù‹ ÙÙŠ Ø§Ù„Ù‚Ø§Ø¹Ø¯Ø©
    const outRows = rows.map((r) => {
      let plain = null;
      if (r.secret_code_encrypted) {
        try { plain = decryptCode(r.secret_code_encrypted); } catch (e) { plain = null; }
      } else if (r.secret_code) {
        plain = r.secret_code;
      }
      const copy = Object.assign({}, r);
      delete copy.secret_code_encrypted;
      copy.secret_code = plain;
      return copy;
    });

    return res.status(200).json({
      status: 'OK',
      count: outRows.length,
      truncated: outRows.length >= limit,
      rows: outRows
    });

  } catch (error) {
    console.error('handleExportCodes error:', error);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}

// ============================================================
// ACTION: STATS â€” Ø¥Ø­ØµØ§Ø¡Ø§Øª Ø§Ù„ÙˆÙ„Ø§ÙŠØ§Øª
//   Ø§Ù„Ø£Ø¯Ù…Ù†: ÙƒÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Â· Ø§Ù„Ø¹Ù„Ø§Ù…Ø©: Ø¨ÙŠØ§Ù†Ø§ØªÙ‡Ø§ ÙÙ‚Ø· (ØªÙØ±Ø¶Ù‡Ø§ Ø§Ù„Ø¯Ø§Ù„Ø©)
// ============================================================
async function handleWilayaStats(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const body = req.body || {};
    const token = String(req.headers.authorization || body.access_token || '')
      .replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });
    }

    const now = Date.now();
    const from = body.from || new Date(now - 30 * 86400000).toISOString();
    const to = body.to || new Date(now + 86400000).toISOString();

    // ØªÙˆÙƒÙ† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙŠÙÙ…Ø±ÙŽÙ‘Ø± ÙƒÙ…Ø§ Ù‡Ùˆ Ø­ØªÙ‰ ØªØ¹Ù…Ù„ auth.uid() Ø¯Ø§Ø®Ù„ Ø§Ù„Ø¯Ø§Ù„Ø©
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wilaya_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ p_from: from, p_to: to })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('wilaya_stats failed:', r.status, errText.slice(0, 300));
      const forbidden = r.status === 403 || /access denied/i.test(errText);
      return res.status(forbidden ? 403 : 500).json({
        status: 'ERROR',
        message: forbidden ? 'رفض الوصول' : 'خطأ في الخادم',
        detail: forbidden ? undefined : errText.slice(0, 200)
      });
    }

    const rows = await r.json();
    return res.status(200).json({ status: 'OK', from, to, rows });
  } catch (e) {
    console.error('handleWilayaStats error:', e);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}

// ============================================================
// ACTION: REPORTS â€” Ø¨Ù„Ø§ØºØ§Øª ÙˆÙ„Ø§ÙŠØ© Ù…Ø­Ø¯Ø¯Ø©
// ============================================================
async function handleWilayaReports(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const body = req.body || {};
    const token = String(req.headers.authorization || body.access_token || '')
      .replace(/^Bearer\s+/i, '').trim();

    if (!token) return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });

    const code = String(body.code || '').trim();
    if (!/^\d{1,2}$/.test(code)) {
      return res.status(400).json({ status: 'ERROR', message: 'Code wilaya invalide' });
    }

    const now = Date.now();
    const from = body.from || new Date(now - 30 * 86400000).toISOString();
    const to = body.to || new Date(now + 86400000).toISOString();

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wilaya_reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ p_code: code, p_from: from, p_to: to })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('wilaya_reports failed:', r.status, errText.slice(0, 300));
      return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur', detail: errText.slice(0, 160) });
    }

    const rows = await r.json();
    return res.status(200).json({ status: 'OK', code, from, to, count: rows.length, rows });
  } catch (e) {
    console.error('handleWilayaReports error:', e);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}

// ============================================================
// ACTION: TREND â€” Ø§Ù„Ø§ØªØ¬Ø§Ù‡ Ø§Ù„ÙŠÙˆÙ…ÙŠ Ù„ÙˆÙ„Ø§ÙŠØ©
// ============================================================
async function handleWilayaTrend(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const body = req.body || {};
    const token = String(req.headers.authorization || body.access_token || '')
      .replace(/^Bearer\s+/i, '').trim();

    if (!token) return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });

    const code = String(body.code || '').trim();
    if (!/^\d{1,2}$/.test(code)) {
      return res.status(400).json({ status: 'ERROR', message: 'Code wilaya invalide' });
    }

    const now = Date.now();
    const from = body.from || new Date(now - 30 * 86400000).toISOString();
    const to = body.to || new Date(now + 86400000).toISOString();

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/wilaya_trend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ p_code: code, p_from: from, p_to: to })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('wilaya_trend failed:', r.status, errText.slice(0, 300));
      return res.status(500).json({ status: 'ERROR', message: 'Erreur serveur', detail: errText.slice(0, 160) });
    }

    const rows = await r.json();
    return res.status(200).json({ status: 'OK', code, from, to, rows });
  } catch (e) {
    console.error('handleWilayaTrend error:', e);
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue' });
  }
}

// ============================================================
// ACTION: REKEY â€” Ø¥Ø¹Ø§Ø¯Ø© ØªØ´ÙÙŠØ± Ø§Ù„Ø£ÙƒÙˆØ§Ø¯ Ø¨Ù…ÙØªØ§Ø­ Ø¬Ø¯ÙŠØ¯
//   Ù„Ø§ ÙŠÙ‚Ø±Ø£ Ø§Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ù‚Ø¯ÙŠÙ…: ÙŠØ³ØªØ®Ø¯Ù… process.env.ENCRYPTION_KEY ÙÙŠ Ø§Ù„Ø³ÙŠØ±ÙØ±
// ============================================================
async function handleRekey(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    const body = req.body || {};
    const token = String(req.headers.authorization || body.access_token || '')
      .replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ status: 'ERROR', message: 'غير مصادق عليه' });

    // Ø§Ù„Ø£Ø¯Ù…Ù† ÙÙ‚Ø·
    const adm = await requireAdminToken(req, SUPABASE_URL, SERVICE_KEY);
    if (!adm.ok) {
      return res.status(adm.code || 403).json({ status: 'ERROR', message: adm.message || 'AccÃ¨s refusÃ©' });
    }

    const newKey = String(body.new_key || '').trim();
    if (newKey.length < 16) {
      return res.status(400).json({ status: 'ERROR', message: 'new_key trop courte (min 16)' });
    }

    const size = Math.min(500, Math.max(1, Number(body.batch) || 300));

    // 1) Ø§Ù‚Ø±Ø£ Ø¯ÙØ¹Ø© Ù„Ù… ØªÙØ¹Ø§Ø¯ ØªØ´ÙÙŠØ±Ù‡Ø§ Ø¨Ø¹Ø¯
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?select=id,secret_code_encrypted&enc_key_id=eq.1&limit=${size}`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!listRes.ok) {
      const t2 = await listRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Lecture Ã©chouÃ©e', detail: t2.slice(0, 150) });
    }
    const rows = await listRes.json();

    if (!rows.length) {
      return res.status(200).json({ status: 'OK', processed: 0, remaining: 0, done: true });
    }

    // 2) ÙÙƒÙ‘ Ø¨Ø§Ù„Ù‚Ø¯ÙŠÙ… Ø«Ù… Ø£Ø¹Ø¯ Ø§Ù„ØªØ´ÙÙŠØ± Ø¨Ø§Ù„Ø¬Ø¯ÙŠØ¯ (Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ±)
    const payload = [];
    let skipped = 0;
    for (const r of rows) {
      if (!r.secret_code_encrypted) { skipped++; continue; }
      let plain;
      try {
        plain = decryptCode(r.secret_code_encrypted);
      } catch (e) {
        skipped++;
        continue;
      }
      payload.push({ id: r.id, enc: encryptCodeWith(plain, newKey) });
    }

    if (!payload.length) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Ù„Ø§ ÙŠÙ…ÙƒÙ† ÙÙƒ ØªØ´ÙÙŠØ± Ø£ÙŠ ØµÙ â€” Ø§Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ø­Ø§Ù„ÙŠ Ù„Ø§ ÙŠØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª',
        skipped
      });
    }

    // 3) ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¯ÙØ¹Ø© Ø¨Ø·Ù„Ø¨ ÙˆØ§Ø­Ø¯
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rekey_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({ p_rows: payload })
    });
    if (!upRes.ok) {
      const t3 = await upRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Mise Ã  jour Ã©chouÃ©e', detail: t3.slice(0, 150) });
    }

    const updated = await upRes.json();

    // 4) ÙƒÙ… Ø¨Ù‚ÙŠØŸ
    const stRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rekey_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: '{}'
    });
    const st = stRes.ok ? (await stRes.json())[0] : null;

    return res.status(200).json({
      status: 'OK',
      processed: Number(updated) || payload.length,
      skipped,
      remaining: st ? Number(st.pending) : null,
      done: st ? Number(st.pending) === 0 : false
    });
  } catch (e) {
    console.error('handleRekey error:', e);
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 160) });
  }
}

async function handleRekeyStatus(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rekey_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: '{}'
    });
    if (!r.ok) return res.status(500).json({ status: 'ERROR', message: 'RPC manquante' });
    const st = (await r.json())[0] || { pending: 0, done: 0 };
    return res.status(200).json({ status: 'OK', pending: Number(st.pending), done: Number(st.done) });
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: String(e).slice(0, 160) });
  }
}
