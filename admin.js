const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let lastCodes = [];

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const a = new Uint32Array(12);
  crypto.getRandomValues(a);
  for (let i = 0; i < 12; i++) s += chars[a[i] % chars.length];
  return s;
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
  } catch (err) {
    $("adminResult").className = "result danger";
    $("adminResult").innerHTML = `<p>Erreur : ${err.message}</p>`;
  }
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
