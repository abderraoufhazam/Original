// api/print-batch.js
// Déchiffre les codes d'un lot pour impression

import { decryptCode } from './_crypto.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

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

    // Vérifier l'authentification
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    // Récupérer tous les codes du lot
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

    // Déchiffrer chaque code
    const codes = [];
    const decryptionErrors = [];

    for (const row of rows) {
      try {
        let code = null;

        if (row.secret_code_encrypted) {
          // Nouveau code chiffré
          code = decryptCode(row.secret_code_encrypted);
        } else if (row.secret_code) {
          // Ancien code en clair (fallback)
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

    // Log l'impression
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

    // Infos du produit (depuis la première ligne)
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
