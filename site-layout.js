// ============================================================
// OriginalDz — Site Layout System v1.0
// يُنشئ Header و Footer تلقائيًا في كل صفحة
// 
// الاستخدام في كل صفحة:
//   1. أضف في <head>:
//      <link rel="stylesheet" href="/site-layout.css">
//      <script>window.SITE_PAGE = "home";</script>
//   2. أضف في <body>:
//      <div id="site-header"></div>
//      ... محتوى الصفحة ...
//      <div id="site-footer"></div>
//      <script src="/site-layout.js"></script>
// ============================================================

(function() {
  // ─── الصفحات ───
  const PAGES = [
    { id: "home",     url: "/",              ar: "الرئيسية",  fr: "Accueil" },
    { id: "how",      url: "/how-it-works",  ar: "كيف يعمل",  fr: "Comment ça marche" },
    { id: "pricing",  url: "/pricing",       ar: "الأسعار",   fr: "Tarifs" },
    { id: "about",    url: "/about",         ar: "من نحن",    fr: "À propos" },
    { id: "faq",      url: "/faq",           ar: "الأسئلة",   fr: "FAQ" },
    { id: "report",   url: "/report",        ar: "الإبلاغ",   fr: "Signaler" },
    { id: "contact",  url: "/contact",       ar: "اتصل بنا",  fr: "Contact" }
  ];

  // ─── الحالة ───
  let currentLang = localStorage.getItem("lang") || "ar";
  const isDark = localStorage.getItem("theme") === "dark";
  if (isDark) document.documentElement.classList.add("dark");

  const currentPage = window.SITE_PAGE || "home";

  // ─── الترجمات ───
  const T = {
    ar: {
      home: "الرئيسية", how: "كيف يعمل", pricing: "الأسعار",
      about: "من نحن", faq: "الأسئلة", report: "الإبلاغ",
      contact: "اتصل بنا",
      loginBtn: "دخول",
      signupBtn: "تسجيل",
      tagline: "الحماية من التقليد",
      footerDesc: "نظام جزائري احترافي لحماية المنتجات من التقليد، عبر QR وكود سري مخفي.",
      platform: "المنصة",
      company: "الشركة",
      contactCol: "تواصل",
      verify: "التحقق",
      signupLink: "التسجيل",
      howItWorks: "كيف يعمل",
      aboutLink: "من نحن",
      pricingLink: "الأسعار",
      faqLink: "الأسئلة",
      privacy: "الخصوصية",
      terms: "الشروط",
      reportFake: "الإبلاغ عن تقليد",
      contactUs: "اتصل بنا",
      rights: "جميع الحقوق محفوظة"
    },
    fr: {
      home: "Accueil", how: "Comment ça marche", pricing: "Tarifs",
      about: "À propos", faq: "FAQ", report: "Signaler",
      contact: "Contact",
      loginBtn: "Connexion",
      signupBtn: "Inscription",
      tagline: "Protection anti-contrefaçon",
      footerDesc: "Système algérien professionnel de protection des produits contre la contrefaçon.",
      platform: "Plateforme",
      company: "Entreprise",
      contactCol: "Contact",
      verify: "Vérifier",
      signupLink: "Inscription",
      howItWorks: "Comment ça marche",
      aboutLink: "À propos",
      pricingLink: "Tarifs",
      faqLink: "FAQ",
      privacy: "Confidentialité",
      terms: "Conditions",
      reportFake: "Signaler",
      contactUs: "Contactez-nous",
      rights: "Tous droits réservés"
    },
    en: {
      home: "Home", how: "How it works", pricing: "Pricing",
      about: "About", faq: "FAQ", report: "Report",
      contact: "Contact",
      loginBtn: "Login",
      signupBtn: "Sign up",
      tagline: "Anti-counterfeit protection",
      footerDesc: "Algerian professional system protecting products from counterfeiting.",
      platform: "Platform",
      company: "Company",
      contactCol: "Contact",
      verify: "Verify",
      signupLink: "Sign up",
      howItWorks: "How it works",
      aboutLink: "About",
      pricingLink: "Pricing",
      faqLink: "FAQ",
      privacy: "Privacy",
      terms: "Terms",
      reportFake: "Report",
      contactUs: "Contact us",
      rights: "All rights reserved"
    }
  };

  function t(key) {
    return (T[currentLang] && T[currentLang][key]) || T.ar[key] || key;
  }

  // ─── Header HTML ───
  function buildHeader() {
    const navLinks = PAGES.map(p => {
      const label = t(p.id) || p.ar;
      const isActive = currentPage === p.id ? "active" : "";
      return `<a href="${p.url}" class="${isActive}">${label}</a>`;
    }).join("");

    const mobileNavLinks = PAGES.map(p => {
      const label = t(p.id) || p.ar;
      const isActive = currentPage === p.id ? "active" : "";
      return `<a href="${p.url}" class="${isActive}">${label}</a>`;
    }).join("");

    return `
      <div class="site-header-inner">
        <a href="/" class="site-logo">
          <img src="/icon.png" alt="OriginalDz">
          <div class="site-logo-text">
            <b>OriginalDz</b>
            <small>${t("tagline")}</small>
          </div>
        </a>

        <nav class="site-nav">
          ${navLinks}
        </nav>

        <div class="site-actions">
          <div class="lang-switch">
            <button data-lang="ar" class="${currentLang === 'ar' ? 'active' : ''}">ع</button>
            <button data-lang="fr" class="${currentLang === 'fr' ? 'active' : ''}">FR</button>
            <button data-lang="en" class="${currentLang === 'en' ? 'active' : ''}">EN</button>
          </div>
          <button class="icon-btn" id="siteDarkToggle" aria-label="Theme">🌙</button>
          <a href="/report" class="site-btn site-btn-red" title="${t("reportFake")}">
            <span>🚨</span>
            <span class="hide-mobile">${t("reportFake")}</span>
          </a>
          <a href="/login" class="site-btn site-btn-ghost">
            <span>🔐</span>
            <span class="hide-mobile">${t("loginBtn")}</span>
          </a>
          <a href="/signup" class="site-btn site-btn-green">
            <span>✨</span>
            <span class="hide-mobile">${t("signupBtn")}</span>
          </a>
          <button class="mobile-menu-btn" id="siteMobileBtn" aria-label="Menu">☰</button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div class="mobile-menu" id="siteMobileMenu">
        <div class="mobile-menu-inner">
          <div class="mobile-menu-header">
            <div class="mobile-menu-title">📱 القائمة</div>
            <button class="icon-btn" id="siteMobileClose">✕</button>
          </div>
          <nav class="mobile-menu-nav">
            ${mobileNavLinks}
          </nav>
          <div class="mobile-menu-actions">
            <a href="/report" class="site-btn site-btn-red">🚨 ${t("reportFake")}</a>
            <a href="/login" class="site-btn site-btn-ghost">🔐 ${t("loginBtn")}</a>
            <a href="/signup" class="site-btn site-btn-green">✨ ${t("signupBtn")}</a>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Footer HTML ───
  function buildFooter() {
    const year = new Date().getFullYear();

    return `
      <div class="container">
        <div class="site-footer-grid">
          <div class="site-footer-brand">
            <img src="/icon.png" alt="OriginalDz">
            <h4>OriginalDz</h4>
            <p>${t("footerDesc")}</p>
            <div class="site-footer-social">
              <a href="https://wa.me/213556339415" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
              <a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook">📘</a>
              <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram">📷</a>
              <a href="https://tiktok.com" target="_blank" rel="noopener" aria-label="TikTok">🎵</a>
            </div>
          </div>

          <div class="site-footer-col">
            <h5>${t("platform")}</h5>
            <ul>
              <li><a href="/verify">🔍 ${t("verify")}</a></li>
              <li><a href="/signup">✨ ${t("signupLink")}</a></li>
              <li><a href="/how-it-works">⚙️ ${t("howItWorks")}</a></li>
              <li><a href="/pricing">💰 ${t("pricingLink")}</a></li>
            </ul>
          </div>

          <div class="site-footer-col">
            <h5>${t("company")}</h5>
            <ul>
              <li><a href="/about">🏢 ${t("aboutLink")}</a></li>
              <li><a href="/faq">❓ ${t("faqLink")}</a></li>
              <li><a href="/report">🚨 ${t("reportFake")}</a></li>
              <li><a href="/contact">📞 ${t("contactUs")}</a></li>
            </ul>
          </div>

          <div class="site-footer-col">
            <h5>${t("contactCol")}</h5>
            <ul>
              <li><a href="https://wa.me/213556339415" target="_blank" rel="noopener">💬 WhatsApp</a></li>
              <li><a href="mailto:mepirf@gmail.com">📧 mepirf@gmail.com</a></li>
              <li><a href="tel:+213556339415">📱 +213 556 339 415</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer-bottom">
          © ${year} <strong>OriginalDz</strong> — ${t("rights")}
        </div>
      </div>
    `;
  }

  // ─── Injection ───
  function inject() {
    const headerEl = document.getElementById("site-header");
    const footerEl = document.getElementById("site-footer");

    if (headerEl) {
      headerEl.className = "site-header";
      headerEl.innerHTML = buildHeader();
    }
    if (footerEl) {
      footerEl.className = "site-footer";
      footerEl.innerHTML = buildFooter();
    }

    setupHandlers();
  }

  // ─── Handlers ───
  function setupHandlers() {
    // Dark mode
    const darkBtn = document.getElementById("siteDarkToggle");
    if (darkBtn) {
      const isDarkNow = document.documentElement.classList.contains("dark");
      darkBtn.textContent = isDarkNow ? "☀️" : "🌙";

      darkBtn.addEventListener("click", () => {
        const nowDark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", nowDark ? "dark" : "light");
        darkBtn.textContent = nowDark ? "☀️" : "🌙";
      });
    }

    // Language switcher
    document.querySelectorAll(".lang-switch button").forEach(btn => {
      btn.addEventListener("click", () => {
        const lang = btn.dataset.lang;
        localStorage.setItem("lang", lang);
        location.reload();
      });
    });

    // Mobile menu
    const mobileBtn = document.getElementById("siteMobileBtn");
    const mobileMenu = document.getElementById("siteMobileMenu");
    const mobileClose = document.getElementById("siteMobileClose");

    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", () => {
        mobileMenu.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    }

    if (mobileClose && mobileMenu) {
      mobileClose.addEventListener("click", () => {
        mobileMenu.classList.remove("open");
        document.body.style.overflow = "";
      });
    }

    if (mobileMenu) {
      mobileMenu.addEventListener("click", (e) => {
        if (e.target === mobileMenu) {
          mobileMenu.classList.remove("open");
          document.body.style.overflow = "";
        }
      });
    }

    // Set direction
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = currentLang;
  }

  // ─── Init ───
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
