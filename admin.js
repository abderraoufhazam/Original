const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let lastCodes = [];
let lastLogo = "";
let loadedLot = null;
let loadedLotCodes = [];
let loadedLotBrand = "";
let loadedLotLot = "";
let loadedLotLogo = "";
let currentFeedbackFilter = "all";

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  for (let i = 0; i < 12; i++) s += chars[a[i] % chars.length];
  return s;
}

// ============================================================
// NAVIGATION
// ============================================================
const PANEL_TITLES = {
  dashboard: "Tableau de bord",
  create: "Créer un lot",
  search: "Rechercher un code",
  manage: "Gérer un lot",
  log: "Journal",
  feedback: "Avis clients",
  settings: "Impression"
};

function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav button").forEach(b => b.classList.remove("active"));
  const p = $("panel-" + name);
  const b = document.querySelector('.sidebar-nav button[data-panel="' + name + '"]');
  if (p) p.classList.add("active");
  if (b) b.classList.add("active");
  const mt = $("mobileTitle");
  if (mt) mt.textContent = PANEL_TITLES[name] || "Admin";
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".sidebar-nav button").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});

$("menuToggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
  $("overlay").classList.toggle("show");
});
$("overlay").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
});

// ============================================================
// LOADERS
// ============================================================
async function loadStats() {
  const statuses = ["UNUSED", "USED", "DISABLED", "EXPIRED"];
  for (const st of statuses) {
    const { count, error } = await sb
      .from("qr_codes")
      .select("*", { count: "exact", head: true })
      .eq("secret_status", st);
    const el = $("stat" + st.charAt(0) + st.slice(1).toLowerCase());
    if (el) el.textContent = error ? "—" : (count ?? 0);
  }
}

async function loadLog() {
  const container = $("logList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  const { data, error } = await sb
    .from("qr_verifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucune vérification enregistrée.</p>`;
    return;
  }

  let html = "";
  data.forEach(r => {
    const statusClass =
      r.result === "ORIGINAL" ? "success" :
      r.result === "USED" ? "warning" : "danger";
    const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
    html += `
      <div class="log-row log-${statusClass}">
        <div class="log-top">
          <span class="log-result log-result-${statusClass}">${escapeHtml(r.result || "—")}</span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>
        <div class="log-code">${escapeHtml(r.secret_code || "")}</div>
        <div class="log-meta">
          ${r.brand ? `<span>🏷 ${escapeHtml(r.brand)}</span>` : ""}
          ${r.lot ? `<span>📦 ${escapeHtml(r.lot)}</span>` : ""}
          ${r.ip ? `<span>🌐 ${escapeHtml(r.ip)}</span>` : ""}
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

async function loadFeedback() {
  const container = $("feedbackList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  let query = sb
    .from("qr_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (currentFeedbackFilter !== "all") {
    query = query.eq("type", currentFeedbackFilter);
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucun avis pour le moment.</p>`;
    return;
  }

  let html = "";
  data.forEach(r => {
    const isRating = r.type === "rating";
    const typeClass = isRating ? "success" : "danger";
    const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";

    let stars = "";
    if (isRating && r.rating) {
      for (let i = 1; i <= 5; i++) {
        stars += `<span style="color:${i <= r.rating ? "#fbbf24" : "#cbd5e1"};font-size:18px">★</span>`;
      }
    }

    html += `
      <div class="log-row log-${typeClass}">
        <div class="log-top">
          <span class="log-result log-result-${typeClass}">
            ${isRating ? "⭐ AVIS" : "🚨 SIGNALEMENT"}
          </span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>
        ${stars ? `<div style="margin:6px 0">${stars} <span style="font-weight:700;color:#0f172a;margin-left:6px">${r.rating}/5</span></div>` : ""}
        ${r.comment ? `<div style="font-size:13px;color:#334155;line-height:1.6;margin:8px 0;padding:10px 12px;background:#fff;border-radius:10px;border:1px solid #e2e8f0">${escapeHtml(r.comment)}</div>` : ""}
        <div class="log-meta">
          ${r.secret_code ? `<span style="font-family:monospace;font-weight:700">🔑 ${escapeHtml(r.secret_code)}</span>` : ""}
          ${r.ip ? `<span>🌐 ${escapeHtml(r.ip)}</span>` : ""}
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

// Tabs de filtre
document.querySelectorAll("#feedbackTabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll("#feedbackTabs .tab").forEach(x => {
      x.classList.remove("active");
      x.style.background = "#fff";
      x.style.color = "#0f172a";
      x.style.border = "1px solid #e2e8f0";
    });
    t.classList.add("active");
    t.style.background = "#0f172a";
    t.style.color = "#fff";
    t.style.border = "0";
    currentFeedbackFilter = t.dataset.tab;
    loadFeedback();
  });
});

// ============================================================
// AUTH
// ============================================================
async function refresh() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    $("loginPage").classList.add("hidden");
    $("adminApp").classList.remove("hidden");
    const url = location.origin + "/";
    $("publicUrl").textContent = url;
    $("qr").innerHTML = "";
    new QRCode($("qr"), { text: url, width: 180, height: 180 });
    loadStats();
    loadLog();
    loadFeedback();
  }
}
refresh();

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "CONNEXION...";
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  $("loginBtn").disabled = false;
  $("loginBtn").textContent = "SE CONNECTER";
  if (error) {
    const el = $("loginError");
    el.className = "result danger";
    el.innerHTML = `<p style="margin:0">${escapeHtml(error.message)}</p>`;
    return;
  }
  $("loginError").classList.add("hidden");
  refresh();
});

$("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

$("refreshLogBtn").onclick = () => loadLog();
$("refreshFeedbackBtn").onclick = () => loadFeedback();

// ============================================================
// CREATE BATCH
// ============================================================
$("createBtn").onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const brand = $("brand").value.trim();
  if (!brand) return alert("La marque est obligatoire.");

  const qty = Math.min(10000, Math.max(1, Number($("quantity").value) || 1));
  const rows = [];
  lastCodes = [];
  lastLogo = $("logo_url").value.trim() || "";

  for (let i = 0; i < qty; i++) {
    const code = randomCode();
    lastCodes.push(code);
    rows.push({
      secret_code: code,
      secret_status: "UNUSED",
      brand: brand,
      product_name: $("product_name").value.trim() || null,
      reference: $("reference").value.trim() || null,
      lot: $("lot").value.trim() || null,
      manufacture_date: $("manufacture_date").value || null,
      expiry_date: $("expiry_date").value || null,
      product_image: $("product_image").value.trim() || null,
      logo_url: $("logo_url").value.trim() || null,
      description: $("description").value.trim() || null
    });
  }

  $("createBtn").disabled = true;
  $("createBtn").textContent = "CRÉATION...";

  const chunkSize = 500;
  try {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await sb.from("qr_codes").insert(chunk);
      if (error) throw error;
    }
    $("adminResult").className = "result success";
    $("adminResult").innerHTML =
      `<h2>✓ LOT CRÉÉ</h2><p>${qty} codes générés avec succès.</p>`;
    $("printBtn").classList.remove("hidden");
    loadStats();
  } catch (err) {
    $("adminResult").className = "result danger";
    $("adminResult").innerHTML = `<p>Erreur : ${escapeHtml(err.message)}</p>`;
  } finally {
    $("createBtn").disabled = false;
    $("createBtn").textContent = "CRÉER LE LOT";
  }
};

// ============================================================
// SEARCH CODE
// ============================================================
$("searchBtn").onclick = async () => {
  const code = ($("searchCode").value || "").trim().toUpperCase();
  const res = $("searchResult");
  if (!code) { res.className = "result hidden"; return; }

  const { data, error } = await sb
    .from("qr_codes")
    .select("*")
    .eq("secret_code", code)
    .limit(1);

  if (error || !data || data.length === 0) {
    res.className = "result danger";
    res.innerHTML = `<h2>NON TROUVÉ</h2><p>Aucun code ne correspond.</p>`;
    return;
  }

  const r = data[0];
  const statusClass =
    r.secret_status === "UNUSED" ? "success" :
    r.secret_status === "USED" ? "warning" : "danger";

  res.className = "result " + statusClass;
  res.innerHTML = `
    <h2>${escapeHtml(r.secret_status || "—")}</h2>
    <div class="details">
      ${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}
      ${r.product_name ? `<div><b>Produit</b><span>${escapeHtml(r.product_name)}</span></div>` : ""}
      ${r.reference ? `<div><b>Référence</b><span>${escapeHtml(r.reference)}</span></div>` : ""}
      ${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}
      ${r.manufacture_date ? `<div><b>Fabrication</b><span>${escapeHtml(r.manufacture_date)}</span></div>` : ""}
      ${r.expiry_date ? `<div><b>Expiration</b><span>${escapeHtml(r.expiry_date)}</span></div>` : ""}
      ${r.used_at ? `<div><b>Utilisé le</b><span>${escapeHtml(new Date(r.used_at).toLocaleString())}</span></div>` : ""}
    </div>
  `;
};

// ============================================================
// LOAD EXISTING LOT
// ============================================================
$("loadLotBtn").onclick = async () => {
  const lot = ($("editLotSearch").value || "").trim();
  const info = $("lotInfo");
  const form = $("editForm");
  const printLotBtn = $("printLotBtn");

  if (!lot) {
    info.className = "result danger";
    info.innerHTML = `<p>Entrez un numéro de lot.</p>`;
    form.classList.add("hidden");
    printLotBtn.classList.add("hidden");
    return;
  }

  info.className = "result";
  info.innerHTML = `<p>Chargement...</p>`;
  form.classList.add("hidden");
  printLotBtn.classList.add("hidden");
  loadedLot = null;
  loadedLotCodes = [];

  const { data, error } = await sb
    .from("qr_codes")
    .select("*")
    .eq("lot", lot)
    .limit(10000);

  if (error) {
    info.className = "result danger";
    info.innerHTML = `<p>Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    info.className = "result danger";
    info.innerHTML = `<h2>AUCUN RÉSULTAT</h2><p>Aucun code trouvé pour le lot "${escapeHtml(lot)}".</p>`;
    return;
  }

  const r = data[0];
  loadedLot = lot;
  loadedLotCodes = data.map(row => row.secret_code);
  loadedLotBrand = r.brand || "MARQUE";
  loadedLotLot = r.lot || lot;
  loadedLotLogo = r.logo_url || "";

  info.className = "result success";
  info.innerHTML = `
    <h2>${data.length} code(s) trouvé(s)</h2>
    <div class="details">
      ${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}
      ${r.product_name ? `<div><b>Produit</b><span>${escapeHtml(r.product_name)}</span></div>` : ""}
      ${r.reference ? `<div><b>Référence</b><span>${escapeHtml(r.reference)}</span></div>` : ""}
      ${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}
      ${r.manufacture_date ? `<div><b>Fabrication</b><span>${escapeHtml(r.manufacture_date)}</span></div>` : ""}
      ${r.expiry_date ? `<div><b>Expiration</b><span>${escapeHtml(r.expiry_date)}</span></div>` : ""}
    </div>
  `;

  printLotBtn.classList.remove("hidden");

  $("editBrand").value = r.brand || "";
  $("editProductName").value = r.product_name || "";
  $("editReference").value = r.reference || "";
  $("editNewLot").value = "";
  $("editManufactureDate").value = r.manufacture_date || "";
  $("editExpiryDate").value = r.expiry_date || "";
  $("editProductImage").value = r.product_image || "";
  $("editLogoUrl").value = r.logo_url || "";
  $("editDescription").value = r.description || "";

  form.classList.remove("hidden");
};

// ============================================================
// UPDATE ENTIRE LOT
// ============================================================
$("updateBatchBtn").onclick = async () => {
  if (!loadedLot) return alert("Chargez d'abord un lot.");

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const info = $("lotInfo");
  const updates = {};
  const v = id => ($(id).value || "").trim();

  if (v("editBrand")) updates.brand = v("editBrand");
  if (v("editProductName")) updates.product_name = v("editProductName");
  if (v("editReference")) updates.reference = v("editReference");
  if (v("editNewLot")) updates.lot = v("editNewLot");
  if ($("editManufactureDate").value) updates.manufacture_date = $("editManufactureDate").value;
  if ($("editExpiryDate").value) updates.expiry_date = $("editExpiryDate").value;
  if (v("editProductImage")) updates.product_image = v("editProductImage");
  if (v("editLogoUrl")) updates.logo_url = v("editLogoUrl");
  if (v("editDescription")) updates.description = v("editDescription");

  if (Object.keys(updates).length === 0) return alert("Aucun champ à modifier.");
  if (!confirm(`Confirmer la mise à jour du lot "${loadedLot}" ?`)) return;

  $("updateBatchBtn").disabled = true;
  $("updateBatchBtn").textContent = "MISE À JOUR...";

  const { error } = await sb.from("qr_codes").update(updates).eq("lot", loadedLot);

  $("updateBatchBtn").disabled = false;
  $("updateBatchBtn").textContent = "METTRE À JOUR LE LOT";

  if (error) {
    info.className = "result danger";
    info.innerHTML = `<p>Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }

  info.className = "result success";
  info.innerHTML = `<h2>✓ LOT MIS À JOUR</h2><p>Tous les codes du lot "${escapeHtml(loadedLot)}" ont été modifiés.</p>`;
  loadStats();

  if (updates.brand) loadedLotBrand = updates.brand;
  if (updates.logo_url) loadedLotLogo = updates.logo_url;
  if (updates.lot) {
    loadedLot = updates.lot;
    loadedLotLot = updates.lot;
    $("editLotSearch").value = updates.lot;
    $("editNewLot").value = "";
  }
};

// ============================================================
// PRINT — 2 modes : labels ou liste
// ============================================================
function printLabels(codes, brand, lot, logoUrl) {
  if (!codes || !codes.length) return alert("Aucun code à imprimer.");

  const mode = ($("printMode") && $("printMode").value) || "labels";
  const url = location.origin + "/";
  const w = window.open("", "_blank");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

  // ---------- MODE LISTE ----------
  if (mode === "list") {
    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Liste des codes</title>
    <style>
      @page { margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 15px; margin: 0; color: #111; }
      .toolbar { background: #111; color: #fff; padding: 12px; text-align: center; margin-bottom: 20px; border-radius: 8px; position: sticky; top: 0; z-index: 100; }
      .toolbar button { background: #fff; color: #111; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
      .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #111; }
      .header h1 { margin: 0 0 6px; font-size: 22px; }
      .header p { margin: 4px 0; font-size: 13px; color: #555; }
      .meta { display: flex; justify-content: center; gap: 20px; font-size: 13px; margin-top: 10px; }
      .meta b { color: #111; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
      th { background: #111; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
      td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .num { color: #6b7280; width: 45px; font-weight: bold; }
      .code-cell { font-family: 'Courier New', monospace; font-weight: bold; font-size: 15px; letter-spacing: 2px; color: #111; }
      .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #888; }
      @media print {
        .toolbar { display: none !important; }
        body { padding: 0; }
      }
    </style></head><body>

    <div class="toolbar">
      <button onclick="window.print()">🖨 IMPRIMER</button>
    </div>

    <div class="header">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:50px;margin-bottom:10px">` : ""}
      <h1>${escapeHtml(brand)}</h1>
      <p><b>Liste des codes de sécurité</b></p>
      <div class="meta">
        ${lot ? `<span><b>Lot :</b> ${escapeHtml(lot)}</span>` : ""}
        <span><b>Total :</b> ${codes.length} code(s)</span>
      </div>
      <p style="font-size:11px;color:#888;margin-top:10px">Document confidentiel — À conserver en lieu sûr</p>
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Code de sécurité</th>
        </tr>
      </thead>
      <tbody>`;

    codes.forEach((code, i) => {
      const formatted = code.match(/.{1,4}/g).join(" ");
      html += `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="code-cell">${formatted}</td>
        </tr>`;
    });

    html += `
      </tbody>
    </table>

    <div class="footer">
      Produit dz ORG — ${new Date().toLocaleString()}
    </div>

    </body></html>`;
    w.document.write(html);
    w.document.close();
    return;
  }

  // ---------- MODE LABELS ----------
  const size = $("labelSize").value || "60x90";

  let labelWidth, labelHeight, qrSize, codeFontSize, brandFontSize;
  if (size === "50x50") {
    labelWidth = "50mm"; labelHeight = "50mm"; qrSize = "22mm";
    codeFontSize = "9px"; brandFontSize = "8px";
  } else if (size === "70x50") {
    labelWidth = "70mm"; labelHeight = "50mm"; qrSize = "28mm";
    codeFontSize = "11px"; brandFontSize = "10px";
  } else {
    labelWidth = "60mm"; labelHeight = "90mm"; qrSize = "34mm";
    codeFontSize = "13px"; brandFontSize = "11px";
  }

  let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>Impression QR + Codes</title>
  <style>
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 10px; margin: 0; background: #f5f5f5; }
    .toolbar { background: #111; color: #fff; padding: 12px; text-align: center; margin-bottom: 15px; position: sticky; top: 0; z-index: 100; border-radius: 8px; }
    .toolbar button { background: #fff; color: #111; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
    .info { font-size: 12px; color: #333; margin: 15px 0; padding: 14px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; line-height: 1.6; }
    .info b { color: #b26a00; }
    .sheet { display: flex; flex-wrap: wrap; gap: 4mm; background: #fff; padding: 10px; border-radius: 8px; }
    .label {
      width: ${labelWidth}; height: ${labelHeight};
      border: 1px dashed #bbb;
      display: flex; flex-direction: column;
      page-break-inside: avoid;
      background: #fff;
      position: relative;
      border-radius: 3mm;
      overflow: hidden;
    }
    .label-top {
      flex: 1;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 3mm; text-align: center;
    }
    .label-logo { max-height: 8mm; max-width: 40mm; margin-bottom: 1.5mm; object-fit: contain; }
    .label-brand { font-size: ${brandFontSize}; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #000; margin-bottom: 2mm; }
    .label-qr { width: ${qrSize}; height: ${qrSize}; display: block; }
    .label-inst { font-size: 7px; color: #666; margin-top: 2mm; line-height: 1.4; }
    .label-fold {
      height: 6mm;
      display: flex; align-items: center; justify-content: center;
      font-size: 6px; color: #888;
      border-top: 1px dashed #666;
      border-bottom: 1px dashed #666;
      background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 3px, #e8e8e8 3px, #e8e8e8 6px);
      letter-spacing: 0.5px;
      font-family: monospace;
    }
    .label-bottom {
      height: 28mm;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 2mm; text-align: center;
      background: #fff;
    }
    .label-code-title { font-size: 6.5px; color: #888; letter-spacing: 1.5px; margin-bottom: 1.5mm; text-transform: uppercase; }
    .label-code {
      font-family: 'Courier New', monospace;
      font-size: ${codeFontSize}; font-weight: bold; letter-spacing: 1.5px;
      color: #000;
      padding: 1.5mm 3mm;
      border: 1px solid #ddd;
      border-radius: 2mm;
      background: #fafafa;
    }
    .label-hint { font-size: 5.5px; color: #999; margin-top: 1.5mm; font-style: italic; }
    .label-lot { position: absolute; top: 2mm; right: 2mm; font-size: 6px; color: #aaa; font-family: monospace; }
    @media print {
      .toolbar, .info { display: none !important; }
      body { padding: 0; background: #fff; }
      .sheet { padding: 0; gap: 2mm; background: #fff; }
    }
  </style></head><body>

  <div class="toolbar">
    <button onclick="window.print()">🖨 IMPRIMER</button>
  </div>

  <div class="info">
    <b>📋 MODE D'EMPLOI :</b><br>
    1. Imprimez sur papier autocollant A4.<br>
    2. Découpez chaque étiquette.<br>
    3. <b>Pliez le long de la ligne pointillée centrale.</b><br>
    4. Le <b>code de sécurité se retrouve caché à l'intérieur.</b><br>
    5. Collez les bords pour sceller.<br>
    6. Le client scanne le QR (visible) puis <b>déchire ou déplie</b> pour révéler le code.
  </div>

  <div class="sheet">`;

  codes.forEach((code) => {
    const formatted = code.match(/.{1,4}/g).join(" ");
    html += `
      <div class="label">
        ${lot ? `<div class="label-lot">LOT ${escapeHtml(lot)}</div>` : ""}
        <div class="label-top">
          ${logoUrl ? `<img class="label-logo" src="${escapeHtml(logoUrl)}" alt="Logo">` : ""}
          <div class="label-brand">${escapeHtml(brand)}</div>
          <img class="label-qr" src="${qrUrl}" alt="QR">
          <div class="label-inst">Scannez ce QR code<br>puis entrez le code de sécurité</div>
        </div>
        <div class="label-fold">✂ - - - - - - PLIEZ ICI - - - - - - ✂</div>
        <div class="label-bottom">
          <div class="label-code-title">Code de sécurité</div>
          <div class="label-code">${formatted}</div>
          <div class="label-hint">Ne pas révéler avant l'achat</div>
        </div>
      </div>`;
  });

  html += `</div></body></html>`;
  w.document.write(html);
  w.document.close();
}

$("printBtn").onclick = () => {
  const brand = $("brand").value.trim() || "MARQUE";
  const lot = $("lot").value.trim() || "";
  printLabels(lastCodes, brand, lot, lastLogo);
};

$("printLotBtn").onclick = () => {
  if (!loadedLotCodes.length) return alert("Aucun lot chargé.");
  printLabels(loadedLotCodes, loadedLotBrand, loadedLotLot, loadedLotLogo);
};
