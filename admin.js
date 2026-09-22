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

$("printBtn").onclick = () => {
  if (!lastCodes.length) return alert("Créez d'abord un lot.");
  const url = location.origin + "/";
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>QR Codes</title><style>
  body{font-family:Arial}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .sticker{border:1px solid #ccc;border-radius:10px;padding:10px;text-align:center;page-break-inside:avoid}
  .qr{margin:auto;width:130px;height:130px}.code{font-size:18px;font-weight:bold;letter-spacing:3px;margin:8px}
  @media print{button{display:none}}
  </style></head><body><button onclick="print()">PRINT</button><div class="sheet">`);
  lastCodes.forEach((c, i) => {
    w.document.write(
      `<div class="sticker"><div class="qr" id="q${i}"></div><div class="code">${c}</div><small>Scratch & verify</small></div>`
    );
  });
  w.document.write(
    `</div><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script><script>
    const u=${JSON.stringify(url)};
    ${lastCodes.map((_, i) => `new QRCode(document.getElementById("q${i}"),{text:u,width:130,height:130});`).join("")}
    <\/script></body></html>`
  );
  w.document.close();
};
