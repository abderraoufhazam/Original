// ============================================================
// ORDIZ — Site Layout System v1.3
// Header + Footer + Dropdown (قانوني) + زر اللغة العائم
// ============================================================

(function() {
  // ─── الصفحات ───
  const PAGES = [
    { id: "home",     url: "/",              ar: "الرئيسية",   fr: "Accueil",           en: "Home" },
    { id: "verify",   url: "/verify",        ar: "التحقق",     fr: "Vérifier",          en: "Verify" },
    { id: "how",      url: "/how-it-works",  ar: "كيف يعمل",   fr: "Comment ça marche", en: "How it works" },
    { id: "pricing",  url: "/pricing",       ar: "الأسعار",    fr: "Tarifs",            en: "Pricing" },
    { id: "about",    url: "/about",         ar: "من نحن",     fr: "À propos",          en: "About" },
    { id: "faq",      url: "/faq",           ar: "الأسئلة",    fr: "FAQ",               en: "FAQ" },
    { id: "team",     url: "/team",          ar: "الفريق",     fr: "Équipe",            en: "Team" },
    {
      id: "legal",
      isDropdown: true,
      ar: "قانوني",
      fr: "Légal",
      en: "Legal",
      children: [
        { id: "privacy", url: "/privacy", ar: "🔒 الخصوصية", fr: "🔒 Confidentialité", en: "🔒 Privacy" },
        { id: "terms",   url: "/terms",   ar: "📜 الشروط",   fr: "📜 Conditions",     en: "📜 Terms" }
      ]
    },
    { id: "stats",   url: "/stats",        ar: "الإحصائيات", fr: "Statistiques",      en: "Stats" },
    { id: "report",   url: "/report",        ar: "الإبلاغ",    fr: "Signaler",          en: "Report" },
    { id: "contact",  url: "/contact",       ar: "اتصل بنا",   fr: "Contact",           en: "Contact" }
  ];

  // ─── الحالة ───
  let currentLang = localStorage.getItem("lang") || "ar";
  if (!localStorage.getItem("lang")) {
    const bl = (navigator.language || "ar").toLowerCase().slice(0, 2);
    currentLang = bl === "fr" ? "fr" : bl === "en" ? "en" : "ar";
  }

  const isDark = localStorage.getItem("theme") === "dark";
  if (isDark) document.documentElement.classList.add("dark");

  const currentPage = window.SITE_PAGE || "home";

  // ─── الترجمات ───
  const T = {
    ar: {
      home: "الرئيسية", how: "كيف يعمل", pricing: "الأسعار",
      about: "من نحن", faq: "الأسئلة", report: "الإبلاغ",
      team: "الفريق", "case-studies": "دراسات الحالة",
      privacy: "الخصوصية", terms: "الشروط",
      legal: "قانوني", contact: "اتصل بنا", stats: "الإحصائيات",

      loginBtn: "دخول",
      signupBtn: "تسجيل",
      tagline: "الحماية من التقليد",
      menu: "القائمة",
      chooseLanguage: "اختر اللغة",

      footerDesc: "نظام جزائري احترافي لحماية المنتجات من التقليد، عبر QR وكود سري مخفي.",
      platform: "المنصة",
      company: "الشركة",
      contactCol: "تواصل",
      legalCol: "قانوني",

      verify: "التحقق",
      signupLink: "التسجيل",
      howItWorks: "كيف يعمل",
      aboutLink: "من نحن",
      pricingLink: "الأسعار",
      faqLink: "الأسئلة",
      reportFake: "الإبلاغ عن تقليد",
      contactUs: "اتصل بنا",
      rights: "جميع الحقوق محفوظة"
    },
    fr: {
      home: "Accueil", how: "Comment ça marche", pricing: "Tarifs",
      about: "À propos", faq: "FAQ", report: "Signaler",
      team: "Équipe", "case-studies": "Cas d'étude",
      privacy: "Confidentialité", terms: "Conditions",
      legal: "Légal", contact: "Contact", stats: "Statistiques",

      loginBtn: "Connexion",
      signupBtn: "Inscription",
      tagline: "Protection anti-contrefaçon",
      menu: "Menu",
      chooseLanguage: "Choisir la langue",

      footerDesc: "Système algérien professionnel de protection des produits contre la contrefaçon.",
      platform: "Plateforme",
      company: "Entreprise",
      contactCol: "Contact",
      legalCol: "Légal",

      verify: "Vérifier",
      signupLink: "Inscription",
      howItWorks: "Comment ça marche",
      aboutLink: "À propos",
      pricingLink: "Tarifs",
      faqLink: "FAQ",
      reportFake: "Signaler",
      contactUs: "Contactez-nous",
      rights: "Tous droits réservés"
    },
    en: {
      home: "Home", how: "How it works", pricing: "Pricing",
      about: "About", faq: "FAQ", report: "Report",
      team: "Team", "case-studies": "Case studies",
      privacy: "Privacy", terms: "Terms",
      legal: "Legal", contact: "Contact", stats: "Stats",

      loginBtn: "Login",
      signupBtn: "Sign up",
      tagline: "Anti-counterfeit protection",
      menu: "Menu",
      chooseLanguage: "Choose language",

      footerDesc: "Algerian professional system protecting products from counterfeiting.",
      platform: "Platform",
      company: "Company",
      contactCol: "Contact",
      legalCol: "Legal",

      verify: "Verify",
      signupLink: "Sign up",
      howItWorks: "How it works",
      aboutLink: "About",
      pricingLink: "Pricing",
      faqLink: "FAQ",
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
      if (p.isDropdown) {
        const items = p.children.map(c => {
          const label = (T[currentLang] && T[currentLang][c.id]) || c.ar;
          return `<a href="${c.url}">${label}</a>`;
        }).join("");
        const title = (T[currentLang] && T[currentLang][p.id]) || p.ar;
        return `
          <div class="site-nav-dropdown" data-dropdown="true">
            <button class="site-nav-dropdown-btn" type="button">
              <span>⚖️ ${title}</span>
              <span class="site-nav-dropdown-arrow">▾</span>
            </button>
            <div class="site-nav-dropdown-menu">${items}</div>
          </div>
        `;
      }
      const label = t(p.id) || p.ar;
      const isActive = currentPage === p.id ? "active" : "";
      return `<a href="${p.url}" class="${isActive}">${label}</a>`;
    }).join("");

    const mobileNavLinks = PAGES.map(p => {
      if (p.isDropdown) {
        const items = p.children.map(c => {
          const label = (T[currentLang] && T[currentLang][c.id]) || c.ar;
          return `<a href="${c.url}" class="mobile-sub-link">${label}</a>`;
        }).join("");
        const title = (T[currentLang] && T[currentLang][p.id]) || p.ar;
        return `
          <div class="mobile-nav-group">
            <button class="mobile-nav-toggle" type="button">
              <span>⚖️ ${title}</span>
              <span class="mobile-nav-arrow">▾</span>
            </button>
            <div class="mobile-nav-children">${items}</div>
          </div>
        `;
      }
      const label = t(p.id) || p.ar;
      const isActive = currentPage === p.id ? "active" : "";
      return `<a href="${p.url}" class="${isActive}">${label}</a>`;
    }).join("");

    return `
      <div class="site-header-inner">
        <a href="/" class="site-logo" aria-label="ORDIZ">
          <img src="/ordiz-logo.png" alt="ORDIZ" style="height:38px;width:auto;max-width:180px;object-fit:contain;">
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

      <div class="mobile-menu" id="siteMobileMenu">
        <div class="mobile-menu-inner">
          <div class="mobile-menu-header">
            <div class="mobile-menu-title">📱 ${t("menu")}</div>
            <button class="icon-btn" id="siteMobileClose">✕</button>
          </div>

          <div class="mobile-lang-switch">
            <button data-lang="ar" class="${currentLang === 'ar' ? 'active' : ''}">
              <span>🇩🇿</span><span>العربية</span>
            </button>
            <button data-lang="fr" class="${currentLang === 'fr' ? 'active' : ''}">
              <span>🇫🇷</span><span>Français</span>
            </button>
            <button data-lang="en" class="${currentLang === 'en' ? 'active' : ''}">
              <span>🇬🇧</span><span>English</span>
            </button>
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
            <img src="/ordiz-logo.png" alt="ORDIZ" style="height:44px;width:auto;max-width:200px;object-fit:contain;background:#fff;padding:6px 10px;border-radius:8px;">
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
              <li><a href="/team">👥 ${t("team")}</a></li>
              <li><a href="/case-studies">📊 ${t("case-studies")}</a></li>
              <li><a href="/faq">❓ ${t("faqLink")}</a></li>
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

          <div class="site-footer-col">
            <h5>${t("legalCol")}</h5>
            <ul>
              <li><a href="/privacy">🔒 ${t("privacy")}</a></li>
              <li><a href="/terms">📜 ${t("terms")}</a></li>
              <li><a href="/report">🚨 ${t("reportFake")}</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer-bottom">
          © ${year} <strong>ORDIZ</strong> — ${t("rights")}
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

    const mobileMenu = document.getElementById("siteMobileMenu");
    if (mobileMenu && mobileMenu.parentElement) {
      document.body.appendChild(mobileMenu);
    }

      // 🌍 زر اللغة العائم
  injectLangSwitcher();

  setupHandlers();

  // 🌐 تطبيق ترجمات المحتوى
  applyContentTranslations();
}

// ─── تطبيق ترجمات المحتوى ───
function applyContentTranslations() {
  const pageId = currentPage;
  if (!pageId) return;

  const translations = window.CONTENT_TRANSLATIONS;
  if (!translations || !translations[pageId]) return;

  const pageTranslations = translations[pageId];

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return;

    const entry = pageTranslations[key];
    if (!entry) return;

    const val = entry[currentLang] || entry.ar;
    if (!val) return;

    // للـplaceholder
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
}

  // ─── زر اللغة العائم ───
  function injectLangSwitcher() {
    if (document.getElementById("floatingLangSwitcher")) return;

    const langNames = {
      ar: { name: "العربية", flag: "🇩🇿" },
      fr: { name: "Français", flag: "🇫🇷" },
      en: { name: "English", flag: "🇬🇧" }
    };

    const current = langNames[currentLang] || langNames.ar;

    const el = document.createElement("div");
    el.id = "floatingLangSwitcher";
    el.className = "floating-lang";
    el.innerHTML = `
      <button class="floating-lang-btn" id="floatingLangBtn" aria-label="${t("chooseLanguage")}">
        <span class="floating-lang-icon">🌍</span>
        <span class="floating-lang-current">${current.flag}</span>
      </button>
      <div class="floating-lang-menu" id="floatingLangMenu">
        <button data-lang="ar" class="${currentLang === 'ar' ? 'active' : ''}">
          <span>🇩🇿</span><span>العربية</span>
          ${currentLang === 'ar' ? '<span class="check">✓</span>' : ''}
        </button>
        <button data-lang="fr" class="${currentLang === 'fr' ? 'active' : ''}">
          <span>🇫🇷</span><span>Français</span>
          ${currentLang === 'fr' ? '<span class="check">✓</span>' : ''}
        </button>
        <button data-lang="en" class="${currentLang === 'en' ? 'active' : ''}">
          <span>🇬🇧</span><span>English</span>
          ${currentLang === 'en' ? '<span class="check">✓</span>' : ''}
        </button>
      </div>
    `;
    document.body.appendChild(el);

    const btn = document.getElementById("floatingLangBtn");
    const menu = document.getElementById("floatingLangMenu");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.toggle("open");
    });

    menu.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const lang = b.dataset.lang;
        localStorage.setItem("lang", lang);
        location.reload();
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#floatingLangSwitcher")) {
        el.classList.remove("open");
      }
    });
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

    // Language switcher (Header + Mobile Menu + Floating)
    document.querySelectorAll(".lang-switch button, .mobile-lang-switch button").forEach(btn => {
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

    // Desktop dropdown
    document.querySelectorAll(".site-nav-dropdown").forEach(dd => {
      const btn = dd.querySelector(".site-nav-dropdown-btn");
      if (!btn) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = dd.classList.contains("open");
        document.querySelectorAll(".site-nav-dropdown").forEach(other => other.classList.remove("open"));
        if (!wasOpen) dd.classList.add("open");
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".site-nav-dropdown")) {
        document.querySelectorAll(".site-nav-dropdown").forEach(dd => dd.classList.remove("open"));
      }
    });

    // Mobile dropdown
    document.querySelectorAll(".mobile-nav-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const group = btn.closest(".mobile-nav-group");
        if (group) group.classList.toggle("open");
      });
    });

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
