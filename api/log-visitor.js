// api/log-visitor.js
import { analyzeRequest } from './_botcheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR' });
  }

  try {
    const analysis = analyzeRequest(req);

    // Enregistrer dans Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/visitor_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ip: analysis.ip,
            user_agent: analysis.userAgent.slice(0, 500),
            path: (req.body && req.body.path) || '/',
            country: analysis.country,
            bot_score: analysis.botScore,
            status: analysis.status,
            reason: analysis.reason
          })
        });
      } catch (logErr) {
        console.warn('Log error:', logErr.message);
      }
    }

    return res.status(200).json({
      status: 'OK',
      isBot: analysis.isBot,
      botScore: analysis.botScore,
      status_label: analysis.status
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ status: 'ERROR' });
  }
}
