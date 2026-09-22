// api/verify.js
// التحقق من الكود السري عبر Supabase RPC

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'ERROR',
      message: 'Method not allowed'
    });
  }

  try {
    const { secret_code } = req.body || {};

    if (!secret_code || typeof secret_code !== 'string' || secret_code.trim() === '') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Code secret manquant'
      });
    }

    const cleanCode = secret_code.trim().toUpperCase();

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Configuration serveur manquante'
      });
    }

    const rpcResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/verify_secret_code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ p_secret_code: cleanCode })
      }
    );

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text();
      console.error('Supabase RPC error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur serveur'
      });
    }

    const data = await rpcResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue'
    });
  }
}
