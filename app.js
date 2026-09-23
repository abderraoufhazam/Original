// app.js — Vérification + Avis + Signalement

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

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function show(type, html) {
  result.className = "result " + type;
  result.innerHTML = html;
}

// ============================================================
// ÉTOILES
// ============================================================
starsContainer.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    currentRating = parseInt(btn.dataset.star, 10);
    starsContainer.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.star, 10) <= currentRating);
    });
  });
});

// ============================================================
// ENVOI AVIS
// ============================================================
feedbackSubmit.addEventListener("click", async () => {
  if (!currentRating) {
    feedbackMsg.textContent = "Veuillez sélectionner une note (1 à 5 étoiles).";
    feedbackMsg.style.color = "#dc2626";
    feedbackMsg.classList.remove("hidden");
    return;
  }

  feedbackSubmit.disabled = true;
  feedbackSubmit.textContent = "ENVOI...";

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
      feedbackMsg.textContent = "✓ Merci pour votre avis !";
      feedbackMsg.style.color = "#16a34a";
      feedbackMsg.classList.remove("hidden");
      feedbackSection.style.opacity = "0.6";
      feedbackSection.style.pointerEvents = "none";
    } else {
      feedbackMsg.textContent = "Erreur : " + (data.message || "Veuillez réessayer.");
      feedbackMsg.style.color = "#dc2626";
      feedbackMsg.classList.remove("hidden");
    }
  } catch (e) {
    feedbackMsg.textContent = "Erreur de connexion.";
    feedbackMsg.style.color = "#dc2626";
    feedbackMsg.classList.remove("hidden");
  } finally {
    feedbackSubmit.disabled = false;
    feedbackSubmit.textContent = "ENVOYER MON AVIS";
  }
});

// ============================================================
// ENVOI SIGNALEMENT
// ============================================================
reportBtn.addEventListener("click", async () => {
  if (!confirm("Confirmer le signalement de contrefaçon ?")) return;

  reportBtn.disabled = true;
  reportBtn.textContent = "ENVOI...";

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
      reportMsg.textContent = "✓ Signalement enregistré. Merci.";
      reportMsg.style.color = "#16a34a";
      reportMsg.classList.remove("hidden");
      reportSection.style.opacity = "0.6";
      reportSection.style.pointerEvents = "none";
    } else {
      reportMsg.textContent = "Erreur : " + (data.message || "Veuillez réessayer.");
      reportMsg.style.color = "#dc2626";
      reportMsg.classList.remove("hidden");
    }
  } catch (e) {
    reportMsg.textContent = "Erreur de connexion.";
    reportMsg.style.color = "#dc2626";
    reportMsg.classList.remove("hidden");
  } finally {
    reportBtn.disabled = false;
    reportBtn.textContent = "SIGNALER UNE CONTREFAÇON";
  }
});

// ============================================================
// RESET DES SECTIONS AVANT CHAQUE VÉRIFICATION
// ============================================================
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

// ============================================================
// VÉRIFICATION
// ============================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;

  currentCode = code;
  resetFeedbackSections();

  btn.disabled = true;
  btn.textContent = "VÉRIFICATION...";
  result.className = "result hidden";

  try {
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_code: code })
    });
    const data = await r.json();

    if (data.status === "ORIGINAL") {
      const p = (data.product) || {};
      show("success", `
        <div class="icon">✓</div>
        <h2>PRODUIT ORIGINAL</h2>
        <p>Code authentifié avec succès.</p>
        ${p.product_image ? `<img class="product-image" src="${escapeHtml(p.product_image)}" alt="">` : ""}
        <div class="details">
          ${p.brand ? `<div><b>Marque</b><span>${escapeHtml(p.brand)}</span></div>` : ""}
          ${p.product_name ? `<div><b>Produit</b><span>${escapeHtml(p.product_name)}</span></div>` : ""}
          ${p.reference ? `<div><b>Référence</b><span>${escapeHtml(p.reference)}</span></div>` : ""}
          ${p.lot ? `<div><b>Lot</b><span>${escapeHtml(p.lot)}</span></div>` : ""}
          ${p.manufacture_date ? `<div><b>Fabrication</b><span>${escapeHtml(p.manufacture_date)}</span></div>` : ""}
          ${p.expiry_date ? `<div><b>Expiration</b><span>${escapeHtml(p.expiry_date)}</span></div>` : ""}
        </div>
        ${p.description ? `<p class="description">${escapeHtml(p.description)}</p>` : ""}
      `);
      // Afficher les sections avis + signalement
      feedbackSection.classList.remove("hidden");
      reportSection.classList.remove("hidden");

    } else if (data.status === "USED") {
      show("warning", `<div class="icon">!</div><h2>CODE DÉJÀ UTILISÉ</h2><p>Ce code a déjà été vérifié. Si vous pensez qu'il s'agit d'une erreur, contactez la marque.</p>`);
      reportSection.classList.remove("hidden");

    } else if (data.status === "DISABLED" || data.status === "EXPIRED") {
      show("warning", `<div class="icon">!</div><h2>CODE INVALIDE</h2><p>Ce code n'est plus actif.</p>`);
      reportSection.classList.remove("hidden");

    } else {
      show("danger", `<div class="icon">×</div><h2>PRODUIT NON ORIGINAL</h2><p>Le code de sécurité saisi est invalide.</p>`);
      reportSection.classList.remove("hidden");
    }
  } catch {
    show("danger", `<h2>ERREUR DE CONNEXION</h2><p>Veuillez réessayer.</p>`);
  } finally {
    btn.disabled = false;
    btn.textContent = "VÉRIFIER";
  }
});
