const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let lastCodes = [];

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

async function refresh() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    $("login").classList.add("hidden");
    $("panel").classList.remove("hidden");
    const url = location.origin + "/";
    $("publicUrl").textContent = url;
    $("qr").innerHTML = "";
    new QRCode($("qr"), { text: url, width: 180, height: 180 });
    loadStats();
  }
}
refresh();

$("loginBtn").onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value,
    password: $("password").value
  });
  if (error) return alert(error.message);
  refresh();
};

$("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

$("createBtn").onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const qty = Math.min(10000, Math.max(1, Number($("quantity").value) || 1));
  const rows = [];
  lastCodes = [];

  for (let i = 0; i < qty; i++) {
    const code = randomCode();
    lastCodes.push(code);
    rows.push({
      secret_code: code,
      secret_status: "UNUSED",
      brand: $("brand").value.trim(),
      product_name: $("product_name").value.trim(),
      reference: $("reference").value.trim() || null,
      lot: $("lot").value.trim() || null,
      manufacture_date: $("manufacture_date").value || null,
      expiry_date: $("expiry_date").value || null,
      product_image: $("product_image").value.trim() || null,
      description: $("description").value.trim() || null
    });
  }

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
    $("printBtn").disabled = false;
    loadStats();
  } catch (err) {
    $("adminResult").className = "result danger";
    $("adminResult").innerHTML = `<p>Erreur : ${err.message}</p>`;
  }
};

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
// PRINT : Labels avec zone à gratter (pliage)
// ============================================================
$("printBtn").onclick = () => {
  if (!lastCodes.length) return alert("Créez d'abord un lot.");

  const url = location.origin + "/";
  const brand = $("brand").value.trim() || "MARQUE";
  const lot = $("lot").value.trim() || "";
  const w = window.open("", "_blank");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;

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
      width: 60mm; height: 90mm;
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
    .label-brand { font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #000; margin-bottom: 2mm; }
    .label-qr { width: 34mm; height: 34mm; display: block; }
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
      font-size: 13px; font-weight: bold; letter-spacing: 1.5px;
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

  lastCodes.forEach((code) => {
    const formatted = code.match(/.{1,4}/g).join(" ");
    html += `
      <div class="label">
        ${lot ? `<div class="label-lot">LOT ${escapeHtml(lot)}</div>` : ""}
        <div class="label-top">
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
};
