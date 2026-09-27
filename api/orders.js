// api/orders.js
// API موحّد لإدارة الطلبات والفواتير
// الاستخدام:
//   POST /api/orders?action=create       ← إنشاء طلب
//   POST /api/orders?action=list         ← قائمة الطلبات (Admin)
//   POST /api/orders?action=get          ← طلب واحد
//   POST /api/orders?action=update       ← تحديث
//   POST /api/orders?action=delete       ← حذف
//   POST /api/orders?action=check-lots   ← التحقق من اللوتات
//   POST /api/orders?action=save-contact ← حفظ جهة اتصال
//   POST /api/orders?action=list-brands  ← قائمة كل الماركات

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  const action = (req.query && req.query.action) || (req.body && req.body.action);

  // التحقق من الأدمن لكل العمليات
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ status: 'ERROR', message: auth.message });
  }

  switch (action) {
    case 'create':       return handleCreate(req, res, auth);
    case 'list':         return handleList(req, res, auth);
    case 'get':          return handleGet(req, res, auth);
    case 'update':       return handleUpdate(req, res, auth);
    case 'delete':       return handleDelete(req, res, auth);
    case 'check-lots':   return handleCheckLots(req, res, auth);
    case 'save-contact': return handleSaveContact(req, res, auth);
    case 'list-brands':  return handleListBrands(req, res, auth);
    default:
      return res.status(400).json({
        status: 'ERROR',
        message: 'Action invalide. Utilisez: create, list, get, update, delete, check-lots, save-contact, list-brands'
      });
  }
}

// ============================================================
// 🔐 التحقق من الأدمن
// ============================================================
async function verifyAdmin(req) {
  try {
    const access_token = (req.body && req.body.access_token) || 
                        (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

    if (!access_token) {
      return { ok: false, status: 401, message: 'Non authentifié' };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: false, status: 500, message: 'Configuration manquante' };
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return { ok: false, status: 401, message: 'Token invalide' };
    }

    const caller = await userRes.json();

// ✅ التحقق من جدول admins عبر service_role (يتجاوز RLS)
const adminRes = await fetch(
  `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${encodeURIComponent(caller.id)}&select=user_id&limit=1`,
  {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  }
);

let isAdmin = false;
if (adminRes.ok) {
  const rows = await adminRes.json();
  isAdmin = Array.isArray(rows) && rows.length > 0;
}

// Fallback للإيميل مؤقتًا (نفس منطق check-admin)
if (!isAdmin) {
  const FALLBACK = ['mepirf@gmail.com', 'abderraoufhazam@gmail.com'];
  const callerEmail = (caller.email || '').toLowerCase().trim();
  if (FALLBACK.includes(callerEmail)) isAdmin = true;
}

if (!isAdmin) {
  return { ok: false, status: 403, message: 'Accès refusé' };
}

return {
  ok: true,
  supabaseUrl: SUPABASE_URL,
  serviceKey: SUPABASE_SERVICE_ROLE_KEY,
  adminId: caller.id,
  adminEmail: caller.email
};
  } catch (error) {
    return { ok: false, status: 500, message: 'Erreur auth: ' + String(error).slice(0, 100) };
  }
}

// ============================================================
// ➕ إنشاء طلب
// ============================================================
async function handleCreate(req, res, auth) {
  try {
    const {
      brand_name,
      brand_email,
      brand_phone,
      brand_user_id,
      items,                    // [{ lot_number, quantity }]
      unit_price,
      discount_percent,
      delivery_cost,
      tva,
      delivery_method,          // 'delivery' | 'hand_to_hand'
      payment_method,
      delivery_company,
      tracking_number,
      delivery_wilaya,
      delivery_baladiya,
      delivery_address,
      recipient_phone,
      shipping_date,
      notes
    } = req.body || {};

    // ✅ التحقق
    if (!brand_name || brand_name.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Nom de marque obligatoire' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Au moins un lot requis' });
    }
    if (!unit_price || parseFloat(unit_price) <= 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Prix unitaire invalide' });
    }
    if (!delivery_method || !['delivery', 'hand_to_hand'].includes(delivery_method)) {
      return res.status(400).json({ status: 'ERROR', message: 'Méthode de livraison invalide' });
    }

    // ✅ التحقق من صحة الأصناف
    let totalQty = 0;
    for (const item of items) {
      if (!item.lot_number || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'Article invalide: ' + JSON.stringify(item) });
      }
      totalQty += parseInt(item.quantity, 10);
    }

    // ✅ الحسابات
    const unitPrice = parseFloat(unit_price);
    const discountPct = parseFloat(discount_percent || 0);
    const deliveryCost = parseFloat(delivery_cost || 0);
    const tvaPct = parseFloat(tva || 0);

    const subtotal = unitPrice * totalQty;
    const discountAmount = subtotal * (discountPct / 100);
    const afterDiscount = subtotal - discountAmount;
    const tvaAmount = afterDiscount * (tvaPct / 100);
    const totalPrice = afterDiscount + tvaAmount + deliveryCost;

    // ✅ توليد رقم الفاتورة
    const numRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/rpc/generate_order_number`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        },
        body: JSON.stringify({ p_brand_name: brand_name.trim() })
      }
    );

    if (!numRes.ok) {
      const err = await numRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur génération numéro', detail: err.slice(0, 200) });
    }

    const orderNumber = await numRes.json();

    // ✅ التحقق من التسجيل
    let isRegistered = false;
    let finalUserId = brand_user_id || null;

    if (!finalUserId) {
      // ابحث عن المستخدم بالاسم
      const usersRes = await fetch(
        `${auth.supabaseUrl}/auth/v1/admin/users?per_page=1000`,
        {
          headers: {
            'apikey': auth.serviceKey,
            'Authorization': `Bearer ${auth.serviceKey}`
          }
        }
      );
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const foundUser = (usersData.users || []).find(u =>
          (u.user_metadata?.brand_name || '').toLowerCase() === brand_name.toLowerCase().trim()
        );
        if (foundUser) {
          isRegistered = true;
          finalUserId = foundUser.id;
        }
      }
    } else {
      isRegistered = true;
    }

    // ✅ الحالة الأولية
    const initialStatus = 'IN_PRODUCTION';

    // ✅ إدراج الطلب
    const orderPayload = {
      order_number: orderNumber,
      brand_name: brand_name.trim(),
      brand_user_id: finalUserId,
      is_registered: isRegistered,
      brand_email: brand_email || null,
      brand_phone: brand_phone || null,
      total_quantity: totalQty,
      unit_price: unitPrice,
      subtotal: subtotal,
      discount_percent: discountPct,
      discount_amount: discountAmount,
      delivery_cost: deliveryCost,
      tva: tvaPct,
      total_price: totalPrice,
      paid_amount: 0,
      delivery_method: delivery_method,
      payment_method: payment_method || (delivery_method === 'hand_to_hand' ? 'cash_hand' : 'cash_on_delivery'),
      payment_status: 'UNPAID',
      order_status: initialStatus,
      delivery_company: delivery_company || null,
      tracking_number: tracking_number || null,
      delivery_wilaya: delivery_wilaya || null,
      delivery_baladiya: delivery_baladiya || null,
      delivery_address: delivery_address || null,
      recipient_phone: recipient_phone || null,
      shipping_date: shipping_date || null,
      notes: notes || null,
      created_by: auth.adminId
    };

    const insertRes = await fetch(`${auth.supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': auth.serviceKey,
        'Authorization': `Bearer ${auth.serviceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderPayload)
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur création', detail: err.slice(0, 300) });
    }

    const orderData = await insertRes.json();
    const order = Array.isArray(orderData) ? orderData[0] : orderData;

    // ✅ إدراج الأصناف
    const itemsPayload = items.map(it => ({
      order_id: order.id,
      lot_number: String(it.lot_number).trim(),
      quantity: parseInt(it.quantity, 10)
    }));

    const itemsRes = await fetch(`${auth.supabaseUrl}/rest/v1/order_items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': auth.serviceKey,
        'Authorization': `Bearer ${auth.serviceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(itemsPayload)
    });

    if (!itemsRes.ok) {
      const err = await itemsRes.text();
      // حاول حذف الطلب
      await fetch(`${auth.supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      });
      return res.status(500).json({ status: 'ERROR', message: 'Erreur insertion items', detail: err.slice(0, 200) });
    }

    // ✅ تحديث brands_meta
    await upsertBrandMeta(auth, brand_name.trim(), finalUserId, totalPrice);

    // ✅ إشعار واتساب (اختياري)
    sendOrderNotification(auth, orderNumber, brand_name, totalQty, totalPrice, 'CREATED');

    return res.status(200).json({
      status: 'OK',
      message: 'Commande créée',
      order: {
        id: order.id,
        order_number: orderNumber,
        total_price: totalPrice,
        total_quantity: totalQty,
        order_status: initialStatus
      }
    });

  } catch (error) {
    console.error('handleCreate error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue',
      detail: String(error).slice(0, 200)
    });
  }
}

// ============================================================
// 📋 قائمة الطلبات
// ============================================================
async function handleList(req, res, auth) {
  try {
    const search = (req.body.search || '').trim();
    const status = (req.body.status || '').trim();
    const paymentStatus = (req.body.payment_status || '').trim();
    const limit = Math.min(parseInt(req.body.limit || 200, 10), 1000);

    const queryRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/rpc/admin_get_orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        },
        body: JSON.stringify({
          p_search: search || null,
          p_status: status || null,
          p_limit: limit
        })
      }
    );

    if (!queryRes.ok) {
      const err = await queryRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération', detail: err.slice(0, 200) });
    }

    let orders = await queryRes.json();

    // فلترة إضافية بـ payment_status
    if (paymentStatus && Array.isArray(orders)) {
      orders = orders.filter(o => o.payment_status === paymentStatus);
    }

    return res.status(200).json({
      status: 'OK',
      count: orders.length,
      orders: orders
    });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur inattendue', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// 🔍 طلب واحد
// ============================================================
async function handleGet(req, res, auth) {
  try {
    const orderId = parseInt(req.body.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ status: 'ERROR', message: 'order_id obligatoire' });
    }

    const orderRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=*`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );

    if (!orderRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération' });
    }

    const orders = await orderRes.json();
    if (!orders || orders.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Commande introuvable' });
    }

    const order = orders[0];

    // الأصناف
    const itemsRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/order_items?order_id=eq.${orderId}&select=*&order=id.asc`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );
    const items = itemsRes.ok ? await itemsRes.json() : [];

    order.items = items;

    return res.status(200).json({ status: 'OK', order: order });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// ✏️ تحديث الطلب
// ============================================================
async function handleUpdate(req, res, auth) {
  try {
    const orderId = parseInt(req.body.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ status: 'ERROR', message: 'order_id obligatoire' });
    }

    const allowedFields = [
      'order_status', 'payment_status', 'paid_amount',
      'delivery_company', 'tracking_number',
      'delivery_wilaya', 'delivery_baladiya', 'delivery_address',
      'recipient_phone', 'shipping_date', 'expected_delivery_date',
      'delivered_date', 'paid_date', 'notes',
      'brand_phone', 'brand_email'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Aucun champ à modifier' });
    }

    // معالجة الحالات الخاصة
    if (updates.order_status === 'PAID') {
      updates.payment_status = 'PAID';
      updates.paid_date = new Date().toISOString().split('T')[0];
    }
    if (updates.order_status === 'DELIVERED') {
      updates.delivered_date = new Date().toISOString().split('T')[0];
    }
    if (updates.payment_status === 'PAID' && !updates.paid_date) {
      updates.paid_date = new Date().toISOString().split('T')[0];
    }

    updates.updated_at = new Date().toISOString();

    const updateRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/orders?id=eq.${orderId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur mise à jour', detail: err.slice(0, 200) });
    }

    const updated = await updateRes.json();
    const order = Array.isArray(updated) ? updated[0] : updated;

    // إشعار عند تغيير الحالة
    if (updates.order_status) {
      sendOrderNotification(auth, order.order_number, order.brand_name, order.total_quantity, order.total_price, updates.order_status);
    }

    return res.status(200).json({ status: 'OK', message: 'Commande mise à jour', order: order });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// 🗑️ حذف الطلب
// ============================================================
async function handleDelete(req, res, auth) {
  try {
    const orderId = parseInt(req.body.order_id, 10);
    if (!orderId) {
      return res.status(400).json({ status: 'ERROR', message: 'order_id obligatoire' });
    }

    // حذف الأصناف أولاً
    await fetch(`${auth.supabaseUrl}/rest/v1/order_items?order_id=eq.${orderId}`, {
      method: 'DELETE',
      headers: {
        'apikey': auth.serviceKey,
        'Authorization': `Bearer ${auth.serviceKey}`
      }
    });

    // حذف الطلب
    const deleteRes = await fetch(`${auth.supabaseUrl}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'DELETE',
      headers: {
        'apikey': auth.serviceKey,
        'Authorization': `Bearer ${auth.serviceKey}`
      }
    });

    if (!deleteRes.ok) {
      return res.status(500).json({ status: 'ERROR', message: 'Erreur suppression' });
    }

    return res.status(200).json({ status: 'OK', message: 'Commande supprimée' });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// ✅ التحقق من صحة أرقام اللوت
// ============================================================
async function handleCheckLots(req, res, auth) {
  try {
    const lots = req.body.lots || [];
    if (!Array.isArray(lots) || lots.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'lots [] obligatoire' });
    }

    const results = [];

    for (const lot of lots) {
      const lotNum = String(lot).trim();
      if (!lotNum) continue;

      // جلب أكواد اللوت
      const lotRes = await fetch(
        `${auth.supabaseUrl}/rest/v1/qr_codes?lot=eq.${encodeURIComponent(lotNum)}&select=brand,product_name,secret_status`,
        {
          headers: {
            'apikey': auth.serviceKey,
            'Authorization': `Bearer ${auth.serviceKey}`
          }
        }
      );

      if (!lotRes.ok) {
        results.push({ lot: lotNum, exists: false, error: 'fetch failed' });
        continue;
      }

      const codes = await lotRes.json();

      if (!codes || codes.length === 0) {
        results.push({
          lot: lotNum,
          exists: false,
          count: 0,
          brand: null,
          message: 'Lot introuvable dans la base'
        });
      } else {
        results.push({
          lot: lotNum,
          exists: true,
          count: codes.length,
          brand: codes[0].brand,
          product_name: codes[0].product_name,
          statuses: codes.reduce((acc, c) => {
            acc[c.secret_status] = (acc[c.secret_status] || 0) + 1;
            return acc;
          }, {})
        });
      }
    }

    return res.status(200).json({ status: 'OK', results: results });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// 📞 حفظ جهة اتصال (ماركة غير مسجلة)
// ============================================================
async function handleSaveContact(req, res, auth) {
  try {
    const { brand_name, phone, email, notes } = req.body || {};

    if (!brand_name || brand_name.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'brand_name obligatoire' });
    }

    const payload = {
      brand_name: brand_name.trim(),
      phone: phone || null,
      email: email || null,
      notes: notes || null
    };

    // UPSERT
    const saveRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/brand_contacts?on_conflict=brand_name`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return res.status(500).json({ status: 'ERROR', message: 'Erreur sauvegarde', detail: err.slice(0, 200) });
    }

    const data = await saveRes.json();
    return res.status(200).json({ status: 'OK', contact: Array.isArray(data) ? data[0] : data });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// 🏢 قائمة كل الماركات (مسجلة + غير مسجلة)
// ============================================================
async function handleListBrands(req, res, auth) {
  try {
    // الماركات المسجلة (من qr_codes)
    const codesRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/qr_codes?select=brand&limit=10000`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );

    const codes = codesRes.ok ? await codesRes.json() : [];
    const brandsFromCodes = {};
    codes.forEach(c => {
      if (c.brand) {
        brandsFromCodes[c.brand] = (brandsFromCodes[c.brand] || 0) + 1;
      }
    });

    // جهات الاتصال المسجلة يدوياً
    const contactsRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/brand_contacts?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );
    const contacts = contactsRes.ok ? await contactsRes.json() : [];

    // الماركات المسجلة (users)
    const usersRes = await fetch(
      `${auth.supabaseUrl}/auth/v1/admin/users?per_page=1000`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );

    const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
    const registeredBrands = (usersData.users || [])
      .filter(u => u.user_metadata?.role === 'brand')
      .map(u => ({
        user_id: u.id,
        brand_name: u.user_metadata?.brand_name || '',
        email: u.email,
        phone: u.user_metadata?.phone || null
      }))
      .filter(b => b.brand_name);

    // brands_meta
    const metaRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/brands_meta?select=*`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );
    const meta = metaRes.ok ? await metaRes.json() : [];

    // 🔗 دمج الكل
    const allBrands = {};

    // 1. الماركات المسجلة
    registeredBrands.forEach(b => {
      const key = b.brand_name.toLowerCase().trim();
      const m = meta.find(x => x.brand_name.toLowerCase() === key);
      allBrands[key] = {
        brand_name: b.brand_name,
        user_id: b.user_id,
        email: b.email,
        phone: b.phone,
        is_registered: true,
        codes_count: brandsFromCodes[b.brand_name] || 0,
        tier: m?.tier || 'REGULAR',
        total_spent: m?.total_spent || 0,
        total_orders: m?.total_orders || 0
      };
    });

    // 2. الماركات من الأكواد (بدون تسجيل)
    Object.keys(brandsFromCodes).forEach(name => {
      const key = name.toLowerCase().trim();
      if (!allBrands[key]) {
        const contact = contacts.find(c => c.brand_name.toLowerCase() === key);
        const m = meta.find(x => x.brand_name.toLowerCase() === key);
        allBrands[key] = {
          brand_name: name,
          user_id: null,
          email: contact?.email || null,
          phone: contact?.phone || null,
          is_registered: false,
          codes_count: brandsFromCodes[name] || 0,
          tier: m?.tier || 'REGULAR',
          total_spent: m?.total_spent || 0,
          total_orders: m?.total_orders || 0
        };
      }
    });

    // 3. الماركات من جهات الاتصال فقط (بدون أكواد)
    contacts.forEach(c => {
      const key = c.brand_name.toLowerCase().trim();
      if (!allBrands[key]) {
        allBrands[key] = {
          brand_name: c.brand_name,
          user_id: null,
          email: c.email,
          phone: c.phone,
          is_registered: false,
          codes_count: 0,
          tier: 'REGULAR',
          total_spent: 0,
          total_orders: 0
        };
      }
    });

    const result = Object.values(allBrands).sort((a, b) => 
      b.total_spent - a.total_spent || a.brand_name.localeCompare(b.brand_name)
    );

    return res.status(200).json({ status: 'OK', count: result.length, brands: result });

  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Erreur', detail: String(error).slice(0, 200) });
  }
}

// ============================================================
// 🧰 HELPERS
// ============================================================
async function upsertBrandMeta(auth, brandName, userId, amount) {
  try {
    const metaRes = await fetch(
      `${auth.supabaseUrl}/rest/v1/brands_meta?brand_name=eq.${encodeURIComponent(brandName)}&select=*`,
      {
        headers: {
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`
        }
      }
    );
    const existing = metaRes.ok ? await metaRes.json() : [];

    if (existing && existing.length > 0) {
      const current = existing[0];
      const newTotalSpent = parseFloat(current.total_spent || 0) + parseFloat(amount || 0);
      const newTotalOrders = (current.total_orders || 0) + 1;

      // تحديد الشريحة تلقائياً
      let tier = 'REGULAR';
      if (newTotalSpent >= 100000) tier = 'VIP';
      else if (newTotalSpent >= 50000) tier = 'GOLD';
      else if (newTotalSpent >= 10000) tier = 'SILVER';

      await fetch(
        `${auth.supabaseUrl}/rest/v1/brands_meta?brand_name=eq.${encodeURIComponent(brandName)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': auth.serviceKey,
            'Authorization': `Bearer ${auth.serviceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            total_spent: newTotalSpent,
            total_orders: newTotalOrders,
            tier: tier,
            user_id: userId,
            updated_at: new Date().toISOString()
          })
        }
      );
    } else {
      await fetch(`${auth.supabaseUrl}/rest/v1/brands_meta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          brand_name: brandName,
          user_id: userId,
          total_spent: parseFloat(amount || 0),
          total_orders: 1,
          tier: 'REGULAR'
        })
      });
    }
  } catch (e) {
    console.warn('upsertBrandMeta error:', e);
  }
}

async function sendOrderNotification(auth, orderNumber, brandName, qty, price, status, options = {}) {
  try {
    const statusMessages = {
      'CREATED': {
        title: '🆕 Commande créée',
        brandMsg: `🆕 *Votre commande*\n\n🧾 ${orderNumber}\n📦 ${qty} codes\n💰 ${parseFloat(price).toLocaleString('fr-FR')} DA\n\nÉtat: 🟡 En production\n\n👉 Consultez /brand`
      },
      'IN_PRODUCTION': {
        title: '🟡 En production',
        brandMsg: `🟡 *Votre commande*\n\n🧾 ${orderNumber}\nÉtat: 🟡 En production\n\n👉 Consultez /brand`
      },
      'READY': {
        title: '📦 Commande prête',
        brandMsg: `📦 *Votre commande*\n\n🧾 ${orderNumber}\nÉtat: 📦 Prête\n\n👉 Consultez /brand`
      },
      'HANDED_TO_CARRIER': {
        title: '🟣 Confiée au transporteur',
        brandMsg: `🟣 *Votre commande*\n\n🧾 ${orderNumber}\nÉtat: 🟣 Confiée au transporteur\n\n👉 Consultez /brand`
      },
      'SHIPPED': {
        title: '🚚 Commande expédiée',
        brandMsg: `🚚 *Votre commande est expédiée*\n\n🧾 ${orderNumber}\nÉtat: 🚚 En route${options.tracking ? `\n\n🔢 Suivi: ${options.tracking}` : ''}${options.company ? `\n🏢 ${options.company}` : ''}\n\n👉 Consultez /brand`
      },
      'AWAITING_PICKUP': {
        title: '🟠 En attente de retrait',
        brandMsg: `🟠 *Votre commande*\n\n🧾 ${orderNumber}\n📍 Arrivée à votre wilaya\n\n👉 Rendez-vous au bureau pour retirer votre colis\n\n👉 Consultez /brand`
      },
      'AWAITING_HANDOVER': {
        title: '⏳ En attente de remise',
        brandMsg: `⏳ *Votre commande*\n\n🧾 ${orderNumber}\nÉtat: Prête pour remise\n\n👉 Consultez /brand`
      },
      'DELIVERED': {
        title: '✅ Commande livrée',
        brandMsg: `✅ *Votre commande est livrée*\n\n🧾 ${orderNumber}\n\nMerci pour votre confiance 🙏\n\n👉 Consultez /brand`
      },
      'PAID': {
        title: '💰 Commande payée',
        brandMsg: `💰 *Paiement reçu*\n\n🧾 ${orderNumber}\n\nMerci !\n\n👉 Consultez /brand`
      },
      'CANCELLED': {
        title: '❌ Commande annulée',
        brandMsg: `❌ *Votre commande a été annulée*\n\n🧾 ${orderNumber}\n\nContactez-nous pour plus d'informations.`
      }
    };

    const statusInfo = statusMessages[status] || {
      title: status,
      brandMsg: `📋 *Votre commande*\n\n🧾 ${orderNumber}\nÉtat: ${status}`
    };

    // 🎯 فقط: إشعار الماركة (إن كان لها رقم)
    if (options.brandPhone) {
      const cleanPhone = String(options.brandPhone).replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 9) {
        let intlPhone = cleanPhone;
        if (cleanPhone.startsWith('0')) {
          intlPhone = '213' + cleanPhone.slice(1);
        } else if (!cleanPhone.startsWith('213')) {
          intlPhone = '213' + cleanPhone;
        }
        await sendWhatsAppMessage(intlPhone, statusInfo.brandMsg);
      }
    }

// 🔔 إرسال Push للماركة (حتى والمتصفح مغلق)
try {
  const siteUrl = process.env.SITE_URL || 'https://original-indol.vercel.app';
  const pushRes = await fetch(`${siteUrl}/api/push-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_name: brandName,
      title: statusInfo.title,
      body: `🧾 ${orderNumber}`,
      url: '/brand',
      tag: `order-${orderNumber}`
    })
  });
  const pushData = await pushRes.json();
  console.log('Push result:', pushData);
} catch (pushErr) {
  console.warn('Push error:', pushErr);
}

    
    // 💾 حفظ في قاعدة البيانات (تظهر في /brand)
    try {
      await fetch(`${auth.supabaseUrl}/rest/v1/brand_notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': auth.serviceKey,
          'Authorization': `Bearer ${auth.serviceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          brand_name: brandName,
          order_id: options.orderId || null,
          order_number: orderNumber,
          type: 'ORDER_STATUS',
          title: statusInfo.title,
          message: statusInfo.brandMsg,
          is_read: false
        })
      });
    } catch (e) {
      console.warn('Save notification error:', e);
    }

    return true;
  } catch (e) {
    console.warn('Notification error:', e);
    return false;
  }
}

// ============================================================
// إرسال واتساب
// ============================================================
async function sendWhatsAppMessage(phone, message) {
  try {
    const apiUrl = process.env.GREEN_API_URL;
    const idInstance = process.env.GREEN_ID_INSTANCE;
    const apiToken = process.env.GREEN_API_TOKEN;

    if (!apiUrl || !idInstance || !apiToken) return false;

    const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${apiToken}`;
    const chatId = `${phone}@c.us`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });

    return r.ok;
  } catch (e) {
    return false;
  }
}
