// api/_botcheck.js
// Détection intelligente de bots

import { getClientIp } from './_turnstile.js';

const GOOD_BOTS = [
  'googlebot', 'bingbot', 'duckduckbot', 'yandexbot',
  'baiduspider', 'facebookexternalhit', 'twitterbot',
  'linkedinbot', 'whatsapp', 'telegrambot', 'applebot',
  'slackbot', 'discordbot', 'pinterestbot',
];

const BAD_BOT_PATTERNS = [
  'curl/', 'wget/', 'python-requests', 'python-urllib',
  'python-httpx', 'scrapy/', 'okhttp',
  'go-http-client', 'axios/', 'node-fetch', 'node-http',
  'apache-httpclient', 'postmanruntime', 'insomnia',
  'libwww-perl', 'httpclient', 'http_request',
  'zgrab', 'nmap', 'masscan', 'sqlmap', 'nikto',
  'nuclei', 'hydra', 'wfuzz', 'dirbuster', 'gobuster',
  'nutch', 'semrushbot', 'mj12bot', 'dotbot', 'petalbot',
  'bytespider', 'spider', 'scanner', 'crawler-bot',
];

const DATACENTER_PREFIXES = [
  // Cloudflare
  '103.21.', '103.22.', '103.23.', '103.24.',
  '103.25.', '103.26.', '103.27.', '103.28.',
  '104.16.', '104.17.', '104.18.', '104.19.',
  '104.20.', '104.21.', '104.22.', '104.23.',
  '104.24.', '104.25.', '104.26.', '104.27.',

  // AWS (بادئات ضيقة)
  '13.64.', '13.107.',
  '40.77.',

  // Google Cloud (نطاق محدود)
  '35.190.', '35.191.',
];

export function analyzeRequest(req) {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  // IP موثوقة فقط (x-real-ip أولاً، ثم آخر عنصر في x-forwarded-for)
  const ip = getClientIp(req) || 'unknown';
  const country = req.headers['x-vercel-ip-country'] || '';
  const city = req.headers['x-vercel-ip-city'] || '';

  let botScore = 0;
  const reasons = [];

  // 1. Bon bot (Google, Bing...) → autorisé
  const isGoodBot = GOOD_BOTS.some(b => userAgent.includes(b));
  if (isGoodBot) {
    return {
      ip, userAgent, country, city,
      botScore: 0,
      status: 'good-bot',
      reason: 'search-engine',
      isBot: false
    };
  }

  // 2. User-Agent vide ou suspect
  if (!userAgent || userAgent.length < 10) {
    botScore += 60;
    reasons.push('no-user-agent');
  }

  // 3. Motifs de bots connus
  const badMatch = BAD_BOT_PATTERNS.find(p => userAgent.includes(p));
  if (badMatch) {
    botScore += 90;
    reasons.push('bad-ua:' + badMatch);
  }

  // 4. IP de datacenter (قرينة ضعيفة فقط)
  const isDatacenter = DATACENTER_PREFIXES.some(p => ip.startsWith(p));
  if (isDatacenter) {
    botScore += 15;
    reasons.push('datacenter-ip');
  }
  // 5. User-Agent générique (suspect)
  if (userAgent === 'mozilla/5.0' || userAgent === 'mozilla' || userAgent === 'chrome') {
   botScore += 50;
    reasons.push('generic-ua');
  }

  // Statut final
  let status = 'real';
  if (botScore >= 70) status = 'bot';
  else if (botScore >= 30) status = 'suspicious';

  return {
    ip, userAgent, country, city,
    botScore: Math.min(botScore, 100),
    status,
    reason: reasons.join(','),
    isBot: status === 'bot'
  };
}
