// app.js — Vérification + Avis + Signalement + i18n + Chatbot context + Social media PNG

const form = document.getElementById("verifyForm");
const codeInput = document.getElementById("code");
const btn = document.getElementById("verifyBtn");
const result = document.getElementById("result");
const feedbackSection = document.getElementById("feedbackSection");
const reportSection = document.getElementById("reportSection");
const starsContainer = document.getElementById("stars");
const feedbackComment = document.getElementById("feedbackComment");
const feedbackSubmit = document.getElementById("feedbackSubmit");
const feedbackMsg = document.getElementById("feedbackMsg");
const reportBtn = document.getElementById("reportBtn");
const reportMsg = document.getElementById("reportMsg");

let currentCode = "";
let currentRating = 0;
let lastResultData = null;

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function show(type, html) {
  result.className = "result " + type;
  result.innerHTML = html;
}

function renderResult(data) {
  if (!data) { result.className = "result hidden"; return; }

  if (data.status === "ORIGINAL") {
    const p = data.product || {};

    window.__lastVerifiedProduct = {
      brand: p.brand || null,
      product_name: p.product_name || null,
      reference: p.reference || null,
      lot: p.lot || null,
      manufacture_date: p.manufacture_date || null,
      expiry_date: p.expiry_date || null
    };

    show("success", `
      <div class="icon">✓</div>
      <h2>${escapeHtml(t("originalTitle"))}</h2>
      <p>${escapeHtml(t("originalMsg"))}</p>
      ${p.product_image ? `<img class="product-image" src="${escapeHtml(p.product_image)}" alt="">` : ""}
      <div class="details">
        ${p.brand ? `<div><b>${escapeHtml(t("brandLabel"))}</b><span>${escapeHtml(p.brand)}</span></div>` : ""}
        ${p.product_name ? `<div><b>${escapeHtml(t("productLabel"))}</b><span>${escapeHtml(p.product_name)}</span></div>` : ""}
        ${p.reference ? `<div><b>${escapeHtml(t("referenceLabel"))}</b><span>${escapeHtml(p.reference)}</span></div>` : ""}
        ${p.lot ? `<div><b>${escapeHtml(t("lotLabel"))}</b><span>${escapeHtml(p.lot)}</span></div>` : ""}
        ${p.manufacture_date ? `<div><b>${escapeHtml(t("fabricationLabel"))}</b><span>${escapeHtml(p.manufacture_date)}</span></div>` : ""}
        ${p.expiry_date ? `<div><b>${escapeHtml(t("expirationLabel"))}</b><span>${escapeHtml(p.expiry_date)}</span></div>` : ""}
      </div>
      ${p.description ? `<p class="description">${escapeHtml(p.description)}</p>` : ""}
      ${(p.instagram_url || p.facebook_url || p.tiktok_url) ? `
        <div class="social-links">
          <p class="social-title">${escapeHtml(t("followUs"))}</p>
          <div class="social-buttons">
            ${p.instagram_url ? `
              <a href="${escapeHtml(p.instagram_url)}" target="_blank" rel="noopener" class="social-btn social-instagram" aria-label="Instagram">
                <img src="/instagram.png" alt="Instagram" class="social-icon-img">
                <span>Instagram</span>
              </a>` : ""}
            ${p.facebook_url ? `
              <a href="${escapeHtml(p.facebook_url)}" target="_blank" rel="noopener" class="social-btn social-facebook" aria-label="Facebook">
                <img src="/facebook.png" alt="Facebook" class="social-icon-img">
                <span>Facebook</span>
              </a>` : ""}
            ${p.tiktok_url ? `
              <a href="${escapeHtml(p.tiktok_url)}" target="_blank" rel="noopener" class="social-btn social-tiktok" aria-label="TikTok">
                <img src="/tiktok.png" alt="TikTok" class="social-icon-img">
                <span>TikTok</span>
              </a>` : ""}
          </div>
        </div>
      ` : ""}
    `);
    feedbackSection.classList.remove("hidden");
    reportSection.classList.remove("hidden");

  } else if (data.status === "USED") {
    window.__lastVerifiedProduct = null;
    show("warning", `<div class="icon">!</div><h2>${escapeHtml(t("usedTitle"))}</h2><p>${escapeHtml(t("usedMsg"))}</p>`);
    reportSection.classList.remove("hidden");

  } else if (data.status === "DISABLED" || data.status === "EXPIRED") {
    window.__lastVerifiedProduct = null;
    show("warning", `<div class="icon">!</div><h2>${escapeHtml(t("invalidTitle"))}</h2><p>${escapeHtml(t("invalidMsg"))}</p>`);
    reportSection.classList.remove("hidden");

  } else {
    window.__lastVerifiedProduct = null;
    show("danger", `<div class="icon">×</div><h2>${escapeHtml(t("notOriginalTitle"))}</h2><p>${escapeHtml(t("notOriginalMsg"))}</p>`);
    reportSection.classList.remove("hidden");
  }
}

window.__reapplyMessages = function () {
  if (lastResultData) renderResult(lastResultData);
  if (!btn.disabled) btn.textContent = t("verifyBtn");
  else btn.textContent = t("verifying");
  if (!feedbackMsg.classList.contains("hidden") && feedbackMsg.textContent.includes("✓")) {
    feedbackMsg.textContent = t("feedbackThanks");
  }
  if (!reportMsg.classList.contains("hidden") && reportMsg.textContent.includes("✓")) {
    reportMsg.textContent = t("reportThanks");
  }
};

if (starsContainer) {
  starsContainer.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      currentRating = parseInt(b.dataset.star, 10);
      starsContainer.querySelectorAll("button").forEach(x => {
        x.classList.toggle("active", parseInt(x.dataset.star, 10) <= currentRating);
      });
    });
  });
}

if (feedbackSubmit) {
  feedbackSubmit.addEventListener("click", async () => {
    if (!currentRating) {
      feedbackMsg.textContent = t("feedbackSelectRating");
      feedbackMsg.style.color = "#dc2626";
      feedbackMsg.classList.remove("hidden");
      return;
    }
    feedbackSubmit.disabled = true;
    feedbackSubmit.textContent = "...";
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_code: currentCode,
          type: "rating",
          rating: currentRating,
          comment: feedbackComment.value.trim()
        })
      });
      const data = await res.json();
      if (data.status === "OK") {
        feedbackMsg.textContent = t("feedbackThanks");
        feedbackMsg.style.color = "#16a34a";
        feedbackMsg.classList.remove("hidden");
        feedbackSection.style.opacity = "0.6";
        feedbackSection.style.pointerEvents = "none";
      } else {
        feedbackMsg.textContent = "Erreur : " + (data.message || "");
        feedbackMsg.style.color = "#dc2626";
        feedbackMsg.classList.remove("hidden");
      }
    } catch (e) {
      feedbackMsg.textContent = t("errorConn");
      feedbackMsg.style.color = "#dc2626";
      feedbackMsg.classList.remove("hidden");
    } finally {
      feedbackSubmit.disabled = false;
      feedbackSubmit.textContent = t("feedbackSubmit");
    }
  });
}

if (reportBtn) {
  reportBtn.addEventListener("click", async () => {
    if (!confirm(t("reportConfirm"))) return;
    reportBtn.disabled = true;
    reportBtn.textContent = "...";
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_code: currentCode || null,
          type: "report",
          comment: "Signalement de contrefaçon"
        })
      });
      const data = await res.json();
      if (data.status === "OK") {
        reportMsg.textContent = t("reportThanks");
        reportMsg.style.color = "#16a34a";
        reportMsg.classList.remove("hidden");
        reportSection.style.opacity = "0.6";
        reportSection.style.pointerEvents = "none";
      } else {
        reportMsg.textContent = "Erreur : " + (data.message || "");
        reportMsg.style.color = "#dc2626";
        reportMsg.classList.remove("hidden");
      }
    } catch (e) {
      reportMsg.textContent = t("errorConn");
      reportMsg.style.color = "#dc2626";
      reportMsg.classList.remove("hidden");
    } finally {
      reportBtn.disabled = false;
      reportBtn.textContent = t("reportBtn");
    }
  });
}

function resetFeedbackSections() {
  feedbackSection.classList.add("hidden");
  reportSection.classList.add("hidden");
  feedbackSection.style.opacity = "1";
  feedbackSection.style.pointerEvents = "auto";
  reportSection.style.opacity = "1";
  reportSection.style.pointerEvents = "auto";
  starsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  currentRating = 0;
  feedbackComment.value = "";
  feedbackMsg.classList.add("hidden");
  reportMsg.classList.add("hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  currentCode = code;
  lastResultData = null;
  window.__lastVerifiedProduct = null;
  resetFeedbackSections();
  btn.disabled = true;
  btn.textContent = t("verifying");
  result.className = "result hidden";
  try {
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_code: code })
    });
    const data = await r.json();
    lastResultData = data;
    renderResult(data);
  } catch {
    show("danger", `<h2>${escapeHtml(t("errorTitle"))}</h2><p>${escapeHtml(t("errorMsg"))}</p>`);
  } finally {
    btn.disabled = false;
    btn.textContent = t("verifyBtn");
  }
});

if (typeof applyTranslations === "function") {
  applyTranslations();
}
