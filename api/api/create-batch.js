// api/create-batch.js
// Crée un lot avec des codes chiffrés (AES-256-GCM)

import { hashCode, encryptCode, generateSecretCode } from './_crypto.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const {
      brand,
      product_name,
      reference,
      lot,
      manufacture_date,
      expiry_date,
      product_image,
      logo_url,
      instagram_url,
      facebook_url,
      tiktok_url,
      description,
      quantity,
      access_token
    } = req.body || {};

    // Validation
    if (!brand || typeof brand !== 'string' || brand.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Marque obligatoire' });
    }
    const qty = Math.min(10000, Math.max(1, parseInt(quantity, 10) || 0));
    if (!qty) {
      return res.status(400).json({ status: 'ERROR', message: 'Quantité invalide' });
    }

    // Vérifier l'authentification de l'admin
    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // Vérifier le token utilisateur via Supabase Auth
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    // Construire les lignes à insérer
    const codes = [];
    const rows = [];

    for (let i = 0; i < qty; i++) {
      const code = generateSecretCode();
      codes.push(code);
      rows.push({
        secret_code: code,                                  // ⚠️ Temporaire — sera supprimé après
        secret_code_hash: hashCode(code),                   // Pour recherche rapide
        secret_code_encrypted: encryptCode(code),           // Version chiffrée
        secret_status: 'UNUSED',
        brand: brand.trim(),
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

    // Insertion par chunks de 500
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

    // Supprimer la colonne secret_code (plaintext) pour ces nouveaux codes
    // → On garde seulement hash + encrypted
    // Note : on ne peut pas supprimer colonne par code sans DELETE/UPDATE
    // → On met une valeur temporaire "ENCRYPTED" pour signaler
    // Mais pour éviter de casser l'ancien code, on laisse secret_code tel quel
    // → Il sera supprimé par un script SQL de migration plus tard

    // Retourner les codes EN CLAIR une seule fois (pour impression immédiate)
    return res.status(200).json({
      status: 'OK',
      inserted: inserted,
      codes: codes,     // ⚠️ Ces codes ne seront JAMAIS renvoyés après
      lot: lot || null,
      brand: brand.trim()
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
