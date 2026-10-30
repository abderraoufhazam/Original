// api/batch-manager.js
// API موحّد: create (إنشاء دفعة) + print (فك تشفير للطباعة)
// الاستخدام:
//   POST /api/batch-manager?action=create   { brand, quantity, ... }
//   POST /api/batch-manager?action=print    { lot }

import { hashCode, encryptCode, generateSecretCode, decryptCode } from './_crypto.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
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

  const action = (req.query && req.query.action) || (req.body && req.body.action);

  if (action === 'create') return handleCreate(req, res);
  if (action === 'print')  return handlePrint(req, res);

  return res.status(400).json({
    status: 'ERROR',
    message: 'Action invalide. Utilisez ?action=create ou ?action=print'
  });
}

// ============================================================
// ACTION 1: CREATE — إنشاء دفعة جديدة
// ============================================================
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
    const qty = Math.min(10000, Math.max(1, parseInt(quantity, 10) || 0));
    if (!qty) {
      return res.status(400).json({ status: 'ERROR', message: 'Quantité invalide' });
    }
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
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

    // ✅ التحقق من عدم وجود دفعة بنفس رقم اللوت
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
            message: `رقم الدفعة "${lotToCheck}" مستعمل بالفعل. الرجاء اختيار رقم آخر أو حذف الدفعة القديمة أولاً.`
          });
        }
      }
    }
    const codes = [];
    // ✅ البحث عن user_id الخاص بالماركة
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
          console.log('✅ Found brand user_id:', brandUserId, 'for brand:', brand.trim());
        } else {
          console.warn('⚠️ No user found for brand:', brand.trim());
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
        user_id: brandUserId, // ✅ ربط الكود بحساب الماركة
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
// ACTION 2: PRINT — فك تشفير دفعة للطباعة
// ============================================================
async function handlePrint(req, res) {
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

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(lot.trim())}&select=id,secret_code,secret_code_encrypted,secret_status,brand,product_name,reference,manufacture_date,expiry_date,logo_url,created_at&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!fetchRes.ok) {
      const err = await fetchRes.text();
      console.error('Fetch error:', err);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération' });
    }

    const rows = await fetchRes.json();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Aucun code trouvé' });
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

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
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
