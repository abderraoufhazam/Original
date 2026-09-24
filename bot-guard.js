// bot-guard.js
// Protection automatique contre les bots

(function() {
  // Éviter le double-log dans la même session
  if (sessionStorage.getItem('vg_logged')) return;

  const logVisit = async () => {
    try {
      const res = await fetch('/api/log-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: location.pathname,
          referrer: document.referrer || null
        })
      });

      const data = await res.json();
      sessionStorage.setItem('vg_logged', '1');

      // Si c'est un bot → bloquer
      if (data.isBot) {
        document.documentElement.innerHTML = `
          <!doctype html>
          <html>
            <head>
              <title>Access Denied</title>
              <meta name="viewport" content="width=device-width,initial-scale=1">
            </head>
            <body style="
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 40px 20px;
              text-align: center;
              background: #0f172a;
              color: #fff;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            ">
              <div>
                <div style="font-size: 80px; line-height: 1;">🚫</div>
                <h1 style="font-size: 28px; margin: 20px 0 10px;">Access Denied</h1>
                <p style="color: #94a3b8; font-size: 14px; margin: 0;">
                  Automated access is not allowed.
                </p>
              </div>
            </body>
          </html>
        `;
      }
    } catch (e) {
      // Silencieux — ne pas bloquer l'utilisateur en cas d'erreur réseau
      console.warn('Bot guard:', e.message);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logVisit);
  } else {
    logVisit();
  }
})();
