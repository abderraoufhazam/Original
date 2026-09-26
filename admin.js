// ============================================================
// 🔔 TOAST NOTIFICATION SYSTEM
// ============================================================
function toast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    // Fallback إذا لم يوجد container
    console.log(`[${type}] ${message}`);
    return;
  }
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${String(message).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(-20px)";
    t.style.transition = "all 300ms ease";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// Auto-detect type from message content
function detectToastType(msg) {
  if (!msg || typeof msg !== "string") return "info";
  const lower = msg.toLowerCase();

  if (msg.startsWith("✅") || msg.startsWith("✓") || lower.includes("succès") ||
      lower.includes("réussi") || lower.includes("activer") || lower.includes("activé") ||
      lower.includes("enregistr") || lower.includes("supprim") && !lower.includes("erreur")) {
    return "success";
  }
  if (msg.startsWith("❌") || msg.startsWith("⛔") || msg.startsWith("⚠️") ||
      lower.includes("erreur") || lower.includes("impossible") ||
      lower.includes("échoué") || lower.includes("incorrect")) {
    return "error";
  }
  return "info";
}

// Override window.alert with toast
const _originalAlert = window.alert;
window.alert = function(message) {
  // احتفظ بالـ alert الأصلي في حال احتجت له
  if (window.__useOriginalAlert) {
    return _originalAlert.call(window, message);
  }
  toast(message, detectToastType(message));
};

window.toast = toast;
const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 🔒 قائمة الأدمن
// ============================================================
const ADMIN_EMAILS = [
  "mepirf@gmail.com",
  "abderraoufhazam@gmail.com"
];

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(email.toLowerCase().trim());
}

const $ = id => document.getElementById(id);
let lastCodes = [];
let lastLogo = "";
let loadedLot = null;
let loadedLotCodes = [];
let loadedLotBrand = "";
let loadedLotLot = "";
let loadedLotLogo = "";
let currentFeedbackFilter = "all";
let currentMessagesFilter = "all";
let currentVisitorFilter = "all";
let currentFakesFilter = "all";
let unreadMessagesCount = 0;
let unreadFakesCount = 0;

let chartDaily = null;
let chartResults = null;
let chartTopLots = null;

let pendingDeleteLot = null;
let pendingDeleteCount = 0;

let editingFaqId = null;

// Orders/Inventory state
let currentOrderItems = [];
let currentOrderId = null;
let allBrandsCache = [];
let debtsData = [];
let inventoryData = null;

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function formatMoney(amount) {
  const num = parseFloat(amount || 0);
  return num.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " DA";
}

// ============================================================
// NAVIGATION
// ============================================================
const PANEL_TITLES = {
  dashboard: "Tableau de bord",
  create: "Créer un lot",
  search: "Rechercher un code",
  "adv-search": "Recherche avancée",
  manage: "Gérer un lot",
  orders: "Commandes",
  debts: "Dettes",
  inventory: "Stock",
  log: "Journal",
  feedback: "Avis clients",
  messages: "Messages",
  brands: "Marques",
  visitors: "Visiteurs",
  fakes: "Contrefaçons",
  faq: "FAQ",
  delete: "Suppression",
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
  const sb1 = $("sidebar"); if (sb1) sb1.classList.remove("open");
  const ov = $("overlay"); if (ov) ov.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "delete") loadDeleteLog();
  if (name === "messages") loadMessages();
  if (name === "brands") loadBrands();
  if (name === "visitors") loadVisitors();
  if (name === "adv-search") loadAdvancedSearch();
  if (name === "faq") loadFAQ();
  if (name === "fakes") loadFakes();
  if (name === "orders") loadOrders();
  if (name === "debts") loadDebts();
  if (name === "inventory") loadInventory();
}

document.querySelectorAll(".sidebar-nav button").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});

const _mt = $("menuToggle");
if (_mt) _mt.addEventListener("click", () => {
  const s = $("sidebar"); const o = $("overlay");
  if (s) s.classList.toggle("open");
  if (o) o.classList.toggle("show");
});

const _ov = $("overlay");
if (_ov) _ov.addEventListener("click", () => {
  const s = $("sidebar"); const o = $("overlay");
  if (s) s.classList.remove("open");
  if (o) o.classList.remove("show");
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
        ${stars ? `<div style="margin:6px 0">${stars} <span style="font-weight:700;color:inherit;margin-left:6px">${r.rating}/5</span></div>` : ""}
        ${r.comment ? `<div style="font-size:13px;color:inherit;line-height:1.6;margin:8px 0;padding:10px 12px;background:rgba(255,255,255,0.5);border-radius:10px;border:1px solid rgba(0,0,0,0.05)">${escapeHtml(r.comment)}</div>` : ""}
        <div class="log-meta">
          ${r.secret_code ? `<span style="font-family:monospace;font-weight:700">🔑 ${escapeHtml(r.secret_code)}</span>` : ""}
          ${r.ip ? `<span>🌐 ${escapeHtml(r.ip)}</span>` : ""}
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

// ============================================================
// MESSAGES
// ============================================================
async function loadMessagesBadge() {
  try {
    const { count } = await sb
      .from("brand_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "NEW");

    unreadMessagesCount = count || 0;
    const badge = $("messagesBadge");
    if (badge) {
      if (unreadMessagesCount > 0) {
        badge.textContent = unreadMessagesCount;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    console.warn("loadMessagesBadge:", e);
  }
}

async function loadMessages() {
  const container = $("messagesList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  let query = sb
    .from("brand_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (currentMessagesFilter !== "all") {
    query = query.eq("status", currentMessagesFilter);
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucun message pour le moment.</p>`;
    return;
  }

  let html = "";
  data.forEach(m => {
    const isNew = m.status === "NEW";
    const statusClass = isNew ? "danger" : "success";
    const date = m.created_at ? new Date(m.created_at).toLocaleString() : "—";

    html += `
      <div class="log-row log-${statusClass}" style="padding:18px">
        <div class="log-top">
          <span class="log-result log-result-${statusClass}">
            ${isNew ? "🔴 NOUVEAU" : "✓ LU"}
          </span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>

        <div style="font-weight:800;font-size:14px;color:inherit;margin:8px 0 4px">
          ${escapeHtml(m.brand_name || "—")}
        </div>

        <div style="font-size:11px;color:#64748b;margin-bottom:10px">
          📧 ${escapeHtml(m.email || "—")}
          ${m.phone ? ` &nbsp;|&nbsp; 📱 ${escapeHtml(m.phone)}` : ""}
        </div>

        <div style="font-size:13px;font-weight:700;color:inherit;margin-bottom:6px">
          📌 ${escapeHtml(m.subject || "(sans sujet)")}
        </div>

        <div style="font-size:13px;color:inherit;line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.5);border-radius:10px;border:1px solid rgba(0,0,0,0.05);margin-bottom:12px">
          ${escapeHtml(m.message || "")}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isNew ? `<button onclick="markMessageRead(${m.id})" style="flex:1;padding:8px 12px;background:#16a34a;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:120px">✓ Marquer lu</button>` : ""}
          ${m.phone ? `<a href="https://wa.me/${encodeURIComponent(m.phone.replace(/[^0-9]/g,''))}?text=${encodeURIComponent('Bonjour ' + (m.brand_name || '') + ', merci pour votre message. ')}" target="_blank" rel="noopener" style="flex:1;padding:8px 12px;background:#25D366;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;text-align:center;margin:0;min-width:120px;display:inline-flex;align-items:center;justify-content:center;gap:4px">💬 WhatsApp</a>` : ""}
          <a href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}" style="flex:1;padding:8px 12px;background:#0f172a;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;text-align:center;margin:0;min-width:120px;display:inline-flex;align-items:center;justify-content:center;gap:4px">📧 Email</a>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

window.markMessageRead = async function(id) {
  const { error } = await sb
    .from("brand_messages")
    .update({ status: "READ" })
    .eq("id", id);

  if (error) {
    alert("Erreur : " + error.message);
    return;
  }

  loadMessages();
  loadMessagesBadge();
};

const _rmb = $("refreshMessagesBtn");
if (_rmb) {
  _rmb.onclick = () => {
    loadMessages();
    loadMessagesBadge();
  };
}

document.querySelectorAll("#messagesTabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll("#messagesTabs .tab").forEach(x => {
      x.classList.remove("active");
      x.style.background = "#fff";
      x.style.color = "#0f172a";
      x.style.border = "1px solid #e2e8f0";
    });
    t.classList.add("active");
    t.style.background = "#0f172a";
    t.style.color = "#fff";
    t.style.border = "0";
    currentMessagesFilter = t.dataset.tab;
    loadMessages();
  });
});
// ============================================================
// BRANDS
// ============================================================
async function loadBrands() {
  const container = $("brandsList");
  const statsBox = $("brandsStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    container.innerHTML = `<p class="muted">Non connecté.</p>`;
    return;
  }

  try {
    const res = await fetch("/api/orders?action=list-brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ access_token: session.access_token })
    });

    const data = await res.json();

    if (data.status !== "OK") {
      container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(data.message || "")}</p>`;
      return;
    }

    const brands = data.brands || [];
    const registeredCount = brands.filter(b => b.is_registered).length;
    const unregisteredCount = brands.filter(b => !b.is_registered).length;
    const withCodesCount = brands.filter(b => (b.codes_count || 0) > 0).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num">${brands.length}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">${registeredCount}</div><div class="stat-label">✅ INSCRITES</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#eab308">${unregisteredCount}</div><div class="stat-label">⚠️ NON INSCRITES</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#2563eb">${withCodesCount}</div><div class="stat-label">📦 AVEC CODES</div></div>
      `;
    }

    if (brands.length === 0) {
      container.innerHTML = `<p class="muted">Aucune marque pour le moment.</p>`;
      return;
    }

    allBrandsCache = brands;
    window.__allBrands = brands;

    const dl = $("brandsList");
    if (dl) {
      dl.innerHTML = brands.map(b => `<option value="${escapeHtml(b.brand_name)}">`).join("");
    }

    let html = "";
    brands.forEach(b => {
      const tierColors = { 'VIP': '#7c3aed', 'GOLD': '#eab308', 'SILVER': '#94a3b8', 'REGULAR': '#64748b' };
      const tierIcons = { 'VIP': '💎', 'GOLD': '🥇', 'SILVER': '🥈', 'REGULAR': '👤' };
      const tier = b.tier || 'REGULAR';

      html += `
        <div class="log-row log-${b.is_registered ? "success" : "warning"}" style="padding:16px">
          <div class="log-top">
            <span class="log-result log-result-${b.is_registered ? "success" : "warning"}">
              ${b.is_registered ? "✅ INSCRITE" : "⚠️ NON INSCRITE"}
            </span>
            <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:6px;background:${tierColors[tier]}20;color:${tierColors[tier]}">${tierIcons[tier]} ${tier}</span>
          </div>

          <div style="font-weight:800;font-size:16px;color:inherit;margin:10px 0 6px">
            🏢 ${escapeHtml(b.brand_name)}
          </div>

          <div class="log-meta" style="margin-bottom:10px">
            ${b.email ? `<span>📧 ${escapeHtml(b.email)}</span>` : ""}
            ${b.phone ? `<span>📱 ${escapeHtml(b.phone)}</span>` : ""}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
              <div style="font-size:18px;font-weight:900;color:inherit">${b.codes_count || 0}</div>
              <div style="font-size:9px;color:#64748b;font-weight:800;letter-spacing:0.5px">CODES</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
              <div style="font-size:18px;font-weight:900;color:inherit">${b.total_orders || 0}</div>
              <div style="font-size:9px;color:#64748b;font-weight:800;letter-spacing:0.5px">COMMANDES</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
              <div style="font-size:14px;font-weight:900;color:#16a34a">${formatMoney(b.total_spent || 0)}</div>
              <div style="font-size:9px;color:#64748b;font-weight:800;letter-spacing:0.5px">DÉPENSÉ</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="view-brand-details" data-brand-name="${escapeHtml(b.brand_name)}" style="flex:1;padding:8px 12px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">👁 Voir détails</button>
            ${b.phone ? `<a href="https://wa.me/${encodeURIComponent(b.phone.replace(/[^0-9]/g,''))}?text=${encodeURIComponent('Bonjour ' + (b.brand_name || '') + ' 👋')}" target="_blank" rel="noopener" style="flex:1;padding:8px 12px;background:#25D366;color:#fff;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;text-align:center;min-width:110px;display:inline-flex;align-items:center;justify-content:center;gap:4px">💬 WhatsApp</a>` : ""}
          </div>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".view-brand-details").forEach(btn => {
      btn.onclick = () => {
        const brandName = btn.dataset.brandName;
        if (typeof window.openBrandDetails === "function") {
          window.openBrandDetails(brandName);
        }
      };
    });

  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

const _rbb = $("refreshBrandsBtn");
if (_rbb) _rbb.onclick = () => loadBrands();

// ============================================================
// VISITORS
// ============================================================
async function loadVisitors() {
  const container = $("visitorsList");
  const statsBox = $("visitorStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  try {
    const counts = {};
    for (const st of ["real", "suspicious", "bot", "good-bot"]) {
      const { count } = await sb.from("visitor_logs").select("*", { count: "exact", head: true }).eq("status", st);
      counts[st] = count || 0;
    }

    const total = counts.real + counts.suspicious + counts.bot + counts["good-bot"];

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">${counts.real}</div><div class="stat-label">🟢 RÉELS</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#eab308">${counts.suspicious}</div><div class="stat-label">🟡 SUSPECTS</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626">${counts.bot}</div><div class="stat-label">🔴 BOTS</div></div>
      `;
    }

    let query = sb.from("visitor_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (currentVisitorFilter !== "all") query = query.eq("status", currentVisitorFilter);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      container.innerHTML = `<p class="muted">Aucune visite enregistrée.</p>`;
      return;
    }

    let html = "";
    data.forEach(v => {
      const statusColors = { "real": "success", "good-bot": "success", "suspicious": "warning", "bot": "danger" };
      const statusLabels = { "real": "🟢 RÉEL", "good-bot": "🤖 GOOGLE/BING", "suspicious": "🟡 SUSPECT", "bot": "🔴 BOT" };
      const statusClass = statusColors[v.status] || "warning";
      const label = statusLabels[v.status] || v.status;
      const date = v.created_at ? new Date(v.created_at).toLocaleString() : "—";
      const ua = (v.user_agent || "").slice(0, 80);

      html += `
        <div class="log-row log-${statusClass}" style="padding:16px">
          <div class="log-top">
            <span class="log-result log-result-${statusClass}">${label}</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          <div style="font-family:monospace;font-size:12px;color:inherit;margin:8px 0">
            <b>IP:</b> ${escapeHtml(v.ip || "—")}
            ${v.country ? ` | <b>Pays:</b> ${escapeHtml(v.country)}` : ""}
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;word-break:break-all">${escapeHtml(v.path || "/")}</div>
          <div style="font-size:10px;color:#94a3b8;font-family:monospace;margin-bottom:8px;word-break:break-all">${escapeHtml(ua)}</div>
          ${v.reason ? `<div style="font-size:10px;color:#dc2626;margin-bottom:6px">Raison: ${escapeHtml(v.reason)}</div>` : ""}
          <div style="font-size:11px;color:inherit"><b>Bot Score:</b> ${v.bot_score || 0}/100</div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

const _rvb = $("refreshVisitorsBtn");
if (_rvb) _rvb.onclick = () => loadVisitors();

document.querySelectorAll("#visitorTabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll("#visitorTabs .tab").forEach(x => {
      x.classList.remove("active");
      x.style.background = "#fff";
      x.style.color = "#0f172a";
      x.style.border = "1px solid #e2e8f0";
    });
    t.classList.add("active");
    t.style.background = "#0f172a";
    t.style.color = "#fff";
    t.style.border = "0";
    currentVisitorFilter = t.dataset.tab;
    loadVisitors();
  });
});

// ============================================================
// FAKES (Contrefaçons)
// ============================================================
const WILAYA_NAMES = [
  "01 - أدرار","02 - الشلف","03 - الأغواط","04 - أم البواقي","05 - باتنة",
  "06 - بجاية","07 - بسكرة","08 - بشار","09 - البليدة","10 - البويرة",
  "11 - تمنراست","12 - تبسة","13 - تلمسان","14 - تيارت","15 - تيزي وزو",
  "16 - الجزائر","17 - الجلفة","18 - جيجل","19 - سطيف","20 - سعيدة",
  "21 - سكيكدة","22 - سيدي بلعباس","23 - عنابة","24 - قالمة","25 - قسنطينة",
  "26 - المدية","27 - مستغانم","28 - المسيلة","29 - معسكر","30 - ورقلة",
  "31 - وهران","32 - البيض","33 - إليزي","34 - برج بوعريريج","35 - بومرداس",
  "36 - الطارف","37 - تندوف","38 - تيسمسيلت","39 - الوادي","40 - خنشلة",
  "41 - سوق أهراس","42 - تيبازة","43 - ميلة","44 - عين الدفلى","45 - النعامة",
  "46 - عين تموشنت","47 - غرداية","48 - غليزان","49 - تيميمون","50 - برج باجي مختار",
  "51 - أولاد جلال","52 - بني عباس","53 - عين صالح","54 - عين قزام","55 - تقرت",
  "56 - جانت","57 - المغير","58 - المنيعة"
];

let fakesData = [];

async function loadFakesBadge() {
  try {
    const { count } = await sb.from("fake_reports").select("*", { count: "exact", head: true }).eq("status", "NEW");
    unreadFakesCount = count || 0;
    const badge = $("fakesBadge");
    if (badge) {
      if (unreadFakesCount > 0) {
        badge.textContent = unreadFakesCount;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    console.warn("loadFakesBadge:", e);
  }
}

async function loadFakes() {
  const container = $("fakesList");
  const statsBox = $("fakesStats");
  const heatmapBox = $("wilayaHeatmap");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";
  if (heatmapBox) heatmapBox.innerHTML = "";

  try {
    let query = sb.from("fake_reports").select("*").order("created_at", { ascending: false }).limit(500);
    if (currentFakesFilter !== "all") query = query.eq("status", currentFakesFilter);

    const { data, error } = await query;
    if (error) {
      container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`;
      return;
    }

    const { data: allData } = await sb.from("fake_reports").select("wilaya, status, ai_analyzed").limit(5000);

    const total = (allData || []).length;
    const newCount = (allData || []).filter(r => r.status === "NEW").length;
    const reviewedCount = (allData || []).filter(r => r.status === "REVIEWED").length;
    const aiCount = (allData || []).filter(r => r.ai_analyzed).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626">${newCount}</div><div class="stat-label">🔴 NOUVEAUX</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">${reviewedCount}</div><div class="stat-label">✓ TRAITÉS</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${aiCount}</div><div class="stat-label">🤖 ANALYSÉS IA</div></div>
      `;
    }

    const wilayaCounts = {};
    (allData || []).forEach(r => {
      if (r.wilaya) wilayaCounts[r.wilaya] = (wilayaCounts[r.wilaya] || 0) + 1;
    });

    const maxCount = Math.max(1, ...Object.values(wilayaCounts));

    if (heatmapBox) {
      let heatHtml = "";
      WILAYA_NAMES.forEach(w => {
        const c = wilayaCounts[w] || 0;
        let bg, color;
        if (c === 0) { bg = "rgba(148, 163, 184, 0.08)"; color = "#94a3b8"; }
        else {
          const intensity = c / maxCount;
          if (intensity > 0.7) { bg = "linear-gradient(135deg, #dc2626, #ef4444)"; color = "#fff"; }
          else if (intensity > 0.4) { bg = "linear-gradient(135deg, #f59e0b, #fbbf24)"; color = "#fff"; }
          else if (intensity > 0.15) { bg = "linear-gradient(135deg, #fbbf24, #fde047)"; color = "#78350f"; }
          else { bg = "linear-gradient(135deg, #fef3c7, #fef9c3)"; color = "#a16207"; }
        }
        heatHtml += `
          <div style="padding:10px 12px;border-radius:10px;background:${bg};color:${color};text-align:center;font-weight:700;font-size:12px;border:1px solid rgba(0,0,0,0.06)">
            <div>${escapeHtml(w)}</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px">${c}</div>
          </div>`;
      });
      heatmapBox.innerHTML = heatHtml;
    }

    if (!data || data.length === 0) {
      container.innerHTML = `<p class="muted">Aucun signalement.</p>`;
      return;
    }

    let html = "";
    data.forEach(r => {
      const isNew = r.status === "NEW";
      const statusClass = isNew ? "danger" : "success";
      const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";

      html += `
        <div class="log-row log-${statusClass}" style="padding:18px">
          <div class="log-top">
            <span class="log-result log-result-${statusClass}">${isNew ? "🔴 NOUVEAU" : "✓ TRAITÉ"}</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          ${r.product_image ? `<img src="${escapeHtml(r.product_image)}" alt="Produit" style="max-width:200px;max-height:200px;display:block;margin:10px auto;border-radius:12px;border:1px solid rgba(0,0,0,0.08)">` : ""}
          ${r.product_brand ? `<div style="font-size:14px;font-weight:800;color:inherit;margin:8px 0 4px">🏷️ ${escapeHtml(r.product_brand)}</div>` : ""}
          ${r.product_name ? `<div style="font-size:13px;font-weight:700;color:inherit;margin-bottom:6px">📦 ${escapeHtml(r.product_name)}</div>` : ""}
          <div class="details" style="margin-top:10px">
            ${r.wilaya ? `<div><b>📍 Wilaya</b><span>${escapeHtml(r.wilaya)}</span></div>` : ""}
            ${r.attempted_code ? `<div><b>Code essayé</b><span style="font-family:monospace">${escapeHtml(r.attempted_code)}</span></div>` : ""}
            ${r.ip ? `<div><b>IP</b><span style="font-family:monospace;font-size:11px">${escapeHtml(r.ip)}</span></div>` : ""}
          </div>
          ${r.comment ? `<div style="font-size:12px;color:inherit;line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.5);border-radius:10px;border:1px solid rgba(0,0,0,0.05);margin-top:10px">💬 ${escapeHtml(r.comment)}</div>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            ${isNew ? `<button onclick="markFakeReviewed(${r.id})" style="flex:1;padding:8px 12px;background:#16a34a;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">✓ Marquer traité</button>` : ""}
            <button onclick="deleteFake(${r.id})" style="flex:1;padding:8px 12px;background:#dc2626;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">🗑️ Supprimer</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

window.markFakeReviewed = async function(id) {
  const { error } = await sb.from("fake_reports").update({ status: "REVIEWED" }).eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  loadFakes();
  loadFakesBadge();
};

window.deleteFake = async function(id) {
  if (!confirm("Confirmer la suppression ?")) return;
  const { error } = await sb.from("fake_reports").delete().eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  loadFakes();
  loadFakesBadge();
};

const _rfb2 = $("refreshFakesBtn");
if (_rfb2) {
  _rfb2.onclick = () => { loadFakes(); loadFakesBadge(); };
}

document.querySelectorAll("#fakesTabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll("#fakesTabs .tab").forEach(x => {
      x.classList.remove("active");
      x.style.background = "#fff";
      x.style.color = "#0f172a";
      x.style.border = "1px solid #e2e8f0";
    });
    t.classList.add("active");
    t.style.background = "#0f172a";
    t.style.color = "#fff";
    t.style.border = "0";
    currentFakesFilter = t.dataset.tab;
    loadFakes();
  });
});

// EXPORT FAKES
const _efk = $("exportFakesBtn");
if (_efk) _efk.onclick = async () => {
  const btn = _efk;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Export...";

  try {
    const { data, error } = await sb.from("fake_reports").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    if (!data || data.length === 0) { alert("Aucun signalement."); return; }

    const rows = data.map(r => ({
      "Date": r.created_at ? new Date(r.created_at).toLocaleString() : "",
      "Wilaya": r.wilaya || "",
      "Marque": r.product_brand || "",
      "Produit": r.product_name || "",
      "Description": r.product_description || "",
      "Code essayé": r.attempted_code || "",
      "Commentaire": r.comment || "",
      "Image": r.product_image || "",
      "IA": r.ai_analyzed ? "Oui" : "Non",
      "Statut": r.status === "NEW" ? "Nouveau" : "Traité",
      "IP": r.ip || ""
    }));

    downloadExcel(rows, "Contrefacons", "Contrefacons");
  } catch (err) {
    alert("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

// ============================================================
// FAQ
// ============================================================
function resetFaqForm() {
  editingFaqId = null;
  ["faqQuestionAr","faqAnswerAr","faqQuestionFr","faqAnswerFr","faqQuestionEn","faqAnswerEn"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  if ($("faqSortOrder")) $("faqSortOrder").value = "0";
  if ($("faqIsActive")) $("faqIsActive").checked = true;
  if ($("faqEditTitle")) $("faqEditTitle").textContent = "Ajouter une question";
}

function openFaqForm(item) {
  if (item) {
    editingFaqId = item.id;
    if ($("faqQuestionAr")) $("faqQuestionAr").value = item.question || "";
    if ($("faqAnswerAr")) $("faqAnswerAr").value = item.answer || "";
    if ($("faqQuestionFr")) $("faqQuestionFr").value = item.question_fr || "";
    if ($("faqAnswerFr")) $("faqAnswerFr").value = item.answer_fr || "";
    if ($("faqQuestionEn")) $("faqQuestionEn").value = item.question_en || "";
    if ($("faqAnswerEn")) $("faqAnswerEn").value = item.answer_en || "";
    if ($("faqSortOrder")) $("faqSortOrder").value = item.sort_order || 0;
    if ($("faqIsActive")) $("faqIsActive").checked = item.is_active !== false;
    if ($("faqEditTitle")) $("faqEditTitle").textContent = "Modifier la question";
  } else {
    resetFaqForm();
  }
  const box = $("faqEditBox");
  if (box) { box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "start" }); }
}

async function loadFAQ() {
  const container = $("faqList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  const { data, error } = await sb.from("faq_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucune question.</p>`;
    return;
  }

  let html = "";
  data.forEach(item => {
    const isActive = item.is_active !== false;
    const statusClass = isActive ? "success" : "warning";
    const label = isActive ? "✓ ACTIF" : "⏸️ DÉSACTIVÉ";

    html += `
      <div class="log-row log-${statusClass}" style="padding:16px">
        <div class="log-top">
          <span class="log-result log-result-${statusClass}">${label}</span>
          <span class="log-date">#${item.sort_order || 0}</span>
        </div>
        <div style="font-weight:800;font-size:14px;color:inherit;margin:8px 0 6px">${escapeHtml(item.question || "(sans titre)")}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.6;margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.5);border-radius:10px;border:1px solid rgba(0,0,0,0.05)">${escapeHtml((item.answer || "").slice(0, 200))}${(item.answer || "").length > 200 ? "..." : ""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="editFaqItem(${item.id})" style="flex:1;padding:8px 12px;background:#2563eb;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">✏️ Modifier</button>
          <button onclick="toggleFaqActive(${item.id}, ${isActive})" style="flex:1;padding:8px 12px;background:${isActive ? "#eab308" : "#16a34a"};color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">${isActive ? "⏸️ Désactiver" : "▶️ Activer"}</button>
          <button onclick="deleteFaqItem(${item.id})" style="flex:1;padding:8px 12px;background:#dc2626;color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;margin:0;min-width:110px">🗑️ Supprimer</button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

window.editFaqItem = async function(id) {
  const { data } = await sb.from("faq_items").select("*").eq("id", id).single();
  if (data) openFaqForm(data);
};

window.toggleFaqActive = async function(id, isActive) {
  const { error } = await sb.from("faq_items").update({ is_active: !isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  loadFAQ();
};

window.deleteFaqItem = async function(id) {
  if (!confirm("Confirmer la suppression ?")) return;
  const { error } = await sb.from("faq_items").delete().eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  loadFAQ();
};

const _afb = $("addFaqBtn");
if (_afb) _afb.onclick = () => openFaqForm(null);

const _cfb = $("cancelFaqBtn");
if (_cfb) _cfb.onclick = () => {
  resetFaqForm();
  const box = $("faqEditBox");
  if (box) box.classList.add("hidden");
};

const _rfaq = $("refreshFaqBtn");
if (_rfaq) _rfaq.onclick = () => loadFAQ();

const _sfb = $("saveFaqBtn");
if (_sfb) _sfb.onclick = async () => {
  const questionAr = ($("faqQuestionAr")?.value || "").trim();
  const answerAr = ($("faqAnswerAr")?.value || "").trim();

  if (!questionAr || questionAr.length < 3) { alert("السؤال بالعربية مطلوب."); return; }
  if (!answerAr || answerAr.length < 5) { alert("الجواب بالعربية مطلوب."); return; }

  const payload = {
    question: questionAr,
    answer: answerAr,
    question_fr: ($("faqQuestionFr")?.value || "").trim() || null,
    answer_fr: ($("faqAnswerFr")?.value || "").trim() || null,
    question_en: ($("faqQuestionEn")?.value || "").trim() || null,
    answer_en: ($("faqAnswerEn")?.value || "").trim() || null,
    sort_order: parseInt($("faqSortOrder")?.value || "0", 10) || 0,
    is_active: $("faqIsActive")?.checked !== false,
    updated_at: new Date().toISOString()
  };

  _sfb.disabled = true;
  _sfb.textContent = "...";

  let error;
  if (editingFaqId) {
    const res = await sb.from("faq_items").update(payload).eq("id", editingFaqId);
    error = res.error;
  } else {
    const res = await sb.from("faq_items").insert(payload);
    error = res.error;
  }

  _sfb.disabled = false;
  _sfb.textContent = "💾 ENREGISTRER";

  if (error) { alert("Erreur : " + error.message); return; }

  resetFaqForm();
  const box = $("faqEditBox");
  if (box) box.classList.add("hidden");
  loadFAQ();
};

// ============================================================
// DELETE LOG
// ============================================================
async function loadDeleteLog() {
  const container = $("deleteLogList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  const { data, error } = await sb.from("qr_delete_logs").select("*").order("deleted_at", { ascending: false }).limit(20);

  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucune suppression enregistrée.</p>`;
    return;
  }

  let html = "";
  data.forEach(r => {
    const date = r.deleted_at ? new Date(r.deleted_at).toLocaleString() : "—";
    html += `
      <div class="log-row log-danger">
        <div class="log-top">
          <span class="log-result log-result-danger">🗑️ SUPPRESSION</span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>
        <div class="log-meta">
          ${r.lot ? `<span>📦 Lot: <b>${escapeHtml(r.lot)}</b></span>` : ""}
          <span>🔢 ${r.count || 0} code(s)</span>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

// ============================================================
// CHARTS
// ============================================================
function getChartColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return { text: isDark ? "#cbd5e1" : "#334155", grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)" };
}

async function loadCharts() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const { data: verifs } = await sb.from("qr_verifications").select("created_at, result").gte("created_at", since.toISOString()).limit(10000);

    const days = [];
    const counts = { total: [] };
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      days.push(d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }));
      counts.total.push(0);
    }

    (verifs || []).forEach(v => {
      const d = new Date(v.created_at);
      d.setHours(0, 0, 0, 0);
      const idx = Math.round((d - since) / (1000 * 60 * 60 * 24));
      if (idx >= 0 && idx < 14) counts.total[idx]++;
    });

    const colors = getChartColors();
    const ctx = document.getElementById("chartDaily");
    if (ctx) {
      if (chartDaily) chartDaily.destroy();
      chartDaily = new Chart(ctx, {
        type: "line",
        data: {
          labels: days,
          datasets: [{ label: "Vérifications", data: counts.total, borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.15)", borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: "#16a34a", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } },
            x: { ticks: { color: colors.text, font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
  } catch (e) { console.warn("chartDaily error:", e); }

  try {
    const { data: allVerifs } = await sb.from("qr_verifications").select("result").limit(10000);
    const distribution = { ORIGINAL: 0, USED: 0, NOT_FOUND: 0 };
    (allVerifs || []).forEach(v => {
      if (distribution[v.result] !== undefined) distribution[v.result]++;
      else distribution.NOT_FOUND++;
    });

    const ctx = document.getElementById("chartResults");
    if (ctx) {
      if (chartResults) chartResults.destroy();
      chartResults = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["✓ Original", "⚠ Déjà utilisé", "✗ Non original"],
          datasets: [{ data: [distribution.ORIGINAL, distribution.USED, distribution.NOT_FOUND], backgroundColor: ["#16a34a", "#eab308", "#dc2626"], borderColor: "#fff", borderWidth: 3, hoverOffset: 8 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "62%",
          plugins: {
            legend: { position: "bottom", labels: { color: getChartColors().text, padding: 14, font: { size: 12, weight: "600" }, usePointStyle: true, pointStyle: "circle" } }
          }
        }
      });
    }
  } catch (e) { console.warn("chartResults error:", e); }

  try {
    const { data: verifs } = await sb.from("qr_verifications").select("lot, result").eq("result", "ORIGINAL").limit(10000);
    const lotCounts = {};
    (verifs || []).forEach(v => { if (v.lot) lotCounts[v.lot] = (lotCounts[v.lot] || 0) + 1; });

    const top = Object.entries(lotCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = top.map(t => t[0] || "—");
    const data = top.map(t => t[1]);

    const ctx = document.getElementById("chartTopLots");
    if (ctx) {
      if (chartTopLots) chartTopLots.destroy();
      if (labels.length === 0) {
        const parent = ctx.parentElement;
        if (parent && !parent.querySelector(".empty-msg")) {
          parent.innerHTML = `<p class="muted empty-msg" style="text-align:center;padding:40px 0">Aucune donnée.</p>`;
        }
        return;
      }
      chartTopLots = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{ label: "Vérifications", data: data, backgroundColor: ["rgba(22,163,74,0.85)", "rgba(59,130,246,0.85)", "rgba(234,179,8,0.85)", "rgba(168,85,247,0.85)", "rgba(236,72,153,0.85)"], borderRadius: 8, borderSkipped: false, barThickness: 40 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { color: getChartColors().text, precision: 0 }, grid: { color: getChartColors().grid } },
            y: { ticks: { color: getChartColors().text, font: { size: 12, weight: "600" } }, grid: { display: false } }
          }
        }
      });
    }
  } catch (e) { console.warn("chartTopLots error:", e); }
}

window.__reloadCharts = loadCharts;

// ============================================================
// ADVANCED SEARCH
// ============================================================
let advSearchData = [];

async function loadAdvancedSearch() {
  const resultsBox = $("advSearchResults");
  const statsBox = $("advSearchStats");
  if (!resultsBox) return;

  const text = ($("advSearchText")?.value || "").trim();
  const status = ($("advSearchStatus")?.value || "").trim();
  const limit = parseInt($("advSearchLimit")?.value || "100", 10);
  const dateFrom = $("advSearchDateFrom")?.value || "";
  const dateTo = $("advSearchDateTo")?.value || "";

  resultsBox.innerHTML = `<p class="muted">Recherche...</p>`;
  if (statsBox) statsBox.style.display = "none";

  try {
    let query = sb.from("qr_codes").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("secret_status", status);
    if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00");
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

    if (text) {
      const safeText = text.replace(/[%,()]/g, "");
      query = query.or(`brand.ilike.%${safeText}%,lot.ilike.%${safeText}%,secret_code.ilike.%${safeText}%,reference.ilike.%${safeText}%,product_name.ilike.%${safeText}%`);
    }

    const { data, error } = await query;

    if (error) { resultsBox.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`; return; }

    advSearchData = data || [];

    if (advSearchData.length === 0) {
      resultsBox.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">Aucun résultat.</p>`;
      return;
    }

    const counts = { PENDING: 0, UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0 };
    advSearchData.forEach(r => { if (counts[r.secret_status] !== undefined) counts[r.secret_status]++; });

    if (statsBox) {
      statsBox.style.display = "grid";
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num">${advSearchData.length}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#a16207">${counts.PENDING}</div><div class="stat-label">PENDING</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">${counts.UNUSED}</div><div class="stat-label">UNUSED</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#2563eb">${counts.USED}</div><div class="stat-label">USED</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626">${counts.DISABLED}</div><div class="stat-label">DISABLED</div></div>
      `;
    }

    let html = "";
    advSearchData.forEach(r => {
      const statusClass = r.secret_status === "UNUSED" ? "success" : r.secret_status === "PENDING" ? "warning" : r.secret_status === "USED" ? "success" : "danger";
      const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";

      html += `
        <div class="log-row log-${statusClass}" style="padding:14px">
          <div class="log-top">
            <span class="log-result log-result-${statusClass}">${escapeHtml(r.secret_status)}</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          <div class="log-code" style="font-size:14px">${escapeHtml(r.secret_code || "—")}</div>
          <div class="log-meta">
            ${r.brand ? `<span>🏷 ${escapeHtml(r.brand)}</span>` : ""}
            ${r.lot ? `<span>📦 ${escapeHtml(r.lot)}</span>` : ""}
            ${r.reference ? `<span>🔖 ${escapeHtml(r.reference)}</span>` : ""}
          </div>
        </div>`;
    });
    resultsBox.innerHTML = html;
  } catch (err) {
    resultsBox.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

const _advBtn = $("advSearchBtn");
if (_advBtn) _advBtn.onclick = () => loadAdvancedSearch();

const _advReset = $("advResetBtn");
if (_advReset) _advReset.onclick = () => {
  ["advSearchText","advSearchStatus","advSearchDateFrom","advSearchDateTo"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("advSearchLimit")) $("advSearchLimit").value = "100";
  const rb = $("advSearchResults"); if (rb) rb.innerHTML = "";
  const sb2 = $("advSearchStats"); if (sb2) sb2.style.display = "none";
  advSearchData = [];
};

const _advExport = $("advExportBtn");
if (_advExport) _advExport.onclick = () => {
  if (!advSearchData || advSearchData.length === 0) { alert("Aucun résultat."); return; }
  const rows = advSearchData.map(r => ({
    "Code": r.secret_code || "",
    "Statut": r.secret_status || "",
    "Marque": r.brand || "",
    "Produit": r.product_name || "",
    "Référence": r.reference || "",
    "Lot": r.lot || "",
    "Créé le": r.created_at ? new Date(r.created_at).toLocaleString() : "",
    "Utilisé le": r.used_at ? new Date(r.used_at).toLocaleString() : ""
  }));
  downloadExcel(rows, "Recherche_Avancee", "Résultats");
};

const _advText = $("advSearchText");
if (_advText) _advText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadAdvancedSearch();
});
// ============================================================
// ORDERS
// ============================================================
async function getAdminToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.access_token : null;
}

async function loadOrders() {
  const container = $("ordersList");
  const statsBox = $("ordersStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  const token = await getAdminToken();
  if (!token) return;

  const search = ($("ordersSearch")?.value || "").trim();
  const status = ($("ordersStatus")?.value || "").trim();
  const payment = ($("ordersPayment")?.value || "").trim();

  try {
    const res = await fetch("/api/orders?action=list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, search, status, payment_status: payment, limit: 200 })
    });

    const data = await res.json();

    if (data.status !== "OK") {
      container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(data.message || "")}</p>`;
      return;
    }

    const orders = data.orders || [];

    if (statsBox) {
      const total = orders.length;
      const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
      const paidCount = orders.filter(o => o.payment_status === "PAID").length;
      const unpaidAmount = orders.filter(o => o.payment_status !== "PAID").reduce((s, o) => s + parseFloat(o.total_price || 0) - parseFloat(o.paid_amount || 0), 0);

      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">${paidCount}</div><div class="stat-label">✅ PAYÉES</div></div>
        <div class="stat-card"><div class="stat-num" style="font-size:16px">${formatMoney(totalRevenue)}</div><div class="stat-label">💰 REVENU</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626;font-size:16px">${formatMoney(unpaidAmount)}</div><div class="stat-label">⚠️ IMPAYÉ</div></div>
      `;
    }

    if (orders.length === 0) {
      container.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">Aucune commande.</p>`;
      return;
    }

    const statusLabels = {
      IN_PRODUCTION: "🟡 En production", READY: "📦 Prête", HANDED_TO_CARRIER: "🟣 Confiée transporteur",
      SHIPPED: "🚚 Expédiée", AWAITING_PICKUP: "🟠 En attente retrait", AWAITING_HANDOVER: "⏳ En attente remise",
      DELIVERED: "✅ Livrée", PAID: "💰 Payée", CANCELLED: "❌ Annulée"
    };
    const paymentLabels = { UNPAID: "❌ Non payé", PARTIAL: "🟡 Partiel", PAID: "✅ Payé" };

    let html = "";
    orders.forEach(o => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";
      const itemsHtml = (o.items || []).map(it => `<span class="order-item-pill">Lot ${escapeHtml(it.lot_number)} × ${it.quantity}</span>`).join("");

      html += `
        <div class="order-card status-${o.order_status}">
          <div class="order-header">
            <div>
              <div class="order-number">${escapeHtml(o.order_number)}</div>
              <div class="order-brand">🏢 ${escapeHtml(o.brand_name)}</div>
            </div>
            <div style="text-align:right">
              <span class="status-pill ${o.order_status}">${statusLabels[o.order_status] || o.order_status}</span>
              <div style="margin-top:6px"><span class="payment-pill ${o.payment_status}">${paymentLabels[o.payment_status] || o.payment_status}</span></div>
            </div>
          </div>
          <div class="order-meta">
            <span>📅 ${escapeHtml(date)}</span>
            ${o.brand_phone ? `<span>📱 ${escapeHtml(o.brand_phone)}</span>` : ""}
            ${o.delivery_method === "hand_to_hand" ? "<span>🤝 Main à main</span>" : "<span>🚚 Livraison</span>"}
          </div>
          ${itemsHtml ? `<div class="order-items-list">${itemsHtml}</div>` : ""}
          <div class="order-total-box">
            <div style="font-size:12px;color:var(--text-muted)">${o.total_quantity} codes</div>
            <div class="order-total-amount">${formatMoney(o.total_price)}</div>
          </div>
          <div class="order-actions">
            <button onclick="openOrderDetails(${o.id})" style="background:#0f172a">👁 Détails</button>
            <button onclick="printOrderInvoice(${o.id})" style="background:linear-gradient(135deg,#16a34a,#22c55e)">🖨 Facture</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

// MODAL: Nouvelle commande
const _nob = $("newOrderBtn");
if (_nob) _nob.onclick = () => openNewOrderModal();

async function openNewOrderModal() {
  const modal = $("newOrderModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  const errBox = $("newOrderError");
  if (errBox) errBox.classList.add("hidden");

  ["orderBrand","orderBrandPhone","orderBrandEmail","orderDeliveryCompany","orderTrackingNumber","orderWilaya","orderBaladiya","orderDeliveryAddress","orderRecipientPhone","orderShippingDate","orderNotes"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  if ($("orderUnitPrice")) $("orderUnitPrice").value = "15";
  if ($("orderDiscount")) $("orderDiscount").value = "0";
  if ($("orderDeliveryCost")) $("orderDeliveryCost").value = "0";
  if ($("orderTva")) $("orderTva").value = "0";
  if ($("brandHint")) $("brandHint").textContent = "";

  const deliveryRadio = document.querySelector('input[name="orderDeliveryMethod"][value="delivery"]');
  if (deliveryRadio) deliveryRadio.checked = true;
  const df = $("deliveryFields");
  if (df) df.style.display = "block";

  currentOrderItems = [{ lot_number: "", quantity: 0 }];
  renderOrderItems();
  updateOrderTotals();
  await loadBrandsForDatalist();
}

async function loadBrandsForDatalist() {
  const token = await getAdminToken();
  if (!token) return;

  try {
    const res = await fetch("/api/orders?action=list-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token })
    });

    const data = await res.json();
    if (data.status !== "OK") return;

    allBrandsCache = data.brands || [];
    window.__allBrands = allBrandsCache;
    const dl = $("brandsList");
    if (dl) dl.innerHTML = allBrandsCache.map(b => `<option value="${escapeHtml(b.brand_name)}">`).join("");
  } catch (e) { console.warn("loadBrandsForDatalist:", e); }
}

const _orderBrandInput = $("orderBrand");
if (_orderBrandInput) {
  _orderBrandInput.addEventListener("input", () => {
    const brandName = $("orderBrand").value.trim();
    const hint = $("brandHint");
    if (!hint) return;
    if (!brandName) { hint.textContent = ""; return; }

    const found = allBrandsCache.find(b => b.brand_name.toLowerCase() === brandName.toLowerCase());

    if (found) {
      if (found.phone && $("orderBrandPhone")) $("orderBrandPhone").value = found.phone;
      if (found.email && $("orderBrandEmail")) $("orderBrandEmail").value = found.email;
      if (found.is_registered) {
        hint.textContent = `✅ Marque inscrite — ${found.codes_count || 0} codes — ${found.tier || 'REGULAR'}`;
        hint.style.color = "#16a34a";
      } else {
        hint.textContent = `⚠️ Marque non inscrite — ${found.codes_count || 0} codes existants`;
        hint.style.color = "#eab308";
      }
    } else {
      hint.textContent = "🆕 Nouvelle marque (sera enregistrée comme contact)";
      hint.style.color = "#64748b";
    }
  });
}

function renderOrderItems() {
  const container = $("orderItemsList");
  if (!container) return;

  if (currentOrderItems.length === 0) {
    container.innerHTML = `<p class="muted" style="font-size:12px;text-align:center;padding:14px 0">Aucun lot.</p>`;
    return;
  }

  let html = "";
  currentOrderItems.forEach((item, idx) => {
    html += `
      <div class="order-item-row">
        <div>
          <input data-item-idx="${idx}" data-field="lot" placeholder="N° de lot" value="${escapeHtml(item.lot_number)}">
          <div class="lot-check-hint" data-hint="${idx}"></div>
        </div>
        <input data-item-idx="${idx}" data-field="qty" type="number" min="1" placeholder="Qté" value="${item.quantity || ''}">
        <button data-remove-idx="${idx}">✕</button>
      </div>
    `;
  });
  container.innerHTML = html;

  container.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.itemIdx, 10);
      const field = e.target.dataset.field;
      if (field === "lot") {
        currentOrderItems[idx].lot_number = e.target.value.trim();
        checkLot(idx);
      } else {
        currentOrderItems[idx].quantity = parseInt(e.target.value, 10) || 0;
      }
      updateOrderTotals();
    });
  });

  container.querySelectorAll("[data-remove-idx]").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.removeIdx, 10);
      currentOrderItems.splice(idx, 1);
      renderOrderItems();
      updateOrderTotals();
    };
  });
}

async function checkLot(idx) {
  const lot = currentOrderItems[idx]?.lot_number;
  const hint = document.querySelector(`[data-hint="${idx}"]`);
  if (!hint) return;

  if (!lot || lot.length < 1) {
    hint.textContent = "";
    hint.className = "lot-check-hint";
    return;
  }

  hint.textContent = "🔍 Vérification...";
  hint.className = "lot-check-hint";

  const token = await getAdminToken();
  if (!token) return;

  try {
    const res = await fetch("/api/orders?action=check-lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, lots: [lot] })
    });

    const data = await res.json();
    const result = data.results?.[0];

    if (!result || !result.exists) {
      hint.textContent = "❌ Lot introuvable";
      hint.className = "lot-check-hint err";
    } else {
      hint.textContent = `✅ ${result.count} codes — ${result.brand || "?"}`;
      hint.className = "lot-check-hint ok";
    }
  } catch (e) {
    hint.textContent = "⚠️ Erreur";
    hint.className = "lot-check-hint warn";
  }
}

const _aoi = $("addOrderItemBtn");
if (_aoi) _aoi.onclick = () => {
  currentOrderItems.push({ lot_number: "", quantity: 0 });
  renderOrderItems();
};

function updateOrderTotals() {
  const totalQty = currentOrderItems.reduce((s, it) => s + (it.quantity || 0), 0);
  const unitPrice = parseFloat($("orderUnitPrice")?.value || 0);
  const discountPct = parseFloat($("orderDiscount")?.value || 0);
  const deliveryCost = parseFloat($("orderDeliveryCost")?.value || 0);
  const tvaPct = parseFloat($("orderTva")?.value || 0);

  const subtotal = unitPrice * totalQty;
  const discountAmt = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const tvaAmt = afterDiscount * (tvaPct / 100);
  const total = afterDiscount + tvaAmt + deliveryCost;

  if ($("orderSubtotal")) $("orderSubtotal").textContent = formatMoney(subtotal);
  if ($("orderDiscountAmt")) $("orderDiscountAmt").textContent = "-" + formatMoney(discountAmt);
  if ($("orderTvaAmt")) $("orderTvaAmt").textContent = formatMoney(tvaAmt);
  if ($("orderDeliveryAmt")) $("orderDeliveryAmt").textContent = formatMoney(deliveryCost);
  if ($("orderTotalPrice")) $("orderTotalPrice").textContent = formatMoney(total);
}

["orderUnitPrice", "orderDiscount", "orderDeliveryCost", "orderTva"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", updateOrderTotals);
});

document.querySelectorAll('input[name="orderDeliveryMethod"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const method = document.querySelector('input[name="orderDeliveryMethod"]:checked')?.value;
    const fields = $("deliveryFields");
    if (fields) fields.style.display = method === "hand_to_hand" ? "none" : "block";
  });
});

const _cnob = $("closeNewOrderBtn");
if (_cnob) _cnob.onclick = () => $("newOrderModal").classList.add("hidden");

const _cancelNob = $("cancelNewOrderBtn");
if (_cancelNob) _cancelNob.onclick = () => $("newOrderModal").classList.add("hidden");

const _cob = $("createOrderBtn");
if (_cob) _cob.onclick = async () => {
  const errBox = $("newOrderError");
  if (errBox) errBox.classList.add("hidden");

  const brandName = $("orderBrand").value.trim();
  const validItems = currentOrderItems.filter(it => it.lot_number && it.quantity > 0);

  if (!brandName) {
    if (errBox) { errBox.innerHTML = "<p style='margin:0'>Nom de marque obligatoire</p>"; errBox.classList.remove("hidden"); }
    return;
  }

  if (validItems.length === 0) {
    if (errBox) { errBox.innerHTML = "<p style='margin:0'>Ajoutez au moins un lot valide</p>"; errBox.classList.remove("hidden"); }
    return;
  }

  const token = await getAdminToken();
  if (!token) return;

  const deliveryMethod = document.querySelector('input[name="orderDeliveryMethod"]:checked')?.value || "delivery";

  const payload = {
    access_token: token,
    brand_name: brandName,
    brand_phone: $("orderBrandPhone").value.trim() || null,
    brand_email: $("orderBrandEmail").value.trim() || null,
    items: validItems.map(it => ({ lot_number: it.lot_number, quantity: it.quantity })),
    unit_price: parseFloat($("orderUnitPrice").value || 0),
    discount_percent: parseFloat($("orderDiscount").value || 0),
    delivery_cost: parseFloat($("orderDeliveryCost").value || 0),
    tva: parseFloat($("orderTva").value || 0),
    delivery_method: deliveryMethod,
    delivery_company: $("orderDeliveryCompany").value.trim() || null,
    tracking_number: $("orderTrackingNumber").value.trim() || null,
    delivery_wilaya: $("orderWilaya").value.trim() || null,
    delivery_baladiya: $("orderBaladiya").value.trim() || null,
    delivery_address: $("orderDeliveryAddress").value.trim() || null,
    recipient_phone: $("orderRecipientPhone").value.trim() || null,
    shipping_date: $("orderShippingDate").value || null,
    notes: $("orderNotes").value.trim() || null
  };

  _cob.disabled = true;
  _cob.textContent = "⏳ Création...";

  try {
    const res = await fetch("/api/orders?action=create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.status === "OK") {
      const found = allBrandsCache.find(b => b.brand_name.toLowerCase() === brandName.toLowerCase());

      if (!found || !found.is_registered) {
        fetch("/api/orders?action=save-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: token,
            brand_name: brandName,
            phone: $("orderBrandPhone").value.trim() || null,
            email: $("orderBrandEmail").value.trim() || null
          })
        }).catch(e => console.warn(e));
      }

      alert(`✅ Commande créée : ${data.order.order_number}`);
      $("newOrderModal").classList.add("hidden");
      loadOrders();
    } else {
      if (errBox) { errBox.innerHTML = `<p style='margin:0'>${escapeHtml(data.message || "Erreur")}</p>`; errBox.classList.remove("hidden"); }
    }
  } catch (e) {
    if (errBox) { errBox.innerHTML = `<p style='margin:0'>Erreur réseau : ${escapeHtml(e.message)}</p>`; errBox.classList.remove("hidden"); }
  } finally {
    _cob.disabled = false;
    _cob.textContent = "✓ Créer la commande";
  }
};

// Détails commande
window.openOrderDetails = async function(orderId) {
  const token = await getAdminToken();
  if (!token) return;

  const modal = $("orderDetailsModal");
  const body = $("orderDetailsBody");
  const footer = $("orderDetailsFooter");
  const title = $("orderDetailsTitle");
  if (!modal) return;

  modal.classList.remove("hidden");
  body.innerHTML = `<p class="muted" style="text-align:center;padding:30px 0">Chargement...</p>`;
  footer.innerHTML = "";

  try {
    const res = await fetch("/api/orders?action=get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, order_id: orderId })
    });

    const data = await res.json();
    if (data.status !== "OK" || !data.order) {
      body.innerHTML = `<p class="muted">Erreur : ${escapeHtml(data.message || "")}</p>`;
      return;
    }

    const o = data.order;
    currentOrderId = orderId;
    title.textContent = `📄 ${o.order_number}`;

    const statusLabels = {
      IN_PRODUCTION: "🟡 En production", READY: "📦 Prête", HANDED_TO_CARRIER: "🟣 Confiée transporteur",
      SHIPPED: "🚚 Expédiée", AWAITING_PICKUP: "🟠 En attente retrait", AWAITING_HANDOVER: "⏳ En attente remise",
      DELIVERED: "✅ Livrée", PAID: "💰 Payée", CANCELLED: "❌ Annulée"
    };
    const statusOptions = Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${o.order_status === k ? "selected" : ""}>${v}</option>`).join("");

    const paymentLabels = { UNPAID: "❌ Non payé", PARTIAL: "🟡 Partiel", PAID: "✅ Payé" };
    const paymentOptions = Object.entries(paymentLabels).map(([k, v]) => `<option value="${k}" ${o.payment_status === k ? "selected" : ""}>${v}</option>`).join("");

    const itemsRows = (o.items || []).map(it => `<tr><td>Lot ${escapeHtml(it.lot_number)}</td><td>${it.quantity}</td></tr>`).join("");

    let html = `
      <div class="detail-row"><span>Marque</span><span>${escapeHtml(o.brand_name)}</span></div>
      ${o.brand_phone ? `<div class="detail-row"><span>Téléphone</span><span>${escapeHtml(o.brand_phone)}</span></div>` : ""}
      ${o.brand_email ? `<div class="detail-row"><span>Email</span><span>${escapeHtml(o.brand_email)}</span></div>` : ""}
      <div class="detail-row"><span>Date</span><span>${o.created_at ? new Date(o.created_at).toLocaleString("fr-FR") : "—"}</span></div>
      <div class="detail-row"><span>Méthode</span><span>${o.delivery_method === "hand_to_hand" ? "🤝 Main à main" : "🚚 Livraison"}</span></div>
      <h3 style="margin:20px 0 8px;font-size:13px;font-weight:900">📦 Articles</h3>
      <table class="detail-items-table"><thead><tr><th>Lot</th><th>Quantité</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <div class="detail-row"><span>Sous-total</span><span>${formatMoney(o.subtotal)}</span></div>
      ${parseFloat(o.discount_amount || 0) > 0 ? `<div class="detail-row"><span>Remise (${o.discount_percent}%)</span><span>-${formatMoney(o.discount_amount)}</span></div>` : ""}
      ${parseFloat(o.delivery_cost || 0) > 0 ? `<div class="detail-row"><span>Livraison</span><span>${formatMoney(o.delivery_cost)}</span></div>` : ""}
      <div class="detail-row"><span style="font-weight:900;color:var(--text)">TOTAL</span><span style="font-weight:900;color:#16a34a;font-size:18px">${formatMoney(o.total_price)}</span></div>
      ${o.delivery_company ? `<div class="detail-row"><span>Transporteur</span><span>${escapeHtml(o.delivery_company)}</span></div>` : ""}
      ${o.tracking_number ? `<div class="detail-row"><span>N° Suivi</span><span style="font-family:monospace">${escapeHtml(o.tracking_number)}</span></div>` : ""}
      ${o.delivery_wilaya ? `<div class="detail-row"><span>Wilaya</span><span>${escapeHtml(o.delivery_wilaya)}</span></div>` : ""}
      ${o.recipient_phone ? `<div class="detail-row"><span>Tel. destinataire</span><span>${escapeHtml(o.recipient_phone)}</span></div>` : ""}
      ${o.notes ? `<div class="detail-row"><span>Notes</span><span>${escapeHtml(o.notes)}</span></div>` : ""}
      <div style="margin-top:22px;padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px">
        <h3 style="margin:0 0 12px;font-size:12px;font-weight:900">⚙️ Modifier</h3>
        <label style="font-size:11px;font-weight:800;color:var(--text-muted);display:block;margin-bottom:6px">STATUT</label>
        <select id="orderUpdateStatus" style="margin-bottom:12px">${statusOptions}</select>
        <label style="font-size:11px;font-weight:800;color:var(--text-muted);display:block;margin-bottom:6px">PAIEMENT</label>
        <select id="orderUpdatePayment" style="margin-bottom:12px">${paymentOptions}</select>
        <label style="font-size:11px;font-weight:800;color:var(--text-muted);display:block;margin-bottom:6px">MONTANT PAYÉ (DA)</label>
        <input id="orderUpdatePaidAmount" type="number" step="0.01" min="0" value="${o.paid_amount || 0}" style="margin-bottom:12px">
        <button id="saveOrderChangesBtn" style="background:linear-gradient(135deg,#16a34a,#22c55e);font-weight:800">💾 ENREGISTRER</button>
      </div>
    `;

    body.innerHTML = html;
    footer.innerHTML = `
      <button id="printInvoiceFromDetails" style="background:linear-gradient(135deg,#0ea5e9,#0284c7)">🖨 Facture</button>
      <button id="deleteOrderBtn" style="background:#dc2626">🗑️ Supprimer</button>
    `;

    $("saveOrderChangesBtn").onclick = () => saveOrderChanges(o.id);
    $("printInvoiceFromDetails").onclick = () => printOrderInvoice(o.id);
    $("deleteOrderBtn").onclick = () => deleteOrder(o.id);
  } catch (e) {
    body.innerHTML = `<p class="muted">Erreur : ${escapeHtml(e.message)}</p>`;
  }
};

async function saveOrderChanges(orderId) {
  const token = await getAdminToken();
  if (!token) return;

  const payload = {
    access_token: token,
    order_id: orderId,
    order_status: $("orderUpdateStatus")?.value,
    payment_status: $("orderUpdatePayment")?.value,
    paid_amount: parseFloat($("orderUpdatePaidAmount")?.value || 0)
  };

  const btn = $("saveOrderChangesBtn");
  btn.disabled = true;
  btn.textContent = "⏳...";

  try {
    const res = await fetch("/api/orders?action=update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.status === "OK") {
      alert("✅ Commande mise à jour");
      $("orderDetailsModal").classList.add("hidden");
      loadOrders();
    } else {
      alert("Erreur : " + (data.message || ""));
    }
  } catch (e) {
    alert("Erreur réseau : " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 ENREGISTRER";
  }
}

async function deleteOrder(orderId) {
  if (!confirm("⚠️ Supprimer cette commande ?")) return;

  const token = await getAdminToken();
  if (!token) return;

  try {
    const res = await fetch("/api/orders?action=delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, order_id: orderId })
    });

    const data = await res.json();

    if (data.status === "OK") {
      alert("✅ Commande supprimée");
      $("orderDetailsModal").classList.add("hidden");
      loadOrders();
    } else {
      alert("Erreur : " + (data.message || ""));
    }
  } catch (e) {
    alert("Erreur réseau : " + e.message);
  }
}

const _codb = $("closeOrderDetailsBtn");
if (_codb) _codb.onclick = () => $("orderDetailsModal").classList.add("hidden");

const _rob = $("refreshOrdersBtn");
if (_rob) _rob.onclick = () => loadOrders();

["ordersSearch", "ordersStatus", "ordersPayment"].forEach(id => {
  const el = $(id);
  if (!el) return;
  if (id === "ordersSearch") {
    let timer;
    el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadOrders, 400); });
  } else {
    el.addEventListener("change", loadOrders);
  }
});

// BRAND DETAILS
window.openBrandDetails = async function(brandName) {
  const modal = $("brandDetailsModal");
  const body = $("brandDetailsBody");
  const footer = $("brandDetailsFooter");
  const title = $("brandDetailsTitle");
  if (!modal) return;

  modal.classList.remove("hidden");
  body.innerHTML = `<p class="muted" style="text-align:center;padding:30px 0">Chargement...</p>`;
  footer.innerHTML = "";
  title.textContent = `🏢 ${brandName}`;

  try {
    const brand = (window.__allBrands || allBrandsCache || []).find(b => b.brand_name.toLowerCase() === brandName.toLowerCase());
    if (!brand) { body.innerHTML = `<p class="muted">Marque introuvable.</p>`; return; }

    const token = await getAdminToken();
    let orders = [];
    if (token) {
      try {
        const res = await fetch("/api/orders?action=list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, search: brandName, limit: 10 })
        });
        const data = await res.json();
        if (data.status === "OK") {
          orders = (data.orders || []).filter(o => o.brand_name.toLowerCase() === brandName.toLowerCase());
        }
      } catch (e) { console.warn(e); }
    }

    const tierIcons = { 'VIP': '💎', 'GOLD': '🥇', 'SILVER': '🥈', 'REGULAR': '👤' };
    const tier = brand.tier || 'REGULAR';

    let ordersHtml = "";
    if (orders.length === 0) {
      ordersHtml = `<p style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:12px">Aucune commande</p>`;
    } else {
      const statusLabels = { IN_PRODUCTION: "🟡", READY: "📦", HANDED_TO_CARRIER: "🟣", SHIPPED: "🚚", AWAITING_PICKUP: "🟠", AWAITING_HANDOVER: "⏳", DELIVERED: "✅", PAID: "💰", CANCELLED: "❌" };
      orders.slice(0, 5).forEach(o => {
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";
        const payIcon = o.payment_status === "PAID" ? "✅" : o.payment_status === "PARTIAL" ? "🟡" : "❌";
        ordersHtml += `
          <div style="padding:10px 12px;background:var(--bg);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div style="min-width:0;flex:1">
              <div style="font-family:monospace;font-weight:800;font-size:12px;color:var(--text);word-break:break-all">${escapeHtml(o.order_number)}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:4px">📅 ${escapeHtml(date)} ${statusLabels[o.order_status] || ""} ${payIcon}</div>
            </div>
            <div style="font-weight:900;font-size:13px;color:#16a34a;white-space:nowrap">${formatMoney(o.total_price)}</div>
          </div>`;
      });
    }

    body.innerHTML = `
      <div style="text-align:center;padding:16px 0 20px">
        <div style="font-size:48px;margin-bottom:8px">🏢</div>
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:900">${escapeHtml(brand.brand_name)}</h2>
        <div style="display:inline-flex;gap:6px;align-items:center;padding:4px 12px;background:var(--bg);border-radius:100px;font-size:11px;font-weight:800">
          ${brand.is_registered ? '✅ Inscrite' : '⚠️ Non inscrite'} · ${tierIcons[tier]} ${tier}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="text-align:center;padding:12px 8px;background:var(--bg);border-radius:12px">
          <div style="font-size:20px;font-weight:900;color:var(--text)">${brand.codes_count || 0}</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:800;letter-spacing:0.5px;margin-top:4px">📦 CODES</div>
        </div>
        <div style="text-align:center;padding:12px 8px;background:var(--bg);border-radius:12px">
          <div style="font-size:20px;font-weight:900;color:var(--text)">${brand.total_orders || 0}</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:800;letter-spacing:0.5px;margin-top:4px">📋 COMMANDES</div>
        </div>
        <div style="text-align:center;padding:12px 8px;background:var(--bg);border-radius:12px">
          <div style="font-size:14px;font-weight:900;color:#16a34a">${formatMoney(brand.total_spent || 0)}</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:800;letter-spacing:0.5px;margin-top:4px">💰 DÉPENSÉ</div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <h3 style="font-size:12px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">📞 Contact</h3>
        <div style="padding:12px 14px;background:var(--bg);border-radius:12px;font-size:13px">
          ${brand.phone ? `<div style="margin-bottom:6px">📱 <b>${escapeHtml(brand.phone)}</b></div>` : '<div style="color:var(--text-muted);margin-bottom:6px">📱 Non renseigné</div>'}
          ${brand.email ? `<div>📧 <b>${escapeHtml(brand.email)}</b></div>` : '<div style="color:var(--text-muted)">📧 Non renseigné</div>'}
        </div>
      </div>
      <div>
        <h3 style="font-size:12px;font-weight:900;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">📋 Commandes récentes</h3>
        ${ordersHtml}
      </div>
    `;

    footer.innerHTML = `
      <button id="addOrderFromBrand" style="background:linear-gradient(135deg,#16a34a,#22c55e);font-weight:800">➕ Nouvelle commande</button>
      ${brand.phone ? `<a href="https://wa.me/${encodeURIComponent(brand.phone.replace(/[^0-9]/g,''))}?text=${encodeURIComponent('Bonjour ' + brand.brand_name + ' 👋')}" target="_blank" rel="noopener" style="flex:1;padding:14px 22px;background:#25D366;color:#fff;border-radius:14px;font-weight:800;text-decoration:none;text-align:center;display:inline-flex;align-items:center;justify-content:center;font-size:14px">💬 WhatsApp</a>` : ""}
    `;

    $("addOrderFromBrand").onclick = () => {
      modal.classList.add("hidden");
      openNewOrderWithBrand(brand);
    };
  } catch (e) {
    body.innerHTML = `<p class="muted">Erreur : ${escapeHtml(e.message)}</p>`;
  }
};

async function openNewOrderWithBrand(brand) {
  const modal = $("newOrderModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  const errBox = $("newOrderError");
  if (errBox) errBox.classList.add("hidden");

  if ($("orderBrand")) $("orderBrand").value = brand.brand_name || "";
  if ($("orderBrandPhone")) $("orderBrandPhone").value = brand.phone || "";
  if ($("orderBrandEmail")) $("orderBrandEmail").value = brand.email || "";
  if ($("orderUnitPrice")) $("orderUnitPrice").value = "15";
  if ($("orderDiscount")) $("orderDiscount").value = "0";
  if ($("orderDeliveryCost")) $("orderDeliveryCost").value = "0";
  if ($("orderTva")) $("orderTva").value = "0";
  ["orderNotes","orderDeliveryCompany","orderTrackingNumber","orderWilaya","orderBaladiya","orderDeliveryAddress","orderRecipientPhone","orderShippingDate"].forEach(id => { if ($(id)) $(id).value = ""; });

  const hint = $("brandHint");
  if (hint) {
    if (brand.is_registered) {
      hint.textContent = `✅ Marque inscrite — ${brand.codes_count || 0} codes — ${brand.tier || 'REGULAR'}`;
      hint.style.color = "#16a34a";
    } else {
      hint.textContent = `⚠️ Marque non inscrite — ${brand.codes_count || 0} codes existants`;
      hint.style.color = "#eab308";
    }
  }

  const deliveryRadio = document.querySelector('input[name="orderDeliveryMethod"][value="delivery"]');
  if (deliveryRadio) deliveryRadio.checked = true;
  const df = $("deliveryFields");
  if (df) df.style.display = "block";

  currentOrderItems = [{ lot_number: "", quantity: 0 }];
  renderOrderItems();
  updateOrderTotals();
  await loadBrandsForDatalist();
}

const _cbdb = $("closeBrandDetailsBtn");
if (_cbdb) _cbdb.onclick = () => $("brandDetailsModal").classList.add("hidden");

const _bdm = $("brandDetailsModal");
if (_bdm) _bdm.addEventListener("click", (e) => { if (e.target === _bdm) _bdm.classList.add("hidden"); });

// ============================================================
// DEBTS
// ============================================================
async function loadDebts() {
  const container = $("debtsList");
  const statsBox = $("debtsStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  try {
    const { data, error } = await sb.rpc("admin_get_debts");
    if (error) throw error;

    debtsData = data || [];

    const totalDue = debtsData.reduce((s, d) => s + parseFloat(d.total_due || 0), 0);
    const totalInvoices = debtsData.reduce((s, d) => s + (d.invoices_count || 0), 0);
    const criticalCount = debtsData.filter(d => d.days_old >= 60).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num" style="color:#dc2626;font-size:18px">${formatMoney(totalDue)}</div><div class="stat-label">💰 TOTAL DÛ</div></div>
        <div class="stat-card"><div class="stat-num">${debtsData.length}</div><div class="stat-label">🏢 MARQUES</div></div>
        <div class="stat-card"><div class="stat-num">${totalInvoices}</div><div class="stat-label">📋 FACTURES</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626">${criticalCount}</div><div class="stat-label">🔴 +60 JOURS</div></div>
      `;
    }

    const badge = $("debtsBadge");
    if (badge) {
      if (debtsData.length > 0) {
        badge.textContent = debtsData.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    const search = ($("debtsSearch")?.value || "").toLowerCase().trim();
    const sortBy = $("debtsSort")?.value || "days";
    const minAge = parseInt($("debtsAge")?.value || "0", 10);

    let filtered = debtsData.filter(d => {
      if (search && !d.brand_name.toLowerCase().includes(search)) return false;
      if (minAge > 0 && (d.days_old || 0) < minAge) return false;
      return true;
    });

    if (sortBy === "days") filtered.sort((a, b) => (b.days_old || 0) - (a.days_old || 0));
    else if (sortBy === "amount") filtered.sort((a, b) => parseFloat(b.total_due || 0) - parseFloat(a.total_due || 0));
    else if (sortBy === "invoices") filtered.sort((a, b) => (b.invoices_count || 0) - (a.invoices_count || 0));

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#16a34a;font-size:14px;font-weight:800">✅ Aucune dette à recouvrer</div>`;
      return;
    }

    let html = "";
    filtered.forEach(d => {
      const days = d.days_old || 0;
      let severity = "low";
      if (days >= 60) severity = "critical";
      else if (days >= 30) severity = "high";
      else if (days >= 15) severity = "medium";

      const invoicesHtml = (d.invoices || []).map(inv => {
        const date = inv.created_at ? new Date(inv.created_at).toLocaleDateString("fr-FR") : "—";
        return `
          <div class="debt-invoice-row">
            <div>
              <div class="debt-invoice-number">${escapeHtml(inv.order_number)}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">📅 ${escapeHtml(date)}</div>
            </div>
            <div class="debt-invoice-amount">${formatMoney(inv.due)}</div>
          </div>`;
      }).join("");

      const whatsappMsg = encodeURIComponent(`Bonjour ${d.brand_name} 👋\n\nNous vous rappelons qu'il reste un solde impayé de ${formatMoney(d.total_due)} concernant ${d.invoices_count} facture(s).\n\nMerci de régulariser votre situation.\n\nOriginal`);

      html += `
        <div class="debt-card severity-${severity}">
          <div class="debt-header">
            <div style="flex:1;min-width:0">
              <div class="debt-brand">🏢 ${escapeHtml(d.brand_name)}</div>
              <div class="debt-badges">
                <span class="debt-days-badge ${severity}">📅 ${days} jours</span>
                <span style="padding:3px 9px;background:var(--bg);border-radius:100px;font-weight:800;font-size:11px;color:var(--text-muted)">📋 ${d.invoices_count} facture(s)</span>
              </div>
            </div>
            <div>
              <div class="debt-amount">${formatMoney(d.total_due)}</div>
              <div class="debt-amount-label">TOTAL DÛ</div>
            </div>
          </div>
          <div class="debt-info-row">
            ${d.brand_phone ? `<span>📱 ${escapeHtml(d.brand_phone)}</span>` : ""}
            ${d.brand_email ? `<span>📧 ${escapeHtml(d.brand_email)}</span>` : ""}
            <span>🕐 Depuis le ${d.oldest_invoice_date ? new Date(d.oldest_invoice_date).toLocaleDateString("fr-FR") : "—"}</span>
          </div>
          <div class="debt-invoices">${invoicesHtml}</div>
          <div class="debt-actions">
            <button class="mark-paid-btn" data-order-ids="${(d.invoices || []).map(i => i.id).join(',')}" style="background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff">✅ Marquer payé</button>
            ${d.brand_phone ? `<a href="https://wa.me/${encodeURIComponent(d.brand_phone.replace(/[^0-9]/g,''))}?text=${whatsappMsg}" target="_blank" rel="noopener" style="background:#25D366;color:#fff">💬 Rappel</a>` : ""}
            ${d.brand_email ? `<a href="mailto:${escapeHtml(d.brand_email)}?subject=${encodeURIComponent('Rappel paiement — ' + d.brand_name)}" style="background:#0f172a;color:#fff">📧 Email</a>` : ""}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll(".mark-paid-btn").forEach(btn => {
      btn.onclick = () => markDebtAsPaid(btn.dataset.orderIds);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

async function markDebtAsPaid(orderIdsStr) {
  const orderIds = orderIdsStr.split(",").map(s => parseInt(s, 10)).filter(n => n > 0);
  if (orderIds.length === 0) return;
  if (!confirm(`✅ Marquer ${orderIds.length} facture(s) comme PAYÉES ?`)) return;

  const token = await getAdminToken();
  if (!token) return;

  try {
    for (const orderId of orderIds) {
      await fetch("/api/orders?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, order_id: orderId, payment_status: "PAID", order_status: "PAID" })
      });
    }
    alert("✅ Factures marquées comme payées");
    loadDebts();
    loadOrders();
  } catch (e) {
    alert("Erreur : " + e.message);
  }
}

const _rdebts = $("refreshDebtsBtn");
if (_rdebts) _rdebts.onclick = () => loadDebts();

const _edebts = $("exportDebtsBtn");
if (_edebts) _edebts.onclick = () => {
  if (!debtsData || debtsData.length === 0) { alert("Aucune dette."); return; }
  const rows = [];
  debtsData.forEach(d => {
    (d.invoices || []).forEach(inv => {
      rows.push({
        "Marque": d.brand_name,
        "Téléphone": d.brand_phone || "",
        "Email": d.brand_email || "",
        "Facture": inv.order_number,
        "Date": inv.created_at ? new Date(inv.created_at).toLocaleDateString("fr-FR") : "",
        "Total": inv.total_price || 0,
        "Payé": inv.paid_amount || 0,
        "Reste dû": inv.due || 0,
        "Jours": d.days_old || 0
      });
    });
  });
  downloadExcel(rows, "Dettes", "Dettes");
};

["debtsSearch", "debtsSort", "debtsAge"].forEach(id => {
  const el = $(id);
  if (!el) return;
  if (id === "debtsSearch") {
    let timer;
    el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadDebts, 400); });
  } else {
    el.addEventListener("change", loadDebts);
  }
});

// ============================================================
// INVENTORY
// ============================================================
async function loadInventory() {
  const container = $("inventoryMovements");
  const statsBox = $("inventoryStats");
  const alertBox = $("inventoryAlert");
  const alertText = $("inventoryAlertText");
  const badge = $("inventoryBadge");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  try {
    const { data, error } = await sb.rpc("admin_get_inventory");
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);

    inventoryData = data;
    const current = data.current_stock || 0;
    const totalIn = data.total_in || 0;
    const totalOut = data.total_out || 0;
    const minStock = data.min_stock || 1000;
    const isAlert = data.alert === true;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-num" style="color:${current <= minStock ? '#dc2626' : '#16a34a'}">${current.toLocaleString('fr-FR')}</div><div class="stat-label">📦 STOCK ACTUEL</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a">+${totalIn.toLocaleString('fr-FR')}</div><div class="stat-label">📥 ENTRÉES</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626">-${totalOut.toLocaleString('fr-FR')}</div><div class="stat-label">📤 SORTIES</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#64748b">${minStock.toLocaleString('fr-FR')}</div><div class="stat-label">⚠️ SEUIL</div></div>
      `;
    }

    if (alertBox) {
      if (isAlert) {
        alertBox.classList.remove("hidden");
        if (alertText) alertText.textContent = `Stock bas (${current.toLocaleString('fr-FR')}). Seuil minimum: ${minStock.toLocaleString('fr-FR')}.`;
      } else {
        alertBox.classList.add("hidden");
      }
    }

    if (badge) {
      if (isAlert) { badge.textContent = "!"; badge.style.display = "inline-block"; }
      else { badge.style.display = "none"; }
    }

    const movements = data.recent_movements || [];

    if (movements.length === 0) {
      container.innerHTML = `<p class="muted" style="text-align:center;padding:30px 0">Aucun mouvement.</p>`;
      return;
    }

    let html = "";
    movements.forEach(m => {
      const date = m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : "—";
      const sign = m.movement_type === "IN" ? "+" : m.movement_type === "OUT" ? "-" : "±";
      const absQty = Math.abs(m.quantity);
      const typeLabels = { 'IN': '📥 Entrée', 'OUT': '📤 Sortie', 'ADJUST': '⚙️ Ajustement' };

      html += `
        <div class="inv-movement ${m.movement_type}">
          <div class="inv-movement-info">
            <div class="inv-movement-reason">${escapeHtml(m.reason || typeLabels[m.movement_type])}</div>
            <div class="inv-movement-meta">
              <span>📅 ${escapeHtml(date)}</span>
              ${m.reference ? `<span>🔗 ${escapeHtml(m.reference)}</span>` : ""}
            </div>
          </div>
          <div class="inv-movement-qty ${m.movement_type}">${sign}${absQty.toLocaleString('fr-FR')}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

$("addStockBtn")?.addEventListener("click", async () => {
  const qtyStr = prompt("📥 Combien d'étiquettes avez-vous reçu ?\n\n(ex: 5000)");
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty <= 0) { alert("⚠️ Quantité invalide"); return; }

  const reason = prompt("📝 Raison (optionnel) :", "Réception usine") || "Réception";

  try {
    const { data, error } = await sb.rpc("admin_add_inventory_movement", {
      p_type: "IN", p_quantity: qty, p_reason: reason, p_reference: null
    });
    if (error) throw error;
    if (data?.status === "OK") {
      alert(`✅ Stock ajouté: +${qty.toLocaleString('fr-FR')}`);
      loadInventory();
    } else alert("Erreur : " + (data?.message || ""));
  } catch (e) { alert("Erreur : " + e.message); }
});

$("adjustStockBtn")?.addEventListener("click", async () => {
  const qtyStr = prompt("⚙️ Ajustement de stock\n\n• Positif (+) pour ajouter\n• Négatif (-) pour retirer");
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty === 0) { alert("⚠️ Quantité invalide"); return; }

  const reason = prompt("📝 Raison :", "Ajustement manuel") || "Ajustement";

  try {
    const { data, error } = await sb.rpc("admin_add_inventory_movement", {
      p_type: "ADJUST", p_quantity: qty, p_reason: reason, p_reference: null
    });
    if (error) throw error;
    if (data?.status === "OK") {
      alert(`✅ Ajustement: ${qty > 0 ? '+' : ''}${qty}`);
      loadInventory();
    } else alert("Erreur : " + (data?.message || ""));
  } catch (e) { alert("Erreur : " + e.message); }
});

$("settingsStockBtn")?.addEventListener("click", async () => {
  const current = inventoryData?.min_stock || 1000;
  const qtyStr = prompt(`🔧 Seuil d'alerte\n\nActuel : ${current.toLocaleString('fr-FR')}\n\nNouveau seuil :`, current);
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty < 0) { alert("⚠️ Valeur invalide"); return; }

  try {
    const { data, error } = await sb.rpc("admin_update_inventory_settings", { p_min_stock: qty });
    if (error) throw error;
    if (data?.status === "OK") {
      alert(`✅ Seuil mis à jour: ${qty.toLocaleString('fr-FR')}`);
      loadInventory();
    } else alert("Erreur : " + (data?.message || ""));
  } catch (e) { alert("Erreur : " + e.message); }
});

$("refreshInventoryBtn")?.addEventListener("click", () => loadInventory());

async function autoDeductStock(lotNumber, qty, brandName) {
  try {
    const { data, error } = await sb.rpc("admin_add_inventory_movement", {
      p_type: "OUT",
      p_quantity: -Math.abs(qty),
      p_reason: `Impression lot ${lotNumber}`,
      p_reference: `${brandName} - Lot ${lotNumber}`
    });
    if (error) { console.warn("autoDeductStock:", error); return false; }
    if (data?.status === "OK") { console.log(`✅ Stock déduit: -${qty}`); return true; }
    return false;
  } catch (e) { console.warn("autoDeductStock error:", e); return false; }
}

// ============================================================
// PRINT
// ============================================================
function printLabels(codes, brand, lot, logoUrl) {
  if (!codes || !codes.length) return alert("Aucun code à imprimer.");
  const mode = ($("printMode") && $("printMode").value) || "labels";
  const url = location.origin + "/verify";
  const w = window.open("", "_blank");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

  if (mode === "list") {
    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste</title>
    <style>@page{margin:12mm}body{font-family:Arial;padding:15px;margin:0}.toolbar{background:#111;color:#fff;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px}.toolbar button{background:#fff;color:#111;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer}.header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #111}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#111;color:#fff;padding:10px 8px;text-align:left}td{padding:9px 8px;border-bottom:1px solid #e5e7eb}.code-cell{font-family:'Courier New';font-weight:bold;font-size:15px;letter-spacing:2px}@media print{.toolbar{display:none!important}}</style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
    <div class="header">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:50px;margin-bottom:10px">` : ""}<h1>${escapeHtml(brand)}</h1><p>Lot: ${escapeHtml(lot)} — Total: ${codes.length}</p></div>
    <table><thead><tr><th>#</th><th>Code</th></tr></thead><tbody>`;
    codes.forEach((code, i) => { html += `<tr><td>${i+1}</td><td class="code-cell">${code.match(/.{1,4}/g).join(" ")}</td></tr>`; });
    html += `</tbody></table></body></html>`;
    w.document.write(html); w.document.close(); return;
  }

  const size = ($("labelSize") && $("labelSize").value) || "60x90";
  let labelWidth, labelHeight, qrSize, codeFontSize, brandFontSize;
  if (size === "50x50") { labelWidth="50mm"; labelHeight="50mm"; qrSize="22mm"; codeFontSize="9px"; brandFontSize="8px"; }
  else if (size === "70x50") { labelWidth="70mm"; labelHeight="50mm"; qrSize="28mm"; codeFontSize="11px"; brandFontSize="10px"; }
  else { labelWidth="60mm"; labelHeight="90mm"; qrSize="34mm"; codeFontSize="13px"; brandFontSize="11px"; }

  let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Impression</title>
  <style>@page{margin:8mm}body{font-family:Arial;padding:10px;margin:0;background:#f5f5f5}.toolbar{background:#111;color:#fff;padding:12px;text-align:center;margin-bottom:15px;border-radius:8px}.toolbar button{background:#fff;color:#111;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer}.info{font-size:12px;color:#333;margin:15px 0;padding:14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px}.sheet{display:flex;flex-wrap:wrap;gap:4mm;background:#fff;padding:10px;border-radius:8px}.label{width:${labelWidth};height:${labelHeight};border:1px dashed #bbb;display:flex;flex-direction:column;page-break-inside:avoid;background:#fff;position:relative;border-radius:3mm;overflow:hidden}.label-top{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3mm;text-align:center}.label-logo{max-height:8mm;max-width:40mm;margin-bottom:1.5mm}.label-brand{font-size:${brandFontSize};font-weight:bold;letter-spacing:2px;margin-bottom:2mm}.label-qr{width:${qrSize};height:${qrSize}}.label-inst{font-size:7px;color:#666;margin-top:2mm}.label-fold{height:6mm;display:flex;align-items:center;justify-content:center;font-size:6px;color:#888;border-top:1px dashed #666;border-bottom:1px dashed #666;background:repeating-linear-gradient(45deg,#f0f0f0,#f0f0f0 3px,#e8e8e8 3px,#e8e8e8 6px)}.label-bottom{height:28mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;text-align:center}.label-code{font-family:'Courier New';font-size:${codeFontSize};font-weight:bold;letter-spacing:1.5px;padding:1.5mm 3mm;border:1px solid #ddd;border-radius:2mm;background:#fafafa}.label-hint{font-size:5.5px;color:#999;margin-top:1.5mm;font-style:italic}@media print{.toolbar,.info{display:none!important}.sheet{padding:0;gap:2mm}}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
  <div class="info"><b>📋 MODE D'EMPLOI :</b> Pliez le long de la ligne pointillée.</div>
  <div class="sheet">`;

  codes.forEach(code => {
    html += `<div class="label"><div class="label-top">${logoUrl ? `<img class="label-logo" src="${escapeHtml(logoUrl)}">` : ""}<div class="label-brand">${escapeHtml(brand)}</div><img class="label-qr" src="${qrUrl}"><div class="label-inst">Scannez puis entrez le code</div></div><div class="label-fold">✂ - - - PLIEZ ICI - - - ✂</div><div class="label-bottom"><div class="label-code">${code.match(/.{1,4}/g).join(" ")}</div><div class="label-hint">Ne pas révéler avant l'achat</div></div></div>`;
  });
  html += `</div></body></html>`;
  w.document.write(html); w.document.close();
}

const _pb = $("printBtn");
if (_pb) _pb.onclick = () => { printLabels(lastCodes, $("brand").value.trim() || "MARQUE", $("lot").value.trim() || "", lastLogo); };

const _plb = $("printLotBtn");
if (_plb) _plb.onclick = async () => {
  if (!loadedLot) return alert("Aucun lot chargé.");
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const btn = _plb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "🔓...";

  try {
    const res = await fetch("/api/batch-manager?action=print", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });

    const data = await res.json();
    if (data.status !== "OK") { alert("Erreur : " + (data.message || "")); return; }

    const codes = (data.codes || []).map(c => c.code).filter(Boolean);
    if (codes.length === 0) { alert("Aucun code."); return; }

    await autoDeductStock(loadedLot, codes.length, data.brand || loadedLotBrand || "?");
    printLabels(codes, data.brand || loadedLotBrand || "MARQUE", data.lot || loadedLotLot, data.logo_url || loadedLotLogo);
  } catch (err) { alert("Erreur réseau : " + err.message); }
  finally { btn.disabled = false; btn.textContent = originalText; }
};

// INVOICE
window.printOrderInvoice = async function(orderId) {
  const token = await getAdminToken();
  if (!token) return;

  try {
    const res = await fetch("/api/orders?action=get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, order_id: orderId })
    });

    const data = await res.json();
    if (data.status !== "OK") { alert("Erreur : " + (data.message || "")); return; }

    const o = data.order;
    const w = window.open("", "_blank");
    const itemsRows = (o.items || []).map(it => `<tr><td>Lot ${escapeHtml(it.lot_number)}</td><td style="text-align:right">${it.quantity}</td></tr>`).join("");
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";

    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${escapeHtml(o.order_number)}</title>
    <style>@page{margin:15mm}*{box-sizing:border-box}body{font-family:-apple-system,Arial;padding:20px;margin:0;color:#0f172a;background:#f8fafc}.toolbar{background:#0f172a;color:#fff;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px}.toolbar button{background:#16a34a;color:#fff;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px}.invoice{background:#fff;border-radius:12px;padding:30px;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #0f172a;flex-wrap:wrap;gap:20px}.brand-info h1{margin:0 0 8px;font-size:24px}.brand-info p{margin:4px 0;font-size:13px;color:#64748b}.invoice-meta{text-align:right}.invoice-meta h2{margin:0 0 8px;font-size:20px;color:#16a34a;font-family:'Courier New'}.invoice-meta p{margin:4px 0;font-size:13px}.client-info{margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:10px}.client-info h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b}.client-info p{margin:4px 0;font-size:14px}.items-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}.items-table th{background:#0f172a;color:#fff;padding:12px 10px;text-align:left;font-size:11px}.items-table td{padding:12px 10px;border-bottom:1px solid #e2e8f0}.totals{margin-top:24px;margin-left:auto;max-width:320px}.totals-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;border-bottom:1px dashed #e2e8f0}.totals-row.grand-total{padding:16px 0;font-size:20px;font-weight:900;border-top:3px solid #0f172a;border-bottom:3px solid #0f172a;color:#16a34a}.footer-info{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center}@media print{.toolbar{display:none!important}body{background:#fff;padding:0}.invoice{box-shadow:none;padding:0}}</style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER LA FACTURE</button></div>
    <div class="invoice">
      <div class="header">
        <div class="brand-info"><h1>🛡️ Original</h1><p>+213 556 339 415</p><p>mepirf@gmail.com</p></div>
        <div class="invoice-meta"><h2>${escapeHtml(o.order_number)}</h2><p><b>Date:</b> ${escapeHtml(date)}</p></div>
      </div>
      <div class="client-info"><h3>👤 Client</h3><p><b>${escapeHtml(o.brand_name)}</b></p>${o.brand_phone ? `<p>📱 ${escapeHtml(o.brand_phone)}</p>` : ""}${o.brand_email ? `<p>📧 ${escapeHtml(o.brand_email)}</p>` : ""}</div>
      <table class="items-table"><thead><tr><th>Description</th><th style="text-align:right">Quantité</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <div class="totals">
        <div class="totals-row"><span>Sous-total</span><b>${formatMoney(o.subtotal)}</b></div>
        ${parseFloat(o.discount_amount || 0) > 0 ? `<div class="totals-row"><span>Remise (${o.discount_percent}%)</span><b>-${formatMoney(o.discount_amount)}</b></div>` : ""}
        ${parseFloat(o.delivery_cost || 0) > 0 ? `<div class="totals-row"><span>Livraison</span><b>${formatMoney(o.delivery_cost)}</b></div>` : ""}
        <div class="totals-row grand-total"><span>TOTAL</span><b>${formatMoney(o.total_price)}</b></div>
      </div>
      <div class="footer-info"><p>Merci pour votre confiance 🙏</p><p>Original — Protection contre la contrefaçon</p></div>
    </div></body></html>`;

    w.document.write(html); w.document.close();
  } catch (e) { alert("Erreur : " + e.message); }
};

// ============================================================
// CREATE BATCH
// ============================================================
const _cb = $("createBtn");
if (_cb) _cb.onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");
  const brand = $("brand").value.trim();
  if (!brand) return alert("La marque est obligatoire.");

  const qty = Math.min(10000, Math.max(1, Number($("quantity").value) || 1));
  const statusRadio = document.querySelector('input[name="initial_status"]:checked');
  const initialStatus = statusRadio ? statusRadio.value : 'PENDING';

  _cb.disabled = true;
  _cb.textContent = "CRÉATION...";
  const ar = $("adminResult"); if (ar) ar.className = "result hidden";

  try {
    const res = await fetch("/api/batch-manager?action=create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({
        brand, product_name: $("product_name").value.trim() || null, reference: $("reference").value.trim() || null,
        lot: $("lot").value.trim() || null, manufacture_date: $("manufacture_date").value || null,
        expiry_date: $("expiry_date").value || null, product_image: $("product_image").value.trim() || null,
        logo_url: $("logo_url").value.trim() || null, instagram_url: $("instagram_url").value.trim() || null,
        facebook_url: $("facebook_url").value.trim() || null, tiktok_url: $("tiktok_url").value.trim() || null,
        description: $("description").value.trim() || null, quantity: qty, initial_status: initialStatus,
        access_token: session.access_token
      })
    });

    const data = await res.json();

    if (data.status === "OK") {
      lastCodes = data.codes || [];
      lastLogo = $("logo_url").value.trim() || "";
      if (ar) {
        ar.className = "result success";
        ar.innerHTML = `<h2>✓ LOT CRÉÉ</h2><p>${data.inserted} codes générés.</p>`;
      }
      const pb = $("printBtn"); if (pb) pb.classList.remove("hidden");
      const ebt = $("exportNewLotBtn"); if (ebt) ebt.classList.remove("hidden");
      loadStats();
      loadCharts();
    } else {
      if (ar) { ar.className = "result danger"; ar.innerHTML = `<p>Erreur : ${escapeHtml(data.message || "")}</p>`; }
    }
  } catch (err) {
    if (ar) { ar.className = "result danger"; ar.innerHTML = `<p>Erreur : ${escapeHtml(err.message)}</p>`; }
  } finally {
    _cb.disabled = false;
    _cb.textContent = "CRÉER LE LOT";
  }
};

// SEARCH
const _sb = $("searchBtn");
if (_sb) _sb.onclick = async () => {
  const code = ($("searchCode").value || "").trim().toUpperCase();
  const res = $("searchResult");
  if (!res) return;
  if (!code) { res.className = "result hidden"; return; }

  const { data, error } = await sb.from("qr_codes").select("*").eq("secret_code", code).limit(1);

  if (error || !data || data.length === 0) {
    res.className = "result danger";
    res.innerHTML = `<h2>NON TROUVÉ</h2>`;
    return;
  }

  const r = data[0];
  const statusClass = r.secret_status === "UNUSED" ? "success" : r.secret_status === "USED" ? "warning" : "danger";
  res.className = "result " + statusClass;
  res.innerHTML = `<h2>${escapeHtml(r.secret_status || "—")}</h2><div class="details">${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}</div>`;
};

// LOAD LOT
const _llb = $("loadLotBtn");
if (_llb) _llb.onclick = async () => {
  const lot = ($("editLotSearch").value || "").trim();
  const info = $("lotInfo");
  const form = $("editForm");
  const printLotBtn = $("printLotBtn");
  const exportBtn = $("exportLotCodesBtn");
  const statusBox = $("batchStatusBox");
  const actionsBox2 = $("batchActionsBox");
  if (!info) return;

  if (!lot) {
    info.className = "result danger"; info.innerHTML = `<p>Entrez un lot.</p>`;
    [form, printLotBtn, exportBtn, statusBox, actionsBox2].forEach(el => el?.classList.add("hidden"));
    return;
  }

  info.className = "result"; info.innerHTML = `<p>Chargement...</p>`;
  [form, printLotBtn, exportBtn, statusBox, actionsBox2].forEach(el => el?.classList.add("hidden"));
  loadedLot = null; loadedLotCodes = [];

  const { data, error } = await sb.from("qr_codes").select("*").eq("lot", lot).limit(10000);

  if (error || !data || data.length === 0) {
    info.className = "result danger";
    info.innerHTML = `<h2>AUCUN RÉSULTAT</h2>`;
    return;
  }

  const r = data[0];
  loadedLot = lot;
  loadedLotCodes = data.map(row => row.secret_code).filter(Boolean);
  loadedLotBrand = r.brand || "MARQUE";
  loadedLotLot = r.lot || lot;
  loadedLotLogo = r.logo_url || "";

  info.className = "result success";
  info.innerHTML = `<h2>${data.length} code(s)</h2><div class="details">${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}</div>`;

  showBatchStatus(data.map(row => row.secret_status));

  if (printLotBtn) printLotBtn.classList.remove("hidden");
  if (exportBtn) exportBtn.classList.remove("hidden");

  if ($("editBrand")) $("editBrand").value = r.brand || "";
  if ($("editProductName")) $("editProductName").value = r.product_name || "";
  if ($("editReference")) $("editReference").value = r.reference || "";
  if ($("editNewLot")) $("editNewLot").value = "";
  if ($("editManufactureDate")) $("editManufactureDate").value = r.manufacture_date || "";
  if ($("editExpiryDate")) $("editExpiryDate").value = r.expiry_date || "";
  if ($("editProductImage")) $("editProductImage").value = r.product_image || "";
  if ($("editLogoUrl")) $("editLogoUrl").value = r.logo_url || "";
  if ($("editDescription")) $("editDescription").value = r.description || "";
  if ($("editInstagramUrl")) $("editInstagramUrl").value = r.instagram_url || "";
  if ($("editFacebookUrl")) $("editFacebookUrl").value = r.facebook_url || "";
  if ($("editTiktokUrl")) $("editTiktokUrl").value = r.tiktok_url || "";

  if (form) form.classList.remove("hidden");
};

// UPDATE LOT
const _ub = $("updateBatchBtn");
if (_ub) _ub.onclick = async () => {
  if (!loadedLot) return alert("Chargez un lot.");
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const info = $("lotInfo");
  const updates = {};
  const v = id => { const el = $(id); return el ? (el.value || "").trim() : ""; };

  if (v("editBrand")) updates.brand = v("editBrand");
  if (v("editProductName")) updates.product_name = v("editProductName");
  if (v("editReference")) updates.reference = v("editReference");
  if (v("editNewLot")) updates.lot = v("editNewLot");
  if ($("editManufactureDate") && $("editManufactureDate").value) updates.manufacture_date = $("editManufactureDate").value;
  if ($("editExpiryDate") && $("editExpiryDate").value) updates.expiry_date = $("editExpiryDate").value;
  if (v("editProductImage")) updates.product_image = v("editProductImage");
  if (v("editLogoUrl")) updates.logo_url = v("editLogoUrl");
  if (v("editDescription")) updates.description = v("editDescription");
  if (v("editInstagramUrl")) updates.instagram_url = v("editInstagramUrl");
  if (v("editFacebookUrl")) updates.facebook_url = v("editFacebookUrl");
  if (v("editTiktokUrl")) updates.tiktok_url = v("editTiktokUrl");

  if (Object.keys(updates).length === 0) return alert("Aucun champ.");
  if (!confirm(`Confirmer ?`)) return;

  _ub.disabled = true;
  _ub.textContent = "MISE À JOUR...";
  const { error } = await sb.from("qr_codes").update(updates).eq("lot", loadedLot);
  _ub.disabled = false;
  _ub.textContent = "METTRE À JOUR LE LOT";

  if (error) { if (info) { info.className = "result danger"; info.innerHTML = `<p>Erreur : ${escapeHtml(error.message)}</p>`; } return; }
  if (info) { info.className = "result success"; info.innerHTML = `<h2>✓ LOT MIS À JOUR</h2>`; }
  loadStats();

  if (updates.brand) loadedLotBrand = updates.brand;
  if (updates.logo_url) loadedLotLogo = updates.logo_url;
  if (updates.lot) {
    loadedLot = updates.lot; loadedLotLot = updates.lot;
    if ($("editLotSearch")) $("editLotSearch").value = updates.lot;
    if ($("editNewLot")) $("editNewLot").value = "";
  }
};

// BATCH STATUS
function showBatchStatus(statuses) {
  const box = $("batchStatusBox");
  const badge = $("batchStatusBadge");
  const actionsBox = $("batchActionsBox");
  const activateBtn = $("activateBatchBtn");
  const disableBtn = $("disableBatchBtn");
  if (!box || !badge || !actionsBox) return;

  const counts = { PENDING: 0, UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0 };
  statuses.forEach(s => { if (counts[s] !== undefined) counts[s]++; });

  let label = '—', color = '#0f172a', bg = '#f1f5f9';
  if (counts.PENDING > 0 && counts.UNUSED === 0 && counts.USED === 0) { label = `⏳ EN ATTENTE — ${counts.PENDING}`; color = '#a16207'; bg = '#fef3c7'; }
  else if (counts.UNUSED > 0) { label = `🟢 ACTIF — ${counts.UNUSED}`; color = '#166534'; bg = '#dcfce7'; }
  else if (counts.USED > 0 && counts.UNUSED === 0 && counts.PENDING === 0) { label = `🔵 UTILISÉ — ${counts.USED}`; color = '#1e40af'; bg = '#dbeafe'; }
  else if (counts.DISABLED > 0) { label = `🔴 DÉSACTIVÉ — ${counts.DISABLED}`; color = '#991b1b'; bg = '#fee2e2'; }

  badge.textContent = label;
  badge.style.color = color;
  box.style.background = bg;
  box.style.borderColor = color + '40';
  box.classList.remove("hidden");

  if (activateBtn) activateBtn.style.display = counts.PENDING > 0 ? 'block' : 'none';
  if (disableBtn) disableBtn.style.display = counts.UNUSED > 0 ? 'block' : 'none';
  actionsBox.classList.toggle("hidden", counts.PENDING === 0 && counts.UNUSED === 0);
}

const _actBtn = $("activateBatchBtn");
if (_actBtn) _actBtn.onclick = async () => {
  if (!loadedLot) return;
  if (!confirm(`✅ Activer le lot "${loadedLot}" ?`)) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  _actBtn.disabled = true;
  _actBtn.textContent = "⏳...";
  try {
    const res = await fetch("/api/batch-actions?action=activate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const result = await res.json();
    if (result.status === "OK") { alert(`✅ ${result.message}`); $("loadLotBtn").click(); }
    else alert("Erreur : " + (result.message || ""));
  } catch (e) { alert("Erreur : " + e.message); }
  finally { _actBtn.disabled = false; _actBtn.textContent = "✅ ACTIVER LA BATCH"; }
};

const _disBtn = $("disableBatchBtn");
if (_disBtn) _disBtn.onclick = async () => {
  if (!loadedLot) return;
  if (!confirm(`⚠️ DÉSACTIVER le lot "${loadedLot}" ?`)) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  _disBtn.disabled = true;
  _disBtn.textContent = "⏳...";
  try {
    const res = await fetch("/api/batch-actions?action=disable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const result = await res.json();
    if (result.status === "OK") { alert(`🛑 ${result.message}`); $("loadLotBtn").click(); }
    else alert("Erreur : " + (result.message || ""));
  } catch (e) { alert("Erreur : " + e.message); }
  finally { _disBtn.disabled = false; _disBtn.textContent = "🛑 DÉSACTIVER"; }
};

// ============================================================
// EXCEL EXPORT
// ============================================================
function downloadExcel(data, filename, sheetName) {
  if (!data || data.length === 0) { alert("Aucune donnée."); return; }
  if (typeof XLSX === "undefined") { alert("XLSX non chargé."); return; }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");

  const keys = Object.keys(data[0]);
  ws["!cols"] = keys.map(k => {
    let maxLen = k.length;
    data.forEach(row => {
      const v = String(row[k] || "");
      if (v.length > maxLen) maxLen = v.length;
    });
    return { wch: Math.min(maxLen + 2, 50) };
  });

  XLSX.writeFile(wb, filename + "_" + new Date().toISOString().slice(0, 10) + ".xlsx");
}

const _enlb = $("exportNewLotBtn");
if (_enlb) _enlb.onclick = () => {
  if (!lastCodes || lastCodes.length === 0) return alert("Aucun code.");
  const brand = $("brand").value.trim() || "MARQUE";
  const lot = $("lot").value.trim() || "—";
  const rows = lastCodes.map((code, i) => ({ "#": i + 1, "Code": code, "Statut": "UNUSED", "Lot": lot, "Marque": brand }));
  downloadExcel(rows, "Codes_" + lot, "Codes");
};

const _elcb = $("exportLotCodesBtn");
if (_elcb) _elcb.onclick = async () => {
  if (!loadedLot) return alert("Chargez un lot.");
  const btn = _elcb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳...";
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/batch-manager?action=print", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const data = await res.json();
    if (data.status !== "OK") { alert("Erreur"); return; }
    const rows = (data.codes || []).map((c, i) => ({ "#": i + 1, "Code": c.code, "Statut": c.status || "UNUSED", "Lot": data.lot || loadedLot, "Marque": data.brand || loadedLotBrand }));
    downloadExcel(rows, "Codes_" + loadedLot, "Codes");
  } catch (err) { alert("Erreur : " + err.message); }
  finally { btn.disabled = false; btn.textContent = originalText; }
};

const _emb = $("exportMessagesBtn");
if (_emb) _emb.onclick = async () => {
  const btn = _emb; const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "⏳...";
  try {
    const { data, error } = await sb.from("brand_messages").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    if (!data || data.length === 0) { alert("Aucun message."); return; }
    const rows = data.map(m => ({ "Date": m.created_at ? new Date(m.created_at).toLocaleString() : "", "Marque": m.brand_name || "", "Email": m.email || "", "Téléphone": m.phone || "", "Sujet": m.subject || "", "Message": m.message || "", "Statut": m.status === "NEW" ? "Nouveau" : "Lu" }));
    downloadExcel(rows, "Messages", "Messages");
  } catch (err) { alert("Erreur : " + err.message); }
  finally { btn.disabled = false; btn.textContent = originalText; }
};

const _ebb = $("exportBrandsBtn");
if (_ebb) _ebb.onclick = async () => {
  const btn = _ebb; const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "⏳...";
  try {
    const token = await getAdminToken();
    if (!token) return;
    const res = await fetch("/api/orders?action=list-brands", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token })
    });
    const data = await res.json();
    if (data.status !== "OK" || !data.brands || data.brands.length === 0) { alert("Aucune marque."); return; }
    const rows = data.brands.map(b => ({ "Marque": b.brand_name || "", "Email": b.email || "", "Téléphone": b.phone || "", "Inscrite": b.is_registered ? "Oui" : "Non", "Tier": b.tier || "REGULAR", "Codes": b.codes_count || 0, "Commandes": b.total_orders || 0, "Total dépensé": b.total_spent || 0 }));
    downloadExcel(rows, "Marques", "Marques");
  } catch (err) { alert("Erreur : " + err.message); }
  finally { btn.disabled = false; btn.textContent = originalText; }
};

const _efb = $("exportFeedbackBtn");
if (_efb) _efb.onclick = async () => {
  const btn = _efb; const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "⏳...";
  try {
    const { data, error } = await sb.from("qr_feedback").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    if (!data || data.length === 0) { alert("Aucun avis."); return; }
    const rows = data.map(f => ({ "Date": f.created_at ? new Date(f.created_at).toLocaleString() : "", "Type": f.type === "rating" ? "Avis" : "Signalement", "Note": f.rating || "", "Commentaire": f.comment || "", "Code": f.secret_code || "", "IP": f.ip || "" }));
    downloadExcel(rows, "Avis_Clients", "Avis");
  } catch (err) { alert("Erreur : " + err.message); }
  finally { btn.disabled = false; btn.textContent = originalText; }
};

// ============================================================
// BULK DELETE
// ============================================================
const _pdb = $("previewDeleteBtn");
if (_pdb) _pdb.onclick = async () => {
  const lot = ($("deleteLotSearch").value || "").trim();
  const preview = $("deletePreview");
  const confirmBox = $("deleteConfirmBox");
  const result = $("deleteResult");
  if (result) result.classList.add("hidden");
  if (confirmBox) confirmBox.classList.add("hidden");
  pendingDeleteLot = null;

  if (!lot) { if (preview) { preview.className = "result danger"; preview.innerHTML = `<p>Entrez un lot.</p>`; } return; }

  if (preview) { preview.className = "result"; preview.innerHTML = `<p>Recherche...</p>`; }

  const { data, error } = await sb.from("qr_codes").select("secret_status").eq("lot", lot);

  if (error || !data || data.length === 0) {
    if (preview) { preview.className = "result danger"; preview.innerHTML = `<h2>AUCUN RÉSULTAT</h2>`; }
    return;
  }

  const statuses = { UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0, PENDING: 0 };
  data.forEach(r => { if (statuses[r.secret_status] !== undefined) statuses[r.secret_status]++; });

  pendingDeleteLot = lot;
  pendingDeleteCount = data.length;

  if (preview) {
    preview.className = "result danger";
    preview.innerHTML = `<h2>⚠️ PRÊT À SUPPRIMER</h2><p>Lot : <b>${escapeHtml(lot)}</b></p><p>Total : <b>${data.length}</b></p>`;
  }

  if ($("deleteConfirmInput")) $("deleteConfirmInput").value = "";
  if ($("confirmDeleteBtn")) $("confirmDeleteBtn").disabled = true;
  if (confirmBox) { confirmBox.classList.remove("hidden"); confirmBox.scrollIntoView({ behavior: "smooth", block: "center" }); }
};

const _dci = $("deleteConfirmInput");
if (_dci) _dci.addEventListener("input", (e) => {
  const v = e.target.value.trim().toUpperCase();
  const cdb = $("confirmDeleteBtn");
  if (cdb) cdb.disabled = (v !== "DELETE");
});

const _cdb = $("confirmDeleteBtn");
if (_cdb) _cdb.onclick = async () => {
  if (!pendingDeleteLot) return;
  if ($("deleteConfirmInput").value.trim().toUpperCase() !== "DELETE") return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const btn = _cdb;
  btn.disabled = true;
  btn.textContent = "SUPPRESSION...";
  const lot = pendingDeleteLot;
  const count = pendingDeleteCount;

  try {
    const { error: deleteError } = await sb.from("qr_codes").delete().eq("lot", lot);
    if (deleteError) throw deleteError;
    try { await sb.from("qr_delete_logs").insert({ lot, count, action: 'DELETE' }); } catch (e) {}

    const result = $("deleteResult");
    if (result) { result.className = "result success"; result.innerHTML = `<h2>✓ SUPPRESSION</h2><p><b>${count}</b> code(s).</p>`; }
    if ($("deletePreview")) $("deletePreview").classList.add("hidden");
    if ($("deleteConfirmBox")) $("deleteConfirmBox").classList.add("hidden");
    if ($("deleteLotSearch")) $("deleteLotSearch").value = "";
    pendingDeleteLot = null;
    pendingDeleteCount = 0;
    loadStats();
    loadCharts();
  } catch (err) {
    const result = $("deleteResult");
    if (result) { result.className = "result danger"; result.innerHTML = `<p>Erreur : ${escapeHtml(err.message)}</p>`; }
  } finally {
    btn.disabled = false;
    btn.textContent = "🗑️ SUPPRIMER";
  }
};

// ============================================================
// AUTH
// ============================================================
async function refresh() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = "/login"; return; }

  const userEmail = (session.user.email || "").toLowerCase().trim();
  if (!isAdminEmail(userEmail)) { window.location.href = "/brand"; return; }

  const lp = $("loginPage"); if (lp) lp.classList.add("hidden");
  const aa = $("adminApp"); if (aa) aa.classList.remove("hidden");

  const url = location.origin + "/verify";
  const pu = $("publicUrl"); if (pu) pu.textContent = url;

  const qr = $("qr");
  if (qr && qr.innerHTML.trim() === "") { new QRCode(qr, { text: url, width: 180, height: 180 }); }

  loadStats();
  loadLog();
  loadFeedback();
  loadCharts();
  loadMessagesBadge();
  loadFakesBadge();
}

refresh();

const _lf = $("loginForm");
if (_lf) _lf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const emailInput = $("email").value.trim();
  const passwordInput = $("password").value;
  const el = $("loginError");

  if (!isAdminEmail(emailInput)) {
    if (el) { el.className = "result danger"; el.innerHTML = `<p style="margin:0">⛔ Non autorisé.</p>`; el.classList.remove("hidden"); }
    return;
  }

  const lb = $("loginBtn");
  if (lb) { lb.disabled = true; lb.textContent = "CONNEXION..."; }
  const { error } = await sb.auth.signInWithPassword({ email: emailInput, password: passwordInput });
  if (lb) { lb.disabled = false; lb.textContent = "SE CONNECTER"; }

  if (error) {
    if (el) { el.className = "result danger"; el.innerHTML = `<p style="margin:0">${escapeHtml(error.message)}</p>`; el.classList.remove("hidden"); }
    return;
  }
  if (el) el.classList.add("hidden");
  refresh();
});

const _lb = $("logoutBtn");
if (_lb) _lb.onclick = async () => { await sb.auth.signOut(); location.reload(); };

const _rlb = $("refreshLogBtn");
if (_rlb) _rlb.onclick = () => loadLog();

const _rfb = $("refreshFeedbackBtn");
if (_rfb) _rfb.onclick = () => loadFeedback();

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
