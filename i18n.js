
// i18n.js — Traductions FR / AR / EN

const TRANSLATIONS = {
  fr: {
    pageTitle: "Vérification d'authenticité — Produit dz ORG",
    title: "Vérification d'authenticité",
    subtitle: "Entrez le code de sécurité caché sous la zone à gratter.",
    placeholder: "CODE DE SÉCURITÉ",
    verifyBtn: "VÉRIFIER",
    verifying: "VÉRIFICATION...",
    footerSmall: "Le code de sécurité ne peut être vérifié qu'une seule fois.",
    footerBy: "Application vérifiée par",

    // Résultats
    originalTitle: "PRODUIT ORIGINAL",
    originalMsg: "Code authentifié avec succès.",
    usedTitle: "CODE DÉJÀ UTILISÉ",
    usedMsg: "Ce code a déjà été vérifié. Si vous pensez qu'il s'agit d'une erreur, contactez la marque.",
    invalidTitle: "CODE INVALIDE",
    invalidMsg: "Ce code n'est plus actif.",
    notOriginalTitle: "PRODUIT NON ORIGINAL",
    notOriginalMsg: "Le code de sécurité saisi est invalide.",
    errorTitle: "ERREUR DE CONNEXION",
    errorMsg: "Veuillez réessayer.",

    // Détails produit
    brandLabel: "Marque",
    productLabel: "Produit",
    referenceLabel: "Référence",
    lotLabel: "Lot",
    fabricationLabel: "Fabrication",
    expirationLabel: "Expiration",

    // Feedback
    feedbackTitle: "⭐ Notez ce produit",
    feedbackSubtitle: "Votre avis compte pour nous.",
    feedbackPlaceholder: "Ajoutez un commentaire (optionnel)",
    feedbackSubmit: "ENVOYER MON AVIS",
    feedbackSelectRating: "Veuillez sélectionner une note (1 à 5 étoiles).",
    feedbackThanks: "✓ Merci pour votre avis !",

    // Signalement
    reportTitle: "🚨 Signaler un problème",
    reportSubtitle: "Vous pensez que ce produit est une contrefaçon ? Signalez-le-nous.",
    reportBtn: "SIGNALER UNE CONTREFAÇON",
    reportConfirm: "Confirmer le signalement de contrefaçon ?",
    reportThanks: "✓ Signalement enregistré. Merci.",

    // Divers
    errorConn: "Erreur de connexion.",
    installBtn: "📱 INSTALLER L'APPLICATION"
  },

  ar: {
    pageTitle: "التحقق من الأصالة — Produit dz ORG",
    title: "التحقق من الأصالة",
    subtitle: "أدخل الكود السري المخفي تحت طبقة الخدش.",
    placeholder: "الكود السري",
    verifyBtn: "تحقق",
    verifying: "جاري التحقق...",
    footerSmall: "الكود السري يُستعمل مرة واحدة فقط.",
    footerBy: "التطبيق موثّق من",

    // Résultats
    originalTitle: "منتج أصلي",
    originalMsg: "تم التحقق من الكود بنجاح.",
    usedTitle: "كود مستعمل من قبل",
    usedMsg: "تم استعمال هذا الكود سابقًا. إذا كنت تعتقد أنه خطأ، اتصل بالعلامة التجارية.",
    invalidTitle: "كود غير صالح",
    invalidMsg: "هذا الكود لم يعد نشطًا.",
    notOriginalTitle: "منتج غير أصلي",
    notOriginalMsg: "الكود السري الذي أدخلته غير صالح.",
    errorTitle: "خطأ في الاتصال",
    errorMsg: "الرجاء المحاولة مجددًا.",

    // Détails produit
    brandLabel: "العلامة",
    productLabel: "المنتج",
    referenceLabel: "المرجع",
    lotLabel: "الدفعة",
    fabricationLabel: "الإنتاج",
    expirationLabel: "الانتهاء",

    // Feedback
    feedbackTitle: "⭐ قيّم هذا المنتج",
    feedbackSubtitle: "رأيك يهمنا.",
    feedbackPlaceholder: "أضف تعليقًا (اختياري)",
    feedbackSubmit: "إرسال رأيي",
    feedbackSelectRating: "الرجاء اختيار تقييم (من 1 إلى 5 نجوم).",
    feedbackThanks: "✓ شكرًا على رأيك!",

    // Signalement
    reportTitle: "🚨 الإبلاغ عن مشكلة",
    reportSubtitle: "تعتقد أن هذا المنتج مقلّد؟ أبلغنا.",
    reportBtn: "الإبلاغ عن تقليد",
    reportConfirm: "تأكيد الإبلاغ عن التقليد؟",
    reportThanks: "✓ تم تسجيل الإبلاغ. شكرًا.",

    // Divers
    errorConn: "خطأ في الاتصال.",
    installBtn: "📱 تثبيت التطبيق"
  },

  en: {
    pageTitle: "Authenticity Verification — Produit dz ORG",
    title: "Authenticity Verification",
    subtitle: "Enter the security code hidden under the scratch area.",
    placeholder: "SECURITY CODE",
    verifyBtn: "VERIFY",
    verifying: "VERIFYING...",
    footerSmall: "The security code can only be verified once.",
    footerBy: "App verified by",

    // Résultats
    originalTitle: "ORIGINAL PRODUCT",
    originalMsg: "Code successfully authenticated.",
    usedTitle: "CODE ALREADY USED",
    usedMsg: "This code has already been verified. If you believe this is an error, contact the brand.",
    invalidTitle: "INVALID CODE",
    invalidMsg: "This code is no longer active.",
    notOriginalTitle: "NON-ORIGINAL PRODUCT",
    notOriginalMsg: "The security code entered is invalid.",
    errorTitle: "CONNECTION ERROR",
    errorMsg: "Please try again.",

    // Détails produit
    brandLabel: "Brand",
    productLabel: "Product",
    referenceLabel: "Reference",
    lotLabel: "Batch",
    fabricationLabel: "Manufacturing",
    expirationLabel: "Expiration",

    // Feedback
    feedbackTitle: "⭐ Rate this product",
    feedbackSubtitle: "Your opinion matters to us.",
    feedbackPlaceholder: "Add a comment (optional)",
    feedbackSubmit: "SUBMIT MY REVIEW",
    feedbackSelectRating: "Please select a rating (1 to 5 stars).",
    feedbackThanks: "✓ Thank you for your review!",

    // Signalement
    reportTitle: "🚨 Report a problem",
    reportSubtitle: "Think this product is counterfeit? Report it to us.",
    reportBtn: "REPORT A COUNTERFEIT",
    reportConfirm: "Confirm the counterfeit report?",
    reportThanks: "✓ Report submitted. Thank you.",

    // Divers
    errorConn: "Connection error.",
    installBtn: "📱 INSTALL THE APP"
  }
};

// Langue active
let currentLang = localStorage.getItem("lang") || "fr";

// Détection automatique à la première visite
if (!localStorage.getItem("lang")) {
  const browserLang = (navigator.language || "fr").toLowerCase().slice(0, 2);
  if (browserLang === "ar") currentLang = "ar";
  else if (browserLang === "en") currentLang = "en";
  else currentLang = "fr";
}

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ||
         (TRANSLATIONS.fr[key]) || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });

  // Titre de la page
  document.title = t("pageTitle");

  // Direction RTL pour l'arabe
  if (currentLang === "ar") {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  } else {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = currentLang;
  }

  // Mettre à jour le bouton de langue actif
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  applyTranslations();
  // Ré-appliquer les messages déjà affichés si possible
  if (typeof window.__reapplyMessages === "function") {
    window.__reapplyMessages();
  }
}
