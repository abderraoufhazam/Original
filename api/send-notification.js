// api/send-notification.js
// Envoie une notification WhatsApp au propriétaire via CallMeBot

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { brand_name, email, phone, subject, message } = req.body || {};

    const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE;
    const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY;

    if (!CALLMEBOT_PHONE || !CALLMEBOT_API_KEY) {
      console.warn('CallMeBot not configured - skipping notification');
      return res.status(200).json({
        status: 'SKIPPED',
        message: 'CallMeBot non configuré'
      });
    }

    const lines = [
      '🔔 *NOUVEAU MESSAGE — Produit dz ORG*',
      '',
      '🏢 *Marque:* ' + (brand_name || '—'),
      '📧 *Email:* ' + (email || '—'),
    ];

    if (phone) lines.push('📱 *Téléphone:* ' + phone);
    if (subject) lines.push('', '📌 *Sujet:* ' + subject);
    if (message) lines.push('', '💬 *Message:*', message.slice(0, 500));

    lines.push('', '👉 Répondez via votre dashboard admin.');

    const text = lines.join('\n');

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(CALLMEBOT_PHONE)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CALLMEBOT_API_KEY)}`;

    const sendRes = await fetch(url);

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('CallMeBot error:', err);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur envoi WhatsApp',
        detail: err.slice(0, 200)
      });
    }

    const sendText = await sendRes.text();

    return res.status(200).json({
      status: 'OK',
      message: 'Notification envoyée',
      response: sendText.slice(0, 200)
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
