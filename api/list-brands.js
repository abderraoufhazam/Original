// api/list-brands.js
// Liste des marques inscrites

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { access_token } = req.body || {};

    if (!access_token) {
      return res.status(401).json({ status: 'ERROR', message: 'Non authentifié' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // Vérifier le token utilisateur
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ status: 'ERROR', message: 'Token invalide' });
    }

    const caller = await userRes.json();

    // ✅ Vérifier par email (méthode fiable)
    const ADMIN_EMAILS = [
      'mepirf@gmail.com',
      'abderraoufhazam@gmail.com'
    ];

    const callerEmail = (caller.email || '').toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail);

    if (!isAdmin) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Accès refusé',
        detail: 'Email non autorisé : ' + callerEmail
      });
    }

    // Récupérer tous les utilisateurs
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      console.error('List users error:', err);
      return res.status(500).json({ status: 'ERROR', message: 'Erreur récupération' });
    }

    const listData = await listRes.json();
    const users = listData.users || [];

    // Filtrer seulement les marques (exclure les admins)
    const brands = users
      .filter(u => {
        const email = (u.email || '').toLowerCase();
        const role = u.user_metadata?.role || 'brand';
        return role === 'brand' && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
      })
      .map(u => ({
        id: u.id,
        email: u.email,
        brand_name: u.user_metadata?.brand_name || null,
        phone: u.user_metadata?.phone || null,
        role: u.user_metadata?.role || 'brand',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      status: 'OK',
      count: brands.length,
      brands: brands
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
