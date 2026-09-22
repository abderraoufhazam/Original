const form = document.getElementById("verifyForm");
const codeInput = document.getElementById("code");
const btn = document.getElementById("verifyBtn");
const result = document.getElementById("result");

function escapeHtml(v="") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function show(type, html) {
  result.className = "result " + type;
  result.innerHTML = html;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;

  btn.disabled = true;
  btn.textContent = "VÉRIFICATION...";
  result.className = "result hidden";

  try {
    const r = await fetch("/api/verify", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
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
    } else if (data.status === "USED") {
      show("warning", `<div class="icon">!</div><h2>CODE DÉJÀ UTILISÉ</h2><p>Ce code a déjà été vérifié. Si vous pensez qu'il s'agit d'une erreur, contactez la marque.</p>`);
    } else if (data.status === "DISABLED" || data.status === "EXPIRED") {
      show("warning", `<div class="icon">!</div><h2>CODE INVALIDE</h2><p>Ce code n'est plus actif.</p>`);
    } else {
      show("danger", `<div class="icon">×</div><h2>PRODUIT NON ORIGINAL</h2><p>Le code de sécurité saisi est invalide.</p>`);
    }
  } catch {
    show("danger", `<h2>ERREUR DE CONNEXION</h2><p>Veuillez réessayer.</p>`);
  } finally {
    btn.disabled = false;
    btn.textContent = "VÉRIFIER";
  }
});
