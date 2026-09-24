// api/report-fake.js
// Enregistre les signalements + upload de l'image du produit contrefait

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const {
      attempted_code,
      wilaya,
      comment,
      product_image,       // data URL (base64)
      product_description
    } = req.body || {};

    // Validation
    if (!wilaya || typeof wilaya !== 'string' || wilaya.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Wilaya manquante' });
    }

    const cleanWilaya = wilaya.trim().slice(0, 50);
    const cleanCode = (attempted_code || '').trim().toUpperCase().slice(0, 20);
    const cleanComment = (comment || '').trim().slice(0, 500) || null;
    const cleanDesc = (product_description || '').trim().slice(0, 500) || null;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // IP + user-agent
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '').split(',')[0]).trim()
      || req.headers['x-real-ip']
      || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // ============================================================
    // UPLOAD IMAGE (si présente)
    // ============================================================
    let imageUrl = null;

    if (product_image && typeof product_image === 'string' && product_image.startsWith('data:image/')) {
      try {
        // Extraire le type et les données base64
        const match = product_image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, 'base64');

          // Vérifier la taille (max 5 MB)
          if (buffer.length > 5 * 1024 * 1024) {
            console.warn('Image trop grande:', buffer.length);
          } else {
            // Générer un nom unique
            const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
            const fileName = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const uploadPath = `${fileName}`;

            // Upload via REST API Supabase Storage
            const uploadRes = await fetch(
              `${SUPABASE_URL}/storage/v1/object/fake-products/${uploadPath}`,
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
              // Construire l'URL publique
              imageUrl = `${SUPABASE_URL}/storage/v1/object/public/fake-products/${uploadPath}`;
            } else {
              const errText = await uploadRes.text();
              console.error('Upload error:', errText);
            }
          }
        }
      } catch (uploadErr) {
        console.error('Image processing error:', uploadErr);
        // On continue quand même sans l'image
      }
    }

    // ============================================================
    // INSERT DANS fake_reports
    // ============================================================
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
