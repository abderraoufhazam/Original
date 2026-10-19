// ============================================================
// ORIGINAL — ADMIN.JS (v6 — Full)
// ============================================================

// ═══════════ EmailJS Config (احتياطي) ═══════════
const EMAILJS_PUBLIC_KEY = "-u23EBBOrhdGM3uwm";
const EMAILJS_SERVICE_ID = "service_jzvkogk";
const EMAILJS_TEMPLATE_ID = "template_0yy00zs";

const $ = id => document.getElementById(id);

// ═══════════ GLOBAL STATE ═══════════
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
let currentOrderItems = [];
let currentOrderId = null;
let allBrandsCache = [];
let debtsData = [];
let inventoryData = null;
let advSearchData = [];
let currentShopsTab = "pending";
let allPendingShops = [];
let allActiveShops = [];
let allBannedShops = [];
let currentComplaintsFilter = "pending";
let allComplaints = [];
let currentComplaintsWilaya = "";
let currentComplaintsDateRange = "all";

// ============================================================
// HELPERS
// ============================================================
async function checkAdminServer(token) {
  try {
    const res = await fetch("/api/check-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token })
    });
    const data = await res.json();
    return data.isAdmin === true;
  } catch (e) {
    console.warn("check-admin error:", e);
    return false;
  }
}

async function getAdminToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.access_token : null;
}

// ============================================================
// TOAST
// ============================================================
window.toast = function(message, type = "info") {
  const container = $("toastContainer");
  if (!container) { console.log(`[${type}] ${message}`); return; }
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.transition = "all 300ms ease";
    t.style.opacity = "0";
    t.style.transform = "translateY(-20px)";
    setTimeout(() => t.remove(), 300);
  }, 3500);
};

function toastType(msg) {
  if (!msg || typeof msg !== "string") return "info";
  const m = msg.toLowerCase();
  if (m.startsWith("✅") || m.startsWith("✓") || m.includes("succès") || m.includes("réussi") || m.includes("activé") || m.includes("mis à jour") || m.includes("enregistr")) return "success";
  if (m.startsWith("❌") || m.startsWith("⛔") || m.includes("erreur") || m.includes("invalide") || m.includes("échoué")) return "error";
  return "info";
}

window.alert = function(msg) {
  window.toast(msg, toastType(msg));
};

// ============================================================
// PANEL TITLES
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
  shops: "المحلات",
  "shop-complaints": "شكاوى المحلات",
  visitors: "Visiteurs",
  fakes: "Contrefaçons",
  faq: "FAQ",
  delete: "Suppression",
  settings: "Impression"
};

// ============================================================
// NAVIGATION
// ============================================================
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
  if (name === "shops") loadShops();
  if (name === "shop-complaints") loadShopComplaints();
  if (name === "visitors") loadVisitors();
  if (name === "adv-search") loadAdvancedSearch();
  if (name === "faq") loadFAQ();
  if (name === "fakes") loadFakes();
  if (name === "orders") loadOrders();
  if (name === "debts") loadDebts();
  if (name === "inventory") loadInventory();
  if (name === "unassigned") loadUnassignedReports();
}

// ربط زر التحديث في قسم البلاغات غير الموجهة
const _ruab = $("refreshUnassignedBtn");
if (_ruab) {
  _ruab.onclick = () => loadUnassignedReports();
}

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
    const statusClass = r.result === "ORIGINAL" ? "success" : r.result === "USED" ? "warning" : "danger";
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

  let query = sb.from("qr_feedback").select("*").order("created_at", { ascending: false }).limit(200);
  if (currentFeedbackFilter !== "all") query = query.eq("type", currentFeedbackFilter);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucun avis.</p>`;
    return;
  }

  let html = "";
  data.forEach(r => {
    const isRating = r.type === "rating";
    const typeClass = isRating ? "success" : "danger";
    const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
    let stars = "";
    if (isRating && r.rating) {
      for (let i = 1; i <= 5; i++) stars += `<span style="color:${i <= r.rating ? "#fbbf24" : "#cbd5e1"};font-size:18px">★</span>`;
    }
    html += `
      <div class="log-row log-${typeClass}">
        <div class="log-top">
          <span class="log-result log-result-${typeClass}">${isRating ? "⭐ AVIS" : "🚨 SIGNALEMENT"}</span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>
        ${stars ? `<div style="margin:6px 0">${stars} <span style="font-weight:700;margin-left:6px">${r.rating}/5</span></div>` : ""}
        ${r.comment ? `<div style="font-size:13px;line-height:1.6;margin:8px 0;padding:10px 12px;background:var(--bg-secondary);border-radius:10px">${escapeHtml(r.comment)}</div>` : ""}
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
    const { count } = await sb.from("brand_messages").select("*", { count: "exact", head: true }).eq("status", "NEW");
    unreadMessagesCount = count || 0;
    const badge = $("messagesBadge");
    if (badge) {
      if (unreadMessagesCount > 0) { badge.textContent = unreadMessagesCount; badge.style.display = "inline-block"; }
      else { badge.style.display = "none"; }
    }
  } catch (e) { console.warn(e); }
}

async function loadMessages() {
  const container = $("messagesList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  let query = sb.from("brand_messages").select("*").order("created_at", { ascending: false }).limit(100);
  if (currentMessagesFilter !== "all") query = query.eq("status", currentMessagesFilter);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    container.innerHTML = `<p class="muted">Aucun message.</p>`;
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
          <span class="log-result log-result-${statusClass}">${isNew ? "🔴 NOUVEAU" : "✓ LU"}</span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>
        <div style="font-weight:800;font-size:14px;margin:8px 0 4px">${escapeHtml(m.brand_name || "—")}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">
          📧 ${escapeHtml(m.email || "—")}${m.phone ? ` &nbsp;|&nbsp; 📱 ${escapeHtml(m.phone)}` : ""}
        </div>
        <div style="font-size:13px;font-weight:700;margin-bottom:6px">📌 ${escapeHtml(m.subject || "(sans sujet)")}</div>
        <div style="font-size:13px;line-height:1.6;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:12px">${escapeHtml(m.message || "")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isNew ? `<button onclick="markMessageRead(${m.id})" class="btn btn-success" style="flex:1;min-width:120px;padding:8px 12px;font-size:12px">✓ Marquer lu</button>` : ""}
          ${m.phone ? `<a href="https://wa.me/${encodeURIComponent(m.phone.replace(/[^0-9]/g,''))}" target="_blank" rel="noopener" class="btn btn-ghost" style="flex:1;min-width:120px;padding:8px 12px;font-size:12px;background:#25D366;color:#fff;border:0">💬 WhatsApp</a>` : ""}
          <a href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}" class="btn btn-ghost" style="flex:1;min-width:120px;padding:8px 12px;font-size:12px">📧 Email</a>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

window.markMessageRead = async function(id) {
  const { error } = await sb.from("brand_messages").update({ status: "READ" }).eq("id", id);
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
  loadMessages();
  loadMessagesBadge();
};

// ============================================================
// BRANDS
// ============================================================
async function loadBrands() {
  const container = $("brandsList");
  const statsBox = $("brandsStats");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  const token = await getAdminToken();
  if (!token) { container.innerHTML = `<p class="muted">Non connecté.</p>`; return; }

  try {
    const res = await fetch("/api/orders?action=list-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ access_token: token })
    });
    const data = await res.json();

    if (data.status !== "OK") {
      container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(data.message || "")}</p>`;
      return;
    }

    const brands = data.brands || [];
    const registered = brands.filter(b => b.is_registered).length;
    const unregistered = brands.filter(b => !b.is_registered).length;
    const withCodes = brands.filter(b => (b.codes_count || 0) > 0).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value">${brands.length}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${registered}</div><div class="stat-label">✅ INSCRITES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${unregistered}</div><div class="stat-label">⚠️ NON INSCRITES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--primary)">${withCodes}</div><div class="stat-label">📦 AVEC CODES</div></div>`;
    }

    if (brands.length === 0) {
      container.innerHTML = `<p class="muted">Aucune marque.</p>`;
      return;
    }

    allBrandsCache = brands;
    window.__allBrands = brands;

    const dl = $("brandsList");
    if (dl) dl.innerHTML = brands.map(b => `<option value="${escapeHtml(b.brand_name)}">`).join("");

    let html = "";
    brands.forEach(b => {
      const tierColors = { VIP: "#7c3aed", GOLD: "#eab308", SILVER: "#94a3b8", REGULAR: "#64748b" };
      const tierIcons = { VIP: "💎", GOLD: "🥇", SILVER: "🥈", REGULAR: "👤" };
      const tier = b.tier || "REGULAR";

      html += `
        <div class="log-row log-${b.is_registered ? "success" : "warning"}" style="padding:16px">
          <div class="log-top">
            <span class="log-result log-result-${b.is_registered ? "success" : "warning"}">
              ${b.is_registered ? "✅ INSCRITE" : "⚠️ NON INSCRITE"}
            </span>
            <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:6px;background:${tierColors[tier]}20;color:${tierColors[tier]}">${tierIcons[tier]} ${tier}</span>
          </div>
          <div style="font-weight:800;font-size:16px;margin:10px 0 6px">🏢 ${escapeHtml(b.brand_name)}</div>
          <div class="log-meta" style="margin-bottom:10px">
            ${b.email ? `<span>📧 ${escapeHtml(b.email)}</span>` : ""}
            ${b.phone ? `<span>📱 ${escapeHtml(b.phone)}</span>` : ""}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:18px;font-weight:900">${b.codes_count || 0}</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">CODES</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:18px;font-weight:900">${b.total_orders || 0}</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">COMMANDES</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:14px;font-weight:900;color:var(--success)">${formatMoney(b.total_spent || 0)}</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">DÉPENSÉ</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="view-brand-details btn btn-primary" data-brand-name="${escapeHtml(b.brand_name)}" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">👁 Voir détails</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".view-brand-details").forEach(btn => {
      btn.onclick = () => {
        if (typeof window.openBrandDetails === "function") {
          window.openBrandDetails(btn.dataset.brandName);
        }
      };
    });
  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

// ═══════════════ انتهى الجزء 1 ═══════════════

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
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${counts.real}</div><div class="stat-label">🟢 RÉELS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${counts.suspicious}</div><div class="stat-label">🟡 SUSPECTS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${counts.bot}</div><div class="stat-label">🔴 BOTS</div></div>`;
    }

    let query = sb.from("visitor_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (currentVisitorFilter !== "all") query = query.eq("status", currentVisitorFilter);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      container.innerHTML = `<p class="muted">Aucune visite.</p>`;
      return;
    }

    let html = "";
    data.forEach(v => {
      const colors = { real: "success", "good-bot": "success", suspicious: "warning", bot: "danger" };
      const labels = { real: "🟢 RÉEL", "good-bot": "🤖 GOOGLE/BING", suspicious: "🟡 SUSPECT", bot: "🔴 BOT" };
      const cls = colors[v.status] || "warning";
      const label = labels[v.status] || v.status;
      const date = v.created_at ? new Date(v.created_at).toLocaleString() : "—";
      const ua = (v.user_agent || "").slice(0, 80);
      html += `
        <div class="log-row log-${cls}" style="padding:16px">
          <div class="log-top"><span class="log-result log-result-${cls}">${label}</span><span class="log-date">${escapeHtml(date)}</span></div>
          <div style="font-family:monospace;font-size:12px;margin:8px 0"><b>IP:</b> ${escapeHtml(v.ip || "—")}${v.country ? ` | <b>Pays:</b> ${escapeHtml(v.country)}` : ""}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;word-break:break-all">${escapeHtml(v.path || "/")}</div>
          <div style="font-size:10px;color:var(--text-tertiary);font-family:monospace;margin-bottom:8px;word-break:break-all">${escapeHtml(ua)}</div>
          ${v.reason ? `<div style="font-size:10px;color:var(--danger);margin-bottom:6px">Raison: ${escapeHtml(v.reason)}</div>` : ""}
          <div style="font-size:11px"><b>Bot Score:</b> ${v.bot_score || 0}/100</div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

// ============================================================
// FAKES
// ============================================================
const WILAYA_NAMES = ["01 - أدرار","02 - الشلف","03 - الأغواط","04 - أم البواقي","05 - باتنة","06 - بجاية","07 - بسكرة","08 - بشار","09 - البليدة","10 - البويرة","11 - تمنراست","12 - تبسة","13 - تلمسان","14 - تيارت","15 - تيزي وزو","16 - الجزائر","17 - الجلفة","18 - جيجل","19 - سطيف","20 - سعيدة","21 - سكيكدة","22 - سيدي بلعباس","23 - عنابة","24 - قالمة","25 - قسنطينة","26 - المدية","27 - مستغانم","28 - المسيلة","29 - معسكر","30 - ورقلة","31 - وهران","32 - البيض","33 - إليزي","34 - برج بوعريريج","35 - بومرداس","36 - الطارف","37 - تندوف","38 - تيسمسيلت","39 - الوادي","40 - خنشلة","41 - سوق أهراس","42 - تيبازة","43 - ميلة","44 - عين الدفلى","45 - النعامة","46 - عين تموشنت","47 - غرداية","48 - غليزان","49 - تيميمون","50 - برج باجي مختار","51 - أولاد جلال","52 - بني عباس","53 - عين صالح","54 - عين قزام","55 - تقرت","56 - جانت","57 - المغير","58 - المنيعة"];

async function loadFakesBadge() {
  try {
    const { count } = await sb.from("fake_reports").select("*", { count: "exact", head: true }).eq("status", "NEW");
    unreadFakesCount = count || 0;
    const badge = $("fakesBadge");
    if (badge) {
      if (unreadFakesCount > 0) { badge.textContent = unreadFakesCount; badge.style.display = "inline-block"; }
      else { badge.style.display = "none"; }
    }
  } catch (e) { console.warn(e); }
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
    if (error) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`; return; }

    const { data: allData } = await sb.from("fake_reports").select("wilaya, status, ai_analyzed").limit(5000);

    const total = (allData || []).length;
    const newCount = (allData || []).filter(r => r.status === "NEW").length;
    const reviewedCount = (allData || []).filter(r => r.status === "REVIEWED").length;
    const aiCount = (allData || []).filter(r => r.ai_analyzed).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${newCount}</div><div class="stat-label">🔴 NOUVEAUX</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${reviewedCount}</div><div class="stat-label">✓ TRAITÉS</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--primary)">${aiCount}</div><div class="stat-label">🤖 IA</div></div>`;
    }

    const wilayaCounts = {};
    (allData || []).forEach(r => { if (r.wilaya) wilayaCounts[r.wilaya] = (wilayaCounts[r.wilaya] || 0) + 1; });
    const maxCount = Math.max(1, ...Object.values(wilayaCounts));

    if (heatmapBox) {
      let heatHtml = "";
      WILAYA_NAMES.forEach(w => {
        const c = wilayaCounts[w] || 0;
        let bg, color;
        if (c === 0) { bg = "rgba(148,163,184,0.08)"; color = "#94a3b8"; }
        else {
          const intensity = c / maxCount;
          if (intensity > 0.7) { bg = "linear-gradient(135deg,#dc2626,#ef4444)"; color = "#fff"; }
          else if (intensity > 0.4) { bg = "linear-gradient(135deg,#f59e0b,#fbbf24)"; color = "#fff"; }
          else if (intensity > 0.15) { bg = "linear-gradient(135deg,#fbbf24,#fde047)"; color = "#78350f"; }
          else { bg = "linear-gradient(135deg,#fef3c7,#fef9c3)"; color = "#a16207"; }
        }
        heatHtml += `<div style="padding:10px 12px;border-radius:10px;background:${bg};color:${color};text-align:center;font-weight:700;font-size:12px;border:1px solid rgba(0,0,0,0.06)">
          <div>${escapeHtml(w)}</div>
          <div style="font-size:18px;font-weight:900;margin-top:4px">${c}</div>
        </div>`;
      });
      heatmapBox.innerHTML = heatHtml;
    }

    if (!data || data.length === 0) { container.innerHTML = `<p class="muted">Aucun signalement.</p>`; return; }

    let html = "";
    data.forEach(r => {
      const isNew = r.status === "NEW";
      const cls = isNew ? "danger" : "success";
      const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
      html += `
        <div class="log-row log-${cls}" style="padding:18px">
          <div class="log-top"><span class="log-result log-result-${cls}">${isNew ? "🔴 NOUVEAU" : "✓ TRAITÉ"}</span><span class="log-date">${escapeHtml(date)}</span></div>
          ${r.product_image ? `<img src="${escapeHtml(r.product_image)}" alt="" style="max-width:200px;max-height:200px;display:block;margin:10px auto;border-radius:12px;border:1px solid var(--border)">` : ""}
          ${r.product_brand ? `<div style="font-size:14px;font-weight:800;margin:8px 0 4px">🏷️ ${escapeHtml(r.product_brand)}</div>` : ""}
          ${r.product_name ? `<div style="font-size:13px;font-weight:700;margin-bottom:6px">📦 ${escapeHtml(r.product_name)}</div>` : ""}
          <div class="details">
            ${r.wilaya ? `<div><b>📍 Wilaya</b><span>${escapeHtml(r.wilaya)}</span></div>` : ""}
            ${r.attempted_code ? `<div><b>Code essayé</b><span style="font-family:monospace">${escapeHtml(r.attempted_code)}</span></div>` : ""}
            ${r.ip ? `<div><b>IP</b><span style="font-family:monospace;font-size:11px">${escapeHtml(r.ip)}</span></div>` : ""}
          </div>
          ${r.comment ? `<div style="font-size:12px;line-height:1.6;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;margin-top:10px">💬 ${escapeHtml(r.comment)}</div>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            ${isNew ? `<button onclick="markFakeReviewed(${r.id})" class="btn btn-success" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">✓ Marquer traité</button>` : ""}
            <button onclick="deleteFake(${r.id})" class="btn btn-danger" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">🗑️ Supprimer</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

window.markFakeReviewed = async function(id) {
  const { error } = await sb.from("fake_reports").update({ status: "REVIEWED" }).eq("id", id);
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
  loadFakes();
  loadFakesBadge();
};

window.deleteFake = async function(id) {
  if (!confirm("Supprimer ce signalement ?")) return;
  const { error } = await sb.from("fake_reports").delete().eq("id", id);
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
  loadFakes();
  loadFakesBadge();
};

// ============================================================
// FAQ
// ============================================================
function resetFaqForm() {
  editingFaqId = null;
  ["faqQuestionAr","faqAnswerAr","faqQuestionFr","faqAnswerFr","faqQuestionEn","faqAnswerEn"].forEach(id => {
    const el = $(id); if (el) el.value = "";
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
  } else { resetFaqForm(); }
  const box = $("faqEditBox");
  if (box) { box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "start" }); }
}

async function loadFAQ() {
  const container = $("faqList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  const { data, error } = await sb.from("faq_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error || !data || data.length === 0) { container.innerHTML = `<p class="muted">Aucune question.</p>`; return; }

  let html = "";
  data.forEach(item => {
    const isActive = item.is_active !== false;
    const cls = isActive ? "success" : "warning";
    const label = isActive ? "✓ ACTIF" : "⏸️ DÉSACTIVÉ";
    html += `
      <div class="log-row log-${cls}" style="padding:16px">
        <div class="log-top">
          <span class="log-result log-result-${cls}">${label}</span>
          <span class="log-date">#${item.sort_order || 0}</span>
        </div>
        <div style="font-weight:800;font-size:14px;margin:8px 0 6px">${escapeHtml(item.question || "")}</div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;padding:10px 12px;background:var(--bg-secondary);border-radius:10px">${escapeHtml((item.answer || "").slice(0, 200))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="editFaqItem(${item.id})" class="btn btn-primary" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">✏️ Modifier</button>
          <button onclick="toggleFaqActive(${item.id}, ${isActive})" class="btn btn-ghost" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">${isActive ? "⏸️ Désactiver" : "▶️ Activer"}</button>
          <button onclick="deleteFaqItem(${item.id})" class="btn btn-danger" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">🗑️ Supprimer</button>
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
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
  loadFAQ();
};

window.deleteFaqItem = async function(id) {
  if (!confirm("Supprimer cette question ?")) return;
  const { error } = await sb.from("faq_items").delete().eq("id", id);
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
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
  if (error || !data || data.length === 0) { container.innerHTML = `<p class="muted">Aucune suppression.</p>`; return; }

  let html = "";
  data.forEach(r => {
    const date = r.deleted_at ? new Date(r.deleted_at).toLocaleString() : "—";
    html += `<div class="log-row log-danger">
      <div class="log-top"><span class="log-result log-result-danger">🗑️ SUPPRESSION</span><span class="log-date">${escapeHtml(date)}</span></div>
      <div class="log-meta">${r.lot ? `<span>📦 Lot: <b>${escapeHtml(r.lot)}</b></span>` : ""}<span>🔢 ${r.count || 0} code(s)</span></div>
    </div>`;
  });
  container.innerHTML = html;
}

// ============================================================
// CHARTS
// ============================================================
function getChartColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return { text: isDark ? "#94a3b8" : "#64748b", grid: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.05)" };
}

async function loadCharts() {
  // ═══════════════════════════════════════════════════════════
  // Chart 1: Daily Verifications (14 days) — via RPC
  // ═══════════════════════════════════════════════════════════
  try {
    const { data, error } = await sb.rpc("admin_get_daily_verifications");
    if (error) throw error;

    // بناء مصفوفة 14 يوم حتى لو بعض الأيام بدون بيانات
    const days = [];
    const counts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dataMap = {};
    (data || []).forEach(d => {
      // day يأتي كـ string من PostgreSQL
      const dayStr = typeof d.day === 'string' ? d.day : new Date(d.day).toISOString().split('T')[0];
      dataMap[dayStr] = parseInt(d.count, 10) || 0;
    });

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push(d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }));
      counts.push(dataMap[key] || 0);
    }

    const colors = getChartColors();
    const ctx = $("chartDaily");
    if (ctx) {
      if (chartDaily) chartDaily.destroy();
      chartDaily = new Chart(ctx, {
        type: "line",
        data: {
          labels: days,
          datasets: [{
            label: "Vérifications",
            data: counts,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } },
            x: { ticks: { color: colors.text, font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
  } catch (e) {
    console.warn("chartDaily:", e);
  }

  // ═══════════════════════════════════════════════════════════
  // Chart 2: Results Distribution — via RPC
  // ═══════════════════════════════════════════════════════════
  try {
    const { data, error } = await sb.rpc("admin_get_results_distribution");
    if (error) throw error;

    const dist = { ORIGINAL: 0, USED: 0, NOT_FOUND: 0 };
    (data || []).forEach(r => {
      const key = r.result || 'NOT_FOUND';
      if (dist[key] !== undefined) {
        dist[key] = parseInt(r.count, 10) || 0;
      } else {
        dist.NOT_FOUND += parseInt(r.count, 10) || 0;
      }
    });

    const ctx = $("chartResults");
    if (ctx) {
      if (chartResults) chartResults.destroy();
      chartResults = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["✓ Original", "⚠ Déjà utilisé", "✗ Non original"],
          datasets: [{
            data: [dist.ORIGINAL, dist.USED, dist.NOT_FOUND],
            backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
            borderColor: "#fff",
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: getChartColors().text,
                padding: 14,
                font: { size: 12, weight: "600" },
                usePointStyle: true,
                pointStyle: "circle"
              }
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn("chartResults:", e);
  }

  // ═══════════════════════════════════════════════════════════
  // Chart 3: Top 5 Lots — via RPC
  // ═══════════════════════════════════════════════════════════
  try {
    const { data, error } = await sb.rpc("admin_get_top_lots");
    if (error) throw error;

    const labels = (data || []).map(t => t.lot || "—");
    const values = (data || []).map(t => parseInt(t.count, 10) || 0);

    const ctx = $("chartTopLots");
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
          labels,
          datasets: [{
            label: "Vérifications",
            data: values,
            backgroundColor: [
              "rgba(16,185,129,0.85)",
              "rgba(59,130,246,0.85)",
              "rgba(245,158,11,0.85)",
              "rgba(168,85,247,0.85)",
              "rgba(236,72,153,0.85)"
            ],
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 40
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: getChartColors().text, precision: 0 },
              grid: { color: getChartColors().grid }
            },
            y: {
              ticks: { color: getChartColors().text, font: { size: 12, weight: "600" } },
              grid: { display: false }
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn("chartTopLots:", e);
  }
}
window.__reloadCharts = loadCharts;

// ============================================================
// ADVANCED SEARCH
// ============================================================
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
      const s = text.replace(/[%,()]/g, "");
      query = query.or(`brand.ilike.%${s}%,lot.ilike.%${s}%,secret_code.ilike.%${s}%,reference.ilike.%${s}%,product_name.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) { resultsBox.innerHTML = `<p class="muted">Erreur : ${escapeHtml(error.message)}</p>`; return; }

    advSearchData = data || [];
    if (advSearchData.length === 0) { resultsBox.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">Aucun résultat.</p>`; return; }

    const counts = { PENDING: 0, UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0 };
    advSearchData.forEach(r => { if (counts[r.secret_status] !== undefined) counts[r.secret_status]++; });

    if (statsBox) {
      statsBox.style.display = "grid";
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value">${advSearchData.length}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${counts.PENDING}</div><div class="stat-label">PENDING</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${counts.UNUSED}</div><div class="stat-label">UNUSED</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--primary)">${counts.USED}</div><div class="stat-label">USED</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${counts.DISABLED}</div><div class="stat-label">DISABLED</div></div>`;
    }

    let html = "";
    advSearchData.forEach(r => {
      const cls = r.secret_status === "UNUSED" ? "success" : r.secret_status === "PENDING" ? "warning" : r.secret_status === "USED" ? "success" : "danger";
      const date = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
      html += `<div class="log-row log-${cls}" style="padding:14px">
        <div class="log-top"><span class="log-result log-result-${cls}">${escapeHtml(r.secret_status)}</span><span class="log-date">${escapeHtml(date)}</span></div>
        <div class="log-code" style="font-size:14px">${escapeHtml(formatDisplayCode(r.secret_code) || "—")}</div>
        <div class="log-meta">${r.brand ? `<span>🏷 ${escapeHtml(r.brand)}</span>` : ""}${r.lot ? `<span>📦 ${escapeHtml(r.lot)}</span>` : ""}</div>
      </div>`;
    });
    resultsBox.innerHTML = html;
  } catch (err) { resultsBox.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

// ============================================================
// ORDERS
// ============================================================
const ORDER_STATUS_LABELS = { IN_PRODUCTION: "🟡 En production", READY: "📦 Prête", HANDED_TO_CARRIER: "🟣 Confiée transporteur", SHIPPED: "🚚 Expédiée", AWAITING_PICKUP: "🟠 En attente retrait", AWAITING_HANDOVER: "⏳ En attente remise", DELIVERED: "✅ Livrée", PAID: "💰 Payée", CANCELLED: "❌ Annulée" };
const PAYMENT_LABELS = { UNPAID: "❌ Non payé", PARTIAL: "🟡 Partiel", PAID: "✅ Payé" };

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

    if (data.status !== "OK") { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(data.message || "")}</p>`; return; }

    const orders = data.orders || [];

    if (statsBox) {
      const total = orders.length;
      const revenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
      const paid = orders.filter(o => o.payment_status === "PAID").length;
      const unpaid = orders.filter(o => o.payment_status !== "PAID").reduce((s, o) => s + parseFloat(o.total_price || 0) - parseFloat(o.paid_amount || 0), 0);
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">TOTAL</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${paid}</div><div class="stat-label">✅ PAYÉES</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:16px">${formatMoney(revenue)}</div><div class="stat-label">💰 REVENU</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger);font-size:16px">${formatMoney(unpaid)}</div><div class="stat-label">⚠️ IMPAYÉ</div></div>`;
    }

    if (orders.length === 0) { container.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">Aucune commande.</p>`; return; }

    let html = "";
    orders.forEach(o => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";
      const itemsHtml = (o.items || []).map(it => `<span class="brand-order-pill">Lot ${escapeHtml(it.lot_number)} × ${it.quantity}</span>`).join("");
      html += `
        <div class="log-row" style="padding:18px;border-left-color:var(--primary)">
          <div class="log-top">
            <div>
              <div style="font-family:monospace;font-weight:900;font-size:14px">${escapeHtml(o.order_number)}</div>
              <div style="font-weight:800;font-size:15px;margin-top:4px">🏢 ${escapeHtml(o.brand_name)}</div>
            </div>
            <div style="text-align:right">
              <span class="brand-status-pill ${o.order_status}">${ORDER_STATUS_LABELS[o.order_status] || o.order_status}</span>
              <div style="margin-top:6px"><span class="brand-payment-pill ${o.payment_status}">${PAYMENT_LABELS[o.payment_status] || o.payment_status}</span></div>
            </div>
          </div>
          <div class="log-meta" style="margin:10px 0">📅 ${escapeHtml(date)}${o.brand_phone ? ` • 📱 ${escapeHtml(o.brand_phone)}` : ""}</div>
          ${itemsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0">${itemsHtml}</div>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border);margin-top:10px">
            <div style="font-size:12px;color:var(--text-secondary)">${o.total_quantity} codes</div>
            <div style="font-size:18px;font-weight:900;color:var(--gold)">${formatMoney(o.total_price)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button onclick="openOrderDetails(${o.id})" class="btn btn-primary" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">👁 Détails</button>
            <button onclick="printOrderInvoice(${o.id})" class="btn btn-success" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">🖨 Facture</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

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
    const totalInv = debtsData.reduce((s, d) => s + (d.invoices_count || 0), 0);
    const critical = debtsData.filter(d => d.days_old >= 60).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:var(--danger);font-size:18px">${formatMoney(totalDue)}</div><div class="stat-label">💰 TOTAL DÛ</div></div>
        <div class="stat-card"><div class="stat-value">${debtsData.length}</div><div class="stat-label">🏢 MARQUES</div></div>
        <div class="stat-card"><div class="stat-value">${totalInv}</div><div class="stat-label">📋 FACTURES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${critical}</div><div class="stat-label">🔴 +60J</div></div>`;
    }

    const badge = $("debtsBadge");
    if (badge) { if (debtsData.length > 0) { badge.textContent = debtsData.length; badge.style.display = "inline-block"; } else badge.style.display = "none"; }

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

    if (filtered.length === 0) { container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--success);font-size:14px;font-weight:800">✅ Aucune dette</div>`; return; }

    let html = "";
    filtered.forEach(d => {
      const days = d.days_old || 0;
      let sev = "low";
      if (days >= 60) sev = "critical";
      else if (days >= 30) sev = "high";
      else if (days >= 15) sev = "medium";
      const sevColor = { low: "var(--success)", medium: "var(--warning)", high: "#f97316", critical: "var(--danger)" }[sev];

      const invoicesHtml = (d.invoices || []).map(inv => {
        const date = inv.created_at ? new Date(inv.created_at).toLocaleDateString("fr-FR") : "—";
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
          <div><div style="font-family:monospace;font-weight:800">${escapeHtml(inv.order_number)}</div><div style="font-size:10px;color:var(--text-secondary);margin-top:2px">📅 ${escapeHtml(date)}</div></div>
          <div style="font-weight:900;color:var(--danger);white-space:nowrap;margin-left:8px">${formatMoney(inv.due)}</div>
        </div>`;
      }).join("");

      html += `
        <div class="log-row" style="padding:18px;border-left:4px solid ${sevColor}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-weight:900;font-size:16px;margin-bottom:4px">🏢 ${escapeHtml(d.brand_name)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px">
                <span style="padding:3px 9px;background:${sevColor}20;color:${sevColor};border-radius:100px;font-weight:800">📅 ${days} jours</span>
                <span style="padding:3px 9px;background:var(--bg-secondary);border-radius:100px;font-weight:800;color:var(--text-secondary)">📋 ${d.invoices_count} facture(s)</span>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:900;color:var(--danger)">${formatMoney(d.total_due)}</div>
              <div style="font-size:9px;color:var(--text-tertiary);font-weight:800;letter-spacing:1px">TOTAL DÛ</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap">
            ${d.brand_phone ? `<span>📱 ${escapeHtml(d.brand_phone)}</span>` : ""}
            ${d.brand_email ? `<span>📧 ${escapeHtml(d.brand_email)}</span>` : ""}
          </div>
          <div style="background:var(--bg-secondary);border:1px dashed var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px">${invoicesHtml}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="mark-paid-btn btn btn-success" data-order-ids="${(d.invoices || []).map(i => i.id).join(',')}" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px">✅ Marquer payé</button>
            ${d.brand_phone ? `<a href="https://wa.me/${encodeURIComponent(d.brand_phone.replace(/[^0-9]/g,''))}" target="_blank" rel="noopener" class="btn btn-ghost" style="flex:1;min-width:110px;font-size:12px;padding:8px 12px;background:#25D366;color:#fff;border:0">💬 Rappel</a>` : ""}
          </div>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".mark-paid-btn").forEach(btn => {
      btn.onclick = () => markDebtAsPaid(btn.dataset.orderIds);
    });
  } catch (err) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

async function markDebtAsPaid(idsStr) {
  const ids = idsStr.split(",").map(s => parseInt(s, 10)).filter(n => n > 0);
  if (ids.length === 0) return;
  if (!confirm(`Marquer ${ids.length} facture(s) comme payées ?`)) return;

  const token = await getAdminToken();
  if (!token) return;
  try {
    for (const id of ids) {
      await fetch("/api/orders?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, order_id: id, payment_status: "PAID", order_status: "PAID" })
      });
    }
    window.toast("✅ Factures marquées payées", "success");
    loadDebts();
    loadOrders();
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
}

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
        <div class="stat-card"><div class="stat-value" style="color:${current <= minStock ? "var(--danger)" : "var(--success)"}">${current.toLocaleString("fr-FR")}</div><div class="stat-label">📦 STOCK</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">+${totalIn.toLocaleString("fr-FR")}</div><div class="stat-label">📥 ENTRÉES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">-${totalOut.toLocaleString("fr-FR")}</div><div class="stat-label">📤 SORTIES</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--text-secondary)">${minStock.toLocaleString("fr-FR")}</div><div class="stat-label">⚠️ SEUIL</div></div>`;
    }

    if (alertBox) {
      if (isAlert) { alertBox.classList.remove("hidden"); if (alertText) alertText.textContent = `Stock bas (${current.toLocaleString("fr-FR")}). Seuil min: ${minStock.toLocaleString("fr-FR")}.`; }
      else alertBox.classList.add("hidden");
    }

    if (badge) { if (isAlert) { badge.textContent = "!"; badge.style.display = "inline-block"; } else badge.style.display = "none"; }

    const movements = data.recent_movements || [];
    if (movements.length === 0) { container.innerHTML = `<p class="muted" style="text-align:center;padding:30px 0">Aucun mouvement.</p>`; return; }

    let html = "";
    movements.forEach(m => {
      const date = m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : "—";
      const sign = m.movement_type === "IN" ? "+" : m.movement_type === "OUT" ? "-" : "±";
      const absQty = Math.abs(m.quantity);
      const typeLabels = { IN: "📥 Entrée", OUT: "📤 Sortie", ADJUST: "⚙️ Ajustement" };
      const cls = m.movement_type === "IN" ? "success" : m.movement_type === "OUT" ? "danger" : "warning";
      html += `<div class="log-row log-${cls}" style="padding:14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13px;margin-bottom:4px">${escapeHtml(m.reason || typeLabels[m.movement_type])}</div>
          <div style="font-size:11px;color:var(--text-secondary)">📅 ${escapeHtml(date)}${m.reference ? ` • 🔗 ${escapeHtml(m.reference)}` : ""}</div>
        </div>
        <div style="font-size:18px;font-weight:900;white-space:nowrap;color:${cls === "success" ? "var(--success)" : cls === "danger" ? "var(--danger)" : "var(--warning)"}">${sign}${absQty.toLocaleString("fr-FR")}</div>
      </div>`;
    });
    container.innerHTML = html;
  } catch (err) { container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`; }
}

// ═══════════════ انتهى الجزء 2 ═══════════════

// ============================================================
// 🏪 SHOPS (المحلات)
// ============================================================
async function loadShops() {
  const container = $("shopsList");
  const statsBox = $("shopsStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  try {
    const { data: terms } = await sb
      .from("shop_terms_acceptance")
      .select("*")
      .eq("status", "PENDING")
      .order("accepted_at", { ascending: false });

    const { data: shops } = await sb
      .from("verified_shops")
      .select("*")
      .order("created_at", { ascending: false });

    allPendingShops = terms || [];
    allActiveShops  = (shops || []).filter(s => s.status === "ACTIVE" || s.status === "WARNING");
    allBannedShops  = (shops || []).filter(s => s.status === "BANNED" || s.status === "SUSPENDED");

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${allPendingShops.length}</div><div class="stat-label">⏳ قيد المراجعة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${allActiveShops.length}</div><div class="stat-label">✅ نشطة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${allBannedShops.length}</div><div class="stat-label">🚫 محظورة</div></div>
        <div class="stat-card"><div class="stat-value">${(shops || []).length}</div><div class="stat-label">🏪 الإجمالي</div></div>`;
    }

    const badge = $("shopsBadge");
    if (badge) {
      if (allPendingShops.length > 0) {
        badge.textContent = allPendingShops.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    renderShopsList();
  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

function renderShopsList() {
  const container = $("shopsList");
  if (!container) return;

  const search = ($("shopsSearch")?.value || "").toLowerCase().trim();

  let list = [];
  if (currentShopsTab === "pending") list = allPendingShops;
  else if (currentShopsTab === "active") list = allActiveShops;
  else list = allBannedShops;

  if (search) {
    list = list.filter(s => {
      const name = (s.shop_name || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      return name.includes(search) || phone.includes(search) || email.includes(search);
    });
  }

  if (list.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">لا يوجد نتائج</p>`;
    return;
  }

  let html = "";
  list.forEach(s => {
    const date = (s.accepted_at || s.created_at)
      ? new Date(s.accepted_at || s.created_at).toLocaleString("fr-FR")
      : "—";

    if (currentShopsTab === "pending") {
      html += `
        <div class="log-row log-warning" style="padding:18px">
          <div class="log-top">
            <span class="log-result log-result-warning">⏳ قيد المراجعة</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          <div style="font-weight:900;font-size:16px;margin:10px 0 8px">🏪 ${escapeHtml(s.shop_name)}</div>
          <div class="log-meta" style="margin-bottom:12px">
            ${s.phone ? `<span>📱 ${escapeHtml(s.phone)}</span>` : ""}
            ${s.email ? `<span>📧 ${escapeHtml(s.email)}</span>` : ""}
          </div>
          <div class="details" style="margin-bottom:12px">
            ${s.terms_version ? `<div><b>نسخة الشروط</b><span>${escapeHtml(s.terms_version)}</span></div>` : ""}
            ${s.ip ? `<div><b>IP</b><span style="font-family:monospace;font-size:11px">${escapeHtml(s.ip)}</span></div>` : ""}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="approveShop('${s.user_id}')" class="btn btn-success" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">✅ موافقة</button>
            <button onclick="rejectShop('${s.user_id}','${escapeHtml(s.shop_name)}')" class="btn btn-danger" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">❌ رفض</button>
            <button onclick="printShopTerms('${s.user_id}')" class="btn btn-ghost" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">🖨 طباعة</button>
          </div>
        </div>`;
    } else {
      const isBanned = s.status === "BANNED" || s.status === "SUSPENDED";
      const cls = isBanned ? "danger" : (s.status === "WARNING" ? "warning" : "success");
      const label = {
        ACTIVE: "✅ نشط",
        WARNING: "⚠️ تحذير",
        BANNED: "🚫 محظور",
        SUSPENDED: "⏸️ موقوف"
      }[s.status] || s.status;

      const depositPct = s.total_deposit > 0
        ? Math.round(((s.total_deposit - s.deposit_remaining) / s.total_deposit) * 100)
        : 0;

      html += `
        <div class="log-row log-${cls}" style="padding:18px">
          <div class="log-top">
            <span class="log-result log-result-${cls}">${label}</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          <div style="font-weight:900;font-size:16px;margin:10px 0 8px">🏪 ${escapeHtml(s.shop_name)}</div>
          <div class="log-meta" style="margin-bottom:12px">
            ${s.phone ? `<span>📱 ${escapeHtml(s.phone)}</span>` : ""}
            ${s.wilaya ? `<span>📍 ${escapeHtml(s.wilaya)}</span>` : ""}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:16px;font-weight:900">${s.confirmed_complaints || 0}</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">بلاغات</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:13px;font-weight:900">${formatMoney(s.total_deposit || 0)}</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">العربون</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px">
              <div style="font-size:13px;font-weight:900;color:${depositPct >= 50 ? "var(--danger)" : "var(--success)"}">${depositPct}%</div>
              <div style="font-size:9px;color:var(--text-secondary);font-weight:800">مستهلك</div>
            </div>
          </div>
          ${isBanned && s.ban_reason ? `<div style="font-size:12px;color:var(--danger);margin-top:10px;padding:8px 12px;background:var(--danger-soft);border-radius:8px">🚫 ${escapeHtml(s.ban_reason)}</div>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button onclick="editDeposit('${s.id}','${escapeHtml(s.shop_name)}',${s.total_deposit || 0})" class="btn btn-primary" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">💰 العربون</button>
            ${isBanned
              ? `<button onclick="unbanShop('${s.id}','${escapeHtml(s.shop_name)}')" class="btn btn-success" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">🔓 رفع الحظر</button>`
              : `<button onclick="banShop('${s.id}','${escapeHtml(s.shop_name)}')" class="btn btn-danger" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">🚫 حظر</button>`}
            <button onclick="viewShopDetails('${s.user_id}')" class="btn btn-ghost" style="flex:1;min-width:100px;font-size:12px;padding:9px 12px">👁 تفاصيل</button>
          </div>
        </div>`;
    }
  });

  container.innerHTML = html;
}

// ─── موافقة على محل ───
window.approveShop = async function(userId) {
  if (!confirm("الموافقة على هذا المحل؟")) return;
  const wilaya = prompt("📍 الولاية (اختياري):") || null;
  const notes = prompt("📝 ملاحظات (اختياري):") || null;

  try {
    const { data, error } = await sb.rpc("admin_approve_shop", {
      p_user_id: userId,
      p_wilaya: wilaya,
      p_notes: notes
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast("✅ تم تفعيل المحل: " + data.shop_name, "success");

    // إرسال بريد عبر Brevo
    if (data.email) {
      try {
        const res = await fetch("/api/submit?type=shop-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: data.email,
            shop_name: data.shop_name,
            shop_email: data.email,
            shop_phone: data.phone || null,
            wilaya: wilaya,
            approved_date: new Date().toLocaleDateString("ar-DZ", {
              year: "numeric", month: "long", day: "numeric"
            })
          })
        });

        const result = await res.json();

        if (result.status === "OK") {
          window.toast("📧 تم إرسال البريد إلى " + data.email, "success");
        } else {
          console.warn("Email send failed:", result);
          window.toast("⚠️ لم يُرسل البريد — لكن المحل مُفعّل", "warning");
        }
      } catch (emailErr) {
        console.warn("Email error:", emailErr);
        window.toast("⚠️ خطأ في إرسال البريد", "warning");
      }
    }

    loadShops();
  } catch (e) {
    window.toast("خطأ: " + e.message, "error");
  }
};

window.rejectShop = async function(userId, shopName) {
  const reason = prompt(`سبب رفض "${shopName}":`, "وثائق غير مكتملة");
  if (!reason) return;

  try {
    const { data, error } = await sb.rpc("admin_reject_shop", {
      p_user_id: userId,
      p_reason: reason
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast("تم رفض: " + data.shop_name, "info");
    loadShops();
  } catch (e) {
    window.toast("خطأ: " + e.message, "error");
  }
};

window.printShopTerms = async function(userId) {
  const { data: terms } = await sb
    .from("shop_terms_acceptance")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!terms) {
    window.toast("لم يتم العثور على الموافقة", "error");
    return;
  }

  const date = terms.accepted_at
    ? new Date(terms.accepted_at).toLocaleString("fr-FR")
    : "—";

  const w = window.open("", "_blank");
  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>موافقة شروط — ${escapeHtml(terms.shop_name)}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; padding: 20px; color: #0f172a; max-width: 800px; margin: 0 auto; }
  .toolbar { background: #0f172a; color: #fff; padding: 12px; text-align: center; border-radius: 8px; margin-bottom: 24px; }
  .toolbar button { background: #16a34a; color: #fff; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 3px solid #0f172a; margin-bottom: 24px; }
  .header img { width: 60px; height: 60px; border-radius: 14px; }
  .header-info { text-align: left; font-size: 12px; color: #64748b; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-grid div { padding: 10px 14px; background: #f8fafc; border-radius: 8px; font-size: 13px; }
  .info-grid b { color: #64748b; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-grid span { font-weight: 800; color: #0f172a; font-size: 14px; }
  .text-box { padding: 16px; background: #fef2f2; border: 1.5px solid #dc2626; border-radius: 10px; color: #991b1b; font-size: 13px; line-height: 1.8; margin: 20px 0; }
  .text-box b { color: #dc2626; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  .signature { display: flex; justify-content: space-between; margin-top: 40px; }
  .signature div { width: 45%; }
  .signature b { display: block; font-size: 12px; margin-bottom: 40px; color: #64748b; }
  .signature hr { border: 0; border-top: 1px dashed #94a3b8; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨 طباعة / حفظ PDF</button>
  </div>

  <div class="header">
    <img src="/icon.png" alt="Original">
    <div class="header-info">
      <div style="font-size:18px;font-weight:900;color:#0f172a;">OriginalDz</div>
      <div>📞 +213 556 339 415</div>
      <div>📧 mepirf@gmail.com</div>
      <div>🌐 originaldz.online</div>
    </div>
  </div>

  <h1>📜 وثيقة الموافقة على شروط الاستخدام — للمحلات</h1>

  <h2>معلومات المحل</h2>
  <div class="info-grid">
    <div><b>اسم المحل</b><span>${escapeHtml(terms.shop_name)}</span></div>
    <div><b>رقم الهاتف</b><span>${escapeHtml(terms.phone || "—")}</span></div>
    <div><b>البريد الإلكتروني</b><span style="font-size:12px">${escapeHtml(terms.email)}</span></div>
    <div><b>نسخة الشروط</b><span>${escapeHtml(terms.terms_version)}</span></div>
    <div><b>تاريخ الموافقة</b><span style="font-size:12px">${escapeHtml(date)}</span></div>
    <div><b>عنوان IP</b><span style="font-size:11px;font-family:monospace">${escapeHtml(terms.ip || "—")}</span></div>
  </div>

  <h2>نص التعهد</h2>
  <p style="font-size:13.5px;line-height:1.9;color:#334155;">
    أُقرّ أنا الموقّع أدناه، صاحب المحل المذكور أعلاه، بأنني قد قرأت وفهمت كامل شروط الاستخدام الخاصة بمنصة <b>OriginalDz</b>،
    وأتعهّد بالالتزام بها دون استثناء، بما في ذلك:
  </p>
  <ul style="font-size:13.5px;line-height:1.9;color:#334155;padding-right:20px;">
    <li>عدم بيع أي منتج مقلد يحمل ملصق OriginalDz.</li>
    <li>دفع العربون المتفق عليه قبل استلام أي دفعة من الأكواد.</li>
    <li>التعاون الكامل مع فرق التحقق عند أي شكوى.</li>
    <li>تحمّل المسؤولية الكاملة لوحدي في حال الخروج عن أي بند.</li>
  </ul>

  <div class="text-box">
    ⚠️ <b>تنبيه قانوني:</b> هذه الوثيقة عقد قانوني ملزم بين المحل و OriginalDz.
    في حال الخروج عن الشروط، يتحمّل صاحب المحل المسؤولية الكاملة لوحده،
    ويُعفى OriginalDz من أي مسؤولية قانونية أو تجارية أو جزائية.
  </div>

  <div class="signature">
    <div>
      <b>توقيع صاحب المحل:</b>
      <hr>
    </div>
    <div>
      <b>ختم / توقيع الإدارة:</b>
      <hr>
    </div>
  </div>

  <div class="footer">
    © OriginalDz — وثيقة قانونية صادرة بتاريخ ${escapeHtml(date)}
  </div>

</body>
</html>`);
  w.document.close();
};

window.editDeposit = async function(shopId, shopName, currentDeposit) {
  const newAmount = prompt(`💰 العربون الحالي: ${currentDeposit} دج\n\nأدخل المبلغ الجديد:`, currentDeposit);
  if (newAmount === null) return;
  const amount = parseFloat(newAmount);
  if (isNaN(amount) || amount < 0) {
    window.toast("قيمة غير صحيحة", "error");
    return;
  }

  const reason = prompt("📝 السبب:", "تحديث العربون من الأدمن") || null;

  try {
    const { data, error } = await sb.rpc("admin_update_shop_deposit", {
      p_shop_id: shopId,
      p_new_deposit: amount,
      p_reason: reason
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast(`✅ العربون: ${data.new_total} دج`, "success");
    loadShops();
  } catch (e) {
    window.toast("خطأ: " + e.message, "error");
  }
};

window.banShop = async function(shopId, shopName) {
  const reason = prompt(`سبب حظر "${shopName}":`, "5 بلاغات مؤكدة أو استهلاك 50% من العربون");
  if (!reason) return;

  if (!confirm(`⚠️ تأكيد حظر "${shopName}"؟\n\nسيتم تعطيل كل الأكواد نهائيًا.`)) return;

  try {
    const { data, error } = await sb.rpc("admin_set_shop_status", {
      p_shop_id: shopId,
      p_new_status: "BANNED",
      p_reason: reason
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast("🚫 تم حظر: " + data.shop_name, "warning");
    loadShops();
  } catch (e) {
    window.toast("خطأ: " + e.message, "error");
  }
};

window.unbanShop = async function(shopId, shopName) {
  if (!confirm(`رفع الحظر عن "${shopName}"؟`)) return;

  try {
    const { data, error } = await sb.rpc("admin_set_shop_status", {
      p_shop_id: shopId,
      p_new_status: "ACTIVE",
      p_reason: null
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast("🔓 تم رفع الحظر: " + data.shop_name, "success");
    loadShops();
  } catch (e) {
    window.toast("خطأ: " + e.message, "error");
  }
};

window.viewShopDetails = async function(userId) {
  window.toast("🚧 قيد البناء", "info");
};

// ============================================================
// 🚨 SHOP COMPLAINTS (شكاوى المحلات)
// ============================================================
async function loadShopComplaints() {
  const container = $("complaintsList");
  const statsBox = $("complaintsStats");
  if (!container) return;

  container.innerHTML = `<p class="muted">Chargement...</p>`;
  if (statsBox) statsBox.innerHTML = "";

  try {
    const { data, error } = await sb
      .from("shop_complaints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    allComplaints = data || [];

    const stats = {
      total: allComplaints.length,
      pending: allComplaints.filter(c => c.status === "PENDING").length,
      reviewing: allComplaints.filter(c => c.status === "REVIEWING").length,
      verified: allComplaints.filter(c => c.status === "VERIFIED" || c.status === "RESOLVED").length,
      rejected: allComplaints.filter(c => c.status === "REJECTED").length
    };

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">الإجمالي</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${stats.pending}</div><div class="stat-label">⏳ معلّقة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--primary)">${stats.reviewing}</div><div class="stat-label">🔍 قيد المراجعة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${stats.verified}</div><div class="stat-label">✅ مؤكدة</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${stats.rejected}</div><div class="stat-label">❌ مرفوضة</div></div>`;
    }

    const badge = $("complaintsBadge");
    if (badge) {
      if (stats.pending > 0) {
        badge.textContent = stats.pending;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    fillComplaintsWilayaFilter();
    renderShopComplaints();
  } catch (err) {
    console.error("loadShopComplaints error:", err);
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

function fillComplaintsWilayaFilter() {
  const sel = $("complaintsWilaya");
  if (!sel) return;

  const current = sel.value;
  let html = `<option value="">📍 كل الولايات</option>`;

  const wilayas = [...new Set(allComplaints.map(c => c.customer_wilaya).filter(Boolean))].sort();
  wilayas.forEach(w => {
    html += `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`;
  });

  sel.innerHTML = html;
  sel.value = current;
}

function renderShopComplaints() {
  const container = $("complaintsList");
  if (!container) return;

  const search = ($("complaintsSearch")?.value || "").toLowerCase().trim();

  let list = [];
  if (currentComplaintsFilter === "pending") list = allComplaints.filter(c => c.status === "PENDING");
  else if (currentComplaintsFilter === "reviewing") list = allComplaints.filter(c => c.status === "REVIEWING");
  else if (currentComplaintsFilter === "verified") list = allComplaints.filter(c => c.status === "VERIFIED" || c.status === "RESOLVED");
  else if (currentComplaintsFilter === "rejected") list = allComplaints.filter(c => c.status === "REJECTED");
  else list = allComplaints;

  if (search) {
    list = list.filter(c => {
      const code = (c.product_code || "").toLowerCase();
      const name = (c.customer_name || "").toLowerCase();
      const shop = (c.shop_name || "").toLowerCase();
      const phone = (c.customer_phone || "").toLowerCase();
      return code.includes(search) || name.includes(search) || shop.includes(search) || phone.includes(search);
    });
  }

  if (currentComplaintsWilaya) {
    list = list.filter(c => c.customer_wilaya === currentComplaintsWilaya);
  }

  if (currentComplaintsDateRange !== "all") {
    const days = parseInt(currentComplaintsDateRange, 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    list = list.filter(c => c.created_at && new Date(c.created_at) >= since);
  }

  if (list.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0">لا توجد شكاوى في هذه الفئة</p>`;
    return;
  }

  let html = "";
  list.forEach(c => {
    const date = c.created_at ? new Date(c.created_at).toLocaleString("fr-FR") : "—";
    const statusMap = {
      PENDING: { cls: "warning", label: "⏳ معلّقة" },
      REVIEWING: { cls: "success", label: "🔍 قيد المراجعة" },
      VERIFIED: { cls: "success", label: "✅ مؤكدة" },
      RESOLVED: { cls: "success", label: "✓ تم الحل" },
      REJECTED: { cls: "danger", label: "❌ مرفوضة" }
    };
    const st = statusMap[c.status] || { cls: "warning", label: c.status };

    const images = c.images || [];
    const firstImg = images[0] ? `<img src="${escapeHtml(images[0])}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:10px;">` : "";

    html += `
      <div class="log-row log-${st.cls}" style="padding:18px">
        <div class="log-top">
          <span class="log-result log-result-${st.cls}">${st.label}</span>
          <span class="log-date">${escapeHtml(date)}</span>
        </div>

        <div style="display:flex;gap:14px;margin-top:12px;flex-wrap:wrap;">
          ${firstImg ? `<div style="flex:0 0 140px;max-width:140px;">${firstImg}</div>` : ""}
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:900;font-size:15px;margin-bottom:6px">🏪 ${escapeHtml(c.shop_name || "غير مرتبط")}</div>
            <div style="font-size:12.5px;margin-bottom:4px"><b>📦 الكود:</b> <span style="font-family:monospace">${escapeHtml(c.product_code || "—")}</span></div>
            <div style="font-size:12.5px;margin-bottom:4px"><b>👤 الزبون:</b> ${escapeHtml(c.customer_name || "—")}</div>
            <div style="font-size:12.5px;margin-bottom:4px"><b>📱 الهاتف:</b> ${escapeHtml(c.customer_phone || "—")}</div>
            <div style="font-size:12.5px;margin-bottom:4px"><b>📍 الولاية:</b> ${escapeHtml(c.customer_wilaya || "—")}</div>
            <div style="font-size:12.5px"><b>💰 السعر:</b> ${formatMoney(c.product_price || 0)}</div>
          </div>
        </div>

        ${c.purchase_location ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px">📍 مكان الشراء: ${escapeHtml(c.purchase_location)}</div>` : ""}

        ${c.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:8px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px">💬 ${escapeHtml(c.notes)}</div>` : ""}

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
          <button onclick="viewComplaint('${c.id}')" class="btn btn-primary" style="flex:1;min-width:110px;font-size:12px;padding:9px 12px">👁 عرض</button>
          ${c.status === "PENDING" ? `
            <button onclick="updateComplaintStatus('${c.id}','REVIEWING')" class="btn btn-ghost" style="flex:1;min-width:110px;font-size:12px;padding:9px 12px">🔍 مراجعة</button>
          ` : ""}
          ${c.status !== "VERIFIED" && c.status !== "REJECTED" ? `
            <button onclick="updateComplaintStatus('${c.id}','VERIFIED')" class="btn btn-success" style="flex:1;min-width:110px;font-size:12px;padding:9px 12px">✅ تأكيد</button>
            <button onclick="updateComplaintStatus('${c.id}','REJECTED')" class="btn btn-danger" style="flex:1;min-width:110px;font-size:12px;padding:9px 12px">❌ رفض</button>
          ` : ""}
          <button onclick="deleteComplaint('${c.id}')" class="btn btn-ghost" style="flex:1;min-width:110px;font-size:12px;padding:9px 12px;background:var(--danger-soft);color:var(--danger)">🗑️ حذف</button>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ─── تصدير Excel ───
function exportComplaintsToExcel() {
  if (!allComplaints || allComplaints.length === 0) {
    window.toast("لا توجد بيانات", "error");
    return;
  }

  const statusLabels = {
    PENDING: "معلقة",
    REVIEWING: "قيد المراجعة",
    VERIFIED: "مؤكدة",
    RESOLVED: "تم الحل",
    REJECTED: "مرفوضة"
  };

  const search = ($("complaintsSearch")?.value || "").toLowerCase().trim();
  let list = [...allComplaints];

  if (currentComplaintsFilter === "pending") list = list.filter(c => c.status === "PENDING");
  else if (currentComplaintsFilter === "reviewing") list = list.filter(c => c.status === "REVIEWING");
  else if (currentComplaintsFilter === "verified") list = list.filter(c => c.status === "VERIFIED" || c.status === "RESOLVED");
  else if (currentComplaintsFilter === "rejected") list = list.filter(c => c.status === "REJECTED");

  if (search) {
    list = list.filter(c =>
      (c.product_code || "").toLowerCase().includes(search) ||
      (c.customer_name || "").toLowerCase().includes(search) ||
      (c.shop_name || "").toLowerCase().includes(search) ||
      (c.customer_phone || "").toLowerCase().includes(search)
    );
  }

  if (currentComplaintsWilaya) {
    list = list.filter(c => c.customer_wilaya === currentComplaintsWilaya);
  }

  if (currentComplaintsDateRange !== "all") {
    const days = parseInt(currentComplaintsDateRange, 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    list = list.filter(c => c.created_at && new Date(c.created_at) >= since);
  }

  const rows = list.map(c => ({
    "التاريخ": c.created_at ? new Date(c.created_at).toLocaleString("fr-FR") : "",
    "الحالة": statusLabels[c.status] || c.status,
    "المحل": c.shop_name || "",
    "الكود": c.product_code || "",
    "اسم الزبون": c.customer_name || "",
    "الهاتف": c.customer_phone || "",
    "الولاية": c.customer_wilaya || "",
    "السعر (دج)": c.product_price || 0,
    "مكان الشراء": c.purchase_location || "",
    "ملاحظات": c.notes || "",
    "عدد الصور": c.image_count || 0,
    "ملاحظات الأدمن": c.admin_notes || ""
  }));

  downloadExcel(rows, "شكاوى_المحلات", "الشكاوى");
  window.toast(`✅ تم تصدير ${rows.length} شكوى`, "success");
}

// ─── حذف شكوى ───
window.deleteComplaint = async function(id) {
  if (!confirm("⚠️ حذف هذه الشكوى نهائيًا؟")) return;

  try {
    const { error } = await sb
      .from("shop_complaints")
      .delete()
      .eq("id", id);

    if (error) throw error;

    window.toast("✅ تم الحذف", "success");
    loadShopComplaints();
  } catch (e) {
    console.error("deleteComplaint error:", e);
    window.toast("خطأ: " + e.message, "error");
  }
};

// ─── عرض تفاصيل شكوى ───
window.viewComplaint = async function(id) {
  const complaint = allComplaints.find(c => c.id === id);
  if (!complaint) {
    window.toast("الشكوى غير موجودة", "error");
    return;
  }

  const w = window.open("", "_blank");
  const images = complaint.images || [];
  const date = complaint.created_at ? new Date(complaint.created_at).toLocaleString("fr-FR") : "—";

  const imagesHtml = images.map((img, i) => `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px;">صورة ${i + 1}</div>
      <img src="${escapeHtml(img)}" style="max-width:100%;border-radius:12px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open(this.src,'_blank')">
    </div>
  `).join("");

  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>شكوى — ${escapeHtml(complaint.product_code || id.slice(0,8))}</title>
<style>
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; padding: 20px; color: #0f172a; max-width: 900px; margin: 0 auto; background: #f8fafc; }
  .toolbar { background: #0f172a; color: #fff; padding: 12px; text-align: center; border-radius: 8px; margin-bottom: 24px; position: sticky; top: 0; z-index: 10; }
  .toolbar button { background: #16a34a; color: #fff; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
  .card { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 15px; margin: 0 0 14px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
  .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .info-row:last-child { border-bottom: 0; }
  .info-row b { color: #64748b; font-weight: 700; }
  .info-row span { font-weight: 800; }
  @media print { .toolbar { display: none; } body { background: #fff; padding: 0; } .card { box-shadow: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨 طباعة</button>
  </div>

  <div class="card">
    <h1>🚨 شكوى على محل</h1>
    <div style="color:#64748b;font-size:13px;margin-bottom:20px;">${escapeHtml(date)}</div>

    <h2>معلومات المحل</h2>
    <div class="info-row"><b>🏪 المحل:</b><span>${escapeHtml(complaint.shop_name || "—")}</span></div>
    <div class="info-row"><b>📦 الكود:</b><span style="font-family:monospace">${escapeHtml(complaint.product_code || "—")}</span></div>
    <div class="info-row"><b>💰 السعر:</b><span>${complaint.product_price || 0} دج</span></div>
    ${complaint.purchase_location ? `<div class="info-row"><b>📍 مكان الشراء:</b><span>${escapeHtml(complaint.purchase_location)}</span></div>` : ""}
  </div>

  <div class="card">
    <h2>معلومات الزبون</h2>
    <div class="info-row"><b>👤 الاسم:</b><span>${escapeHtml(complaint.customer_name || "—")}</span></div>
    <div class="info-row"><b>📱 الهاتف:</b><span>${escapeHtml(complaint.customer_phone || "—")}</span></div>
    <div class="info-row"><b>📍 الولاية:</b><span>${escapeHtml(complaint.customer_wilaya || "—")}</span></div>
    ${complaint.notes ? `<div class="info-row"><b>💬 ملاحظات:</b><span>${escapeHtml(complaint.notes)}</span></div>` : ""}
  </div>

  <div class="card">
    <h2>📸 صور المنتج (${images.length})</h2>
    ${imagesHtml || '<p style="color:#94a3b8;text-align:center;">لا توجد صور</p>'}
  </div>
</body>
</html>`);
  w.document.close();
};

// ─── تحديث حالة الشكوى ───
window.updateComplaintStatus = async function(id, newStatus) {
  const statusLabels = {
    REVIEWING: "قيد المراجعة",
    VERIFIED: "مؤكدة",
    REJECTED: "مرفوضة",
    RESOLVED: "تم الحل"
  };

  if (!confirm(`تغيير الحالة إلى "${statusLabels[newStatus] || newStatus}"؟`)) return;

  let adminNotes = null;
  let deductAmount = 0;

  if (newStatus === "VERIFIED") {
    const complaint = allComplaints.find(c => c.id === id);
    adminNotes = prompt("ملاحظات (اختياري):") || null;

    if (complaint && complaint.shop_id) {
      const deductStr = prompt(
        `💰 خصم من عربون المحل (اختياري)\n\nالسعر المدفوع: ${complaint.product_price || 0} دج\nاقتراح (50%): ${Math.round((complaint.product_price || 0) * 0.5)} دج\n\nأدخل المبلغ أو 0 لعدم الخصم:`,
        "0"
      );
      deductAmount = parseFloat(deductStr) || 0;
    }
  } else if (newStatus === "REJECTED") {
    adminNotes = prompt("سبب الرفض (اختياري):") || null;
  }

  try {
    const { data, error } = await sb.rpc("admin_update_complaint", {
      p_complaint_id: id,
      p_new_status: newStatus,
      p_admin_notes: adminNotes,
      p_deduct_amount: deductAmount
    });

    if (error) throw error;
    if (data.status !== "OK") {
      window.toast("خطأ: " + (data.message || ""), "error");
      return;
    }

    window.toast(`✅ تم تحديث الحالة${deductAmount > 0 ? ` + خصم ${deductAmount} دج` : ""}`, "success");
    loadShopComplaints();
  } catch (e) {
    console.error("updateComplaintStatus error:", e);
    window.toast("خطأ: " + e.message, "error");
  }
};

// ============================================================
// 🏪 SHOP BATCH
// ============================================================
async function loadShopsForSelect() {
  const sel = $("shopBatchSelect");
  if (!sel) return;

  try {
    const { data, error } = await sb
      .from("verified_shops")
      .select("id, shop_name, status")
      .eq("status", "ACTIVE")
      .order("shop_name");

    if (error) throw error;

    let html = `<option value="">-- اختر المحل --</option>`;
    (data || []).forEach(s => {
      html += `<option value="${s.id}">🏪 ${escapeHtml(s.shop_name)}</option>`;
    });
    sel.innerHTML = html;
  } catch (e) {
    console.warn("loadShopsForSelect error:", e);
  }
}

async function checkBatchShopStatus(lot) {
  try {
    const { data, error } = await sb
      .from("qr_codes")
      .select("is_shop_lot, shop_name, product_price")
      .eq("lot", lot)
      .limit(1)
      .single();

    if (error || !data) return;

    const toggle = $("shopBatchToggle");
    const fields = $("shopBatchFields");
    const price = $("shopBatchPrice");
    const sel = $("shopBatchSelect");

    if (!toggle || !fields) return;

    if (data.is_shop_lot === true) {
      toggle.checked = true;
      fields.classList.remove("hidden");
      if (price) price.value = data.product_price || "";
      await loadShopsForSelect();
      if (sel && data.shop_name) {
        const option = Array.from(sel.options).find(o => o.text.includes(data.shop_name));
        if (option) sel.value = option.value;
      }
    } else {
      toggle.checked = false;
      fields.classList.add("hidden");
      if (price) price.value = "";
    }
  } catch (e) {
    console.warn("checkBatchShopStatus:", e);
  }
}

// ============================================================
// PRINT (Labels + Invoice)
// ============================================================
function printLabels(codes, brand, lot, logoUrl) {
  if (!codes || !codes.length) { window.toast("Aucun code.", "error"); return; }
  const mode = ($("printMode") && $("printMode").value) || "labels";
  const url = location.origin + "/verify";
  const w = window.open("", "_blank");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

  if (mode === "list") {
    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste</title><style>@page{margin:12mm}body{font-family:Arial;padding:15px;margin:0}.toolbar{background:#111;color:#fff;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px}.toolbar button{background:#fff;color:#111;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer}.header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #111}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#111;color:#fff;padding:10px 8px;text-align:left}td{padding:9px 8px;border-bottom:1px solid #e5e7eb}.code-cell{font-family:'Courier New';font-weight:bold;font-size:15px;letter-spacing:3px}@media print{.toolbar{display:none!important}}</style></head><body>
      <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
      <div class="header">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:50px;margin-bottom:10px">` : ""}<h1>${escapeHtml(brand)}</h1><p>Lot: ${escapeHtml(lot)} — Total: ${codes.length}</p></div>
      <table><thead><tr><th>#</th><th>Code</th></tr></thead><tbody>`;
    codes.forEach((code, i) => { html += `<tr><td>${i + 1}</td><td class="code-cell">${escapeHtml(code)}</td></tr>`; });
    html += `</tbody></table></body></html>`;
    w.document.write(html); w.document.close(); return;
  }

  const size = ($("labelSize") && $("labelSize").value) || "60x90";
  let labelWidth = "60mm", labelHeight = "90mm", qrSize = "34mm", codeFontSize = "13px", brandFontSize = "11px";
  if (size === "50x50") { labelWidth = "50mm"; labelHeight = "50mm"; qrSize = "22mm"; codeFontSize = "9px"; brandFontSize = "8px"; }
  else if (size === "70x50") { labelWidth = "70mm"; labelHeight = "50mm"; qrSize = "28mm"; codeFontSize = "11px"; brandFontSize = "10px"; }

  let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Impression</title><style>@page{margin:8mm}body{font-family:Arial;padding:10px;margin:0;background:#f5f5f5}.toolbar{background:#111;color:#fff;padding:12px;text-align:center;margin-bottom:15px;border-radius:8px}.toolbar button{background:#fff;color:#111;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer}.info{font-size:12px;color:#333;margin:15px 0;padding:14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px}.sheet{display:flex;flex-wrap:wrap;gap:4mm;background:#fff;padding:10px;border-radius:8px}.label{width:${labelWidth};height:${labelHeight};border:1px dashed #bbb;display:flex;flex-direction:column;page-break-inside:avoid;background:#fff;position:relative;border-radius:3mm;overflow:hidden}.label-top{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3mm;text-align:center}.label-logo{max-height:8mm;max-width:40mm;margin-bottom:1.5mm}.label-brand{font-size:${brandFontSize};font-weight:bold;letter-spacing:2px;margin-bottom:2mm}.label-qr{width:${qrSize};height:${qrSize}}.label-inst{font-size:7px;color:#666;margin-top:2mm}.label-fold{height:6mm;display:flex;align-items:center;justify-content:center;font-size:6px;color:#888;border-top:1px dashed #666;border-bottom:1px dashed #666;background:repeating-linear-gradient(45deg,#f0f0f0,#f0f0f0 3px,#e8e8e8 3px,#e8e8e8 6px)}.label-bottom{height:28mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;text-align:center}.label-code{font-family:'Courier New';font-size:${codeFontSize};font-weight:bold;letter-spacing:3px;padding:1.5mm 3mm;border:1px solid #ddd;border-radius:2mm;background:#fafafa}.label-hint{font-size:5.5px;color:#999;margin-top:1.5mm;font-style:italic}@media print{.toolbar,.info{display:none!important}.sheet{padding:0;gap:2mm}}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
  <div class="info"><b>📋 MODE D'EMPLOI :</b> Pliez le long de la ligne pointillée.</div>
  <div class="sheet">`;

  codes.forEach(code => {
    html += `<div class="label"><div class="label-top">${logoUrl ? `<img class="label-logo" src="${escapeHtml(logoUrl)}">` : ""}<div class="label-brand">${escapeHtml(brand)}</div><img class="label-qr" src="${qrUrl}"><div class="label-inst">Scannez puis entrez le code</div></div><div class="label-fold">✂ - - - PLIEZ ICI - - - ✂</div><div class="label-bottom"><div class="label-code">${escapeHtml(code)}</div><div class="label-hint">Ne pas révéler avant l'achat</div></div></div>`;
  });
  html += `</div></body></html>`;
  w.document.write(html); w.document.close();
}

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
    if (data.status !== "OK") { window.toast("Erreur : " + (data.message || ""), "error"); return; }

    const o = data.order;
    const w = window.open("", "_blank");
    const itemsRows = (o.items || []).map(it => `<tr><td>Lot ${escapeHtml(it.lot_number)}</td><td style="text-align:right">${it.quantity}</td></tr>`).join("");
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";
    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${escapeHtml(o.order_number)}</title>
    <style>@page{margin:15mm}*{box-sizing:border-box}body{font-family:-apple-system,Arial;padding:20px;margin:0;color:#0f172a;background:#f8fafc}.toolbar{background:#0f172a;color:#fff;padding:12px;text-align:center;margin-bottom:20px;border-radius:8px}.toolbar button{background:#16a34a;color:#fff;border:0;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px}.invoice{background:#fff;border-radius:12px;padding:30px;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08)}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #0f172a;flex-wrap:wrap;gap:20px}.brand-info h1{margin:0 0 8px;font-size:24px}.brand-info p{margin:4px 0;font-size:13px;color:#64748b}.invoice-meta{text-align:right}.invoice-meta h2{margin:0 0 8px;font-size:20px;color:#16a34a;font-family:'Courier New'}.invoice-meta p{margin:4px 0;font-size:13px}.client-info{margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:10px}.client-info h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b}.client-info p{margin:4px 0;font-size:14px}.items-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}.items-table th{background:#0f172a;color:#fff;padding:12px 10px;text-align:left;font-size:11px}.items-table td{padding:12px 10px;border-bottom:1px solid #e2e8f0}.totals{margin-top:24px;margin-left:auto;max-width:320px}.totals-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;border-bottom:1px dashed #e2e8f0}.totals-row.grand-total{padding:16px 0;font-size:20px;font-weight:900;border-top:3px solid #0f172a;border-bottom:3px solid #0f172a;color:#16a34a}.footer-info{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center}@media print{.toolbar{display:none!important}body{background:#fff;padding:0}.invoice{box-shadow:none;padding:0}}</style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER LA FACTURE</button></div>
    <div class="invoice">
      <div class="header"><div class="brand-info"><h1>👑 Original</h1><p>+213 556 339 415</p><p>mepirf@gmail.com</p></div><div class="invoice-meta"><h2>${escapeHtml(o.order_number)}</h2><p><b>Date:</b> ${escapeHtml(date)}</p></div></div>
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
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

// ============================================================
// EXCEL
// ============================================================
function downloadExcel(data, filename, sheetName) {
  if (!data || data.length === 0) { window.toast("Aucune donnée.", "error"); return; }
  if (typeof XLSX === "undefined") { window.toast("XLSX non chargé.", "error"); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");
  const keys = Object.keys(data[0]);
  ws["!cols"] = keys.map(k => {
    let maxLen = k.length;
    data.forEach(row => { const v = String(row[k] || ""); if (v.length > maxLen) maxLen = v.length; });
    return { wch: Math.min(maxLen + 2, 50) };
  });
  XLSX.writeFile(wb, filename + "_" + new Date().toISOString().slice(0, 10) + ".xlsx");
}

// ============================================================
// EVENT LISTENERS
// ============================================================
const _lfb = $("loginForm");

async function refresh() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    const lp = $("loginPage"); if (lp) lp.classList.remove("hidden");
    const aa = $("adminApp"); if (aa) aa.classList.add("hidden");
    return;
  }

  const isAdmin = await checkAdminServer(session.access_token);

  if (!isAdmin) {
    await sb.auth.signOut();
    const lp = $("loginPage"); if (lp) lp.classList.remove("hidden");
    const aa = $("adminApp"); if (aa) aa.classList.add("hidden");
    const el = $("loginError");
    if (el) {
      el.className = "result danger";
      el.innerHTML = `<p style="margin:0">⛔ Ce compte n'est pas autorisé.</p>`;
      el.classList.remove("hidden");
    }
    return;
  }

  const lp = $("loginPage"); if (lp) lp.classList.add("hidden");
  const aa = $("adminApp"); if (aa) aa.classList.remove("hidden");

  const url = location.origin + "/verify";
  const pu = $("publicUrl"); if (pu) pu.textContent = url;
  const qr = $("qr");
  if (qr && qr.innerHTML.trim() === "") new QRCode(qr, { text: url, width: 180, height: 180 });

  loadStats();
  loadLog();
  loadFeedback();
  loadCharts();
  loadMessagesBadge();
  loadFakesBadge();
}

refresh();
window.__adminRefresh = refresh;

if (_lfb) _lfb.addEventListener("submit", async (e) => {
  e.preventDefault();
  const emailInput = $("email").value.trim();
  const passwordInput = $("password").value;
  const el = $("loginError");

  const lb = $("loginBtn");
  if (lb) { lb.disabled = true; lb.textContent = "CONNEXION..."; }

  const { data, error } = await sb.auth.signInWithPassword({ email: emailInput, password: passwordInput });

  if (error) {
    if (lb) { lb.disabled = false; lb.textContent = "SE CONNECTER"; }
    if (el) { el.className = "result danger"; el.innerHTML = `<p style="margin:0">${escapeHtml(error.message)}</p>`; el.classList.remove("hidden"); }
    return;
  }

  const isAdmin = await checkAdminServer(data.session.access_token);

  if (!isAdmin) {
    await sb.auth.signOut();
    if (lb) { lb.disabled = false; lb.textContent = "SE CONNECTER"; }
    if (el) { el.className = "result danger"; el.innerHTML = `<p style="margin:0">⛔ Ce compte n'est pas autorisé.</p>`; el.classList.remove("hidden"); }
    return;
  }

  if (el) el.classList.add("hidden");
  if (lb) { lb.disabled = false; lb.textContent = "SE CONNECTER"; }
  refresh();
});

const _lb = $("logoutBtn");
if (_lb) _lb.onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

const _rlb = $("refreshLogBtn");
if (_rlb) _rlb.onclick = () => loadLog();

const _rfb = $("refreshFeedbackBtn");
if (_rfb) _rfb.onclick = () => loadFeedback();

const _rbb = $("refreshBrandsBtn");
if (_rbb) _rbb.onclick = () => loadBrands();

const _rsb = $("refreshShopsBtn");
if (_rsb) _rsb.onclick = () => loadShops();

const _ecb = $("exportComplaintsBtn");
if (_ecb) _ecb.onclick = () => exportComplaintsToExcel();

const _rcb = $("refreshComplaintsBtn");
if (_rcb) _rcb.onclick = () => loadShopComplaints();

const _csi = $("complaintsSearch");
if (_csi) {
  let _cTimer;
  _csi.addEventListener("input", () => {
    clearTimeout(_cTimer);
    _cTimer = setTimeout(renderShopComplaints, 300);
  });
}

const _cwb = $("complaintsWilaya");
if (_cwb) _cwb.addEventListener("change", () => {
  currentComplaintsWilaya = _cwb.value;
  renderShopComplaints();
});

const _cdt = $("complaintsDate");
if (_cdt) _cdt.addEventListener("change", () => {
  currentComplaintsDateRange = _cdt.value;
  renderShopComplaints();
});

const _ssi = $("shopsSearch");
if (_ssi) {
  let _shopTimer;
  _ssi.addEventListener("input", () => {
    clearTimeout(_shopTimer);
    _shopTimer = setTimeout(renderShopsList, 300);
  });
}

const _rvb = $("refreshVisitorsBtn");
if (_rvb) _rvb.onclick = () => loadVisitors();

const _rfb2 = $("refreshFakesBtn");
if (_rfb2) _rfb2.onclick = () => { loadFakes(); loadFakesBadge(); };

const _rfaq = $("refreshFaqBtn");
if (_rfaq) _rfaq.onclick = () => loadFAQ();

const _rob = $("refreshOrdersBtn");
if (_rob) _rob.onclick = () => loadOrders();

const _rdebts = $("refreshDebtsBtn");
if (_rdebts) _rdebts.onclick = () => loadDebts();

const _rinv = $("refreshInventoryBtn");
if (_rinv) _rinv.onclick = () => loadInventory();

const _rmb = $("refreshMessagesBtn");
if (_rmb) _rmb.onclick = () => { loadMessages(); loadMessagesBadge(); };

// Tabs
document.querySelectorAll(".tabs .tab").forEach(t => {
  t.addEventListener("click", () => {
    const parent = t.parentElement;
    parent.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");

    if (parent.id === "feedbackTabs") { currentFeedbackFilter = t.dataset.tab; loadFeedback(); }
    else if (parent.id === "messagesTabs") { currentMessagesFilter = t.dataset.tab; loadMessages(); }
    else if (parent.id === "visitorTabs") { currentVisitorFilter = t.dataset.tab; loadVisitors(); }
    else if (parent.id === "fakesTabs") { currentFakesFilter = t.dataset.tab; loadFakes(); }
    else if (parent.id === "shopsTabs") { currentShopsTab = t.dataset.tab; renderShopsList(); }
    else if (parent.id === "complaintsTabs") { currentComplaintsFilter = t.dataset.tab; renderShopComplaints(); }
  });
});

// ============================================================
// CREATE BATCH
// ============================================================
const _cb = $("createBtn");
if (_cb) _cb.onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.toast("Connectez-vous.", "error"); return; }

  const brand = $("brand").value.trim();
  if (!brand) { window.toast("Marque obligatoire.", "error"); return; }

  const qty = Math.min(10000, Math.max(1, Number($("quantity").value) || 1));
  const statusRadio = document.querySelector('input[name="initial_status"]:checked');
  const initialStatus = statusRadio ? statusRadio.value : "PENDING";

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

const _pb = $("printBtn");
if (_pb) _pb.onclick = () => {
  printLabels(lastCodes, $("brand").value.trim() || "MARQUE", $("lot").value.trim() || "", lastLogo);
};

const _enlb = $("exportNewLotBtn");
if (_enlb) _enlb.onclick = () => {
  if (!lastCodes || lastCodes.length === 0) { window.toast("Aucun code.", "error"); return; }
  const brand = $("brand").value.trim() || "MARQUE";
  const lot = $("lot").value.trim() || "—";
  const rows = lastCodes.map((code, i) => ({ "#": i + 1, "Code": code, "Statut": "UNUSED", "Lot": lot, "Marque": brand }));
  downloadExcel(rows, "Codes_" + lot, "Codes");
};

// ============================================================
// SEARCH
// ============================================================
const _sBtn = $("searchBtn");
if (_sBtn) _sBtn.onclick = async () => {
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
  const cls = r.secret_status === "UNUSED" ? "success" : r.secret_status === "USED" ? "warning" : "danger";
  res.className = "result " + cls;
  res.innerHTML = `<h2>${escapeHtml(r.secret_status || "—")}</h2>
    <div class="details">
      ${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}
      ${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}
    </div>`;
};

// ============================================================
// LOAD LOT
// ============================================================
const _llb = $("loadLotBtn");
if (_llb) _llb.onclick = async () => {
  const lot = ($("editLotSearch").value || "").trim();
  const info = $("lotInfo");
  if (!info) return;

  if (!lot) {
    info.className = "result danger";
    info.innerHTML = `<p>Entrez un lot.</p>`;
    return;
  }

  info.className = "result";
  info.innerHTML = `<p>Chargement...</p>`;

  const { data, error } = await sb.from("qr_codes").select("*").eq("lot", lot).limit(10000);
  if (error || !data || data.length === 0) {
    info.className = "result danger";
    info.innerHTML = `<h2>AUCUN RÉSULTAT</h2>`;
    return;
  }

  const r = data[0];
  loadedLot = lot;
  loadedLotBrand = r.brand || "MARQUE";
  loadedLotLot = r.lot || lot;
  loadedLotLogo = r.logo_url || "";

  info.className = "result success";
  info.innerHTML = `<h2>${data.length} code(s)</h2>`;

  showBatchStatus(data.map(row => row.secret_status));
  const plb = $("printLotBtn"); if (plb) plb.classList.remove("hidden");
  const eb = $("exportLotCodesBtn"); if (eb) eb.classList.remove("hidden");

  const shopBox = $("shopBatchBox");
  if (shopBox) shopBox.classList.remove("hidden");
  checkBatchShopStatus(lot);
};

function showBatchStatus(statuses) {
  const box = $("batchStatusBox");
  const badge = $("batchStatusBadge");
  const actionsBox = $("batchActionsBox");
  const actBtn = $("activateBatchBtn");
  const disBtn = $("disableBatchBtn");
  if (!box || !badge || !actionsBox) return;

  const counts = { PENDING: 0, UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0 };
  statuses.forEach(s => { if (counts[s] !== undefined) counts[s]++; });

  let label = "—", color = "var(--text)", bg = "var(--bg-secondary)";
  if (counts.PENDING > 0 && counts.UNUSED === 0 && counts.USED === 0) { label = `⏳ EN ATTENTE — ${counts.PENDING}`; color = "var(--warning)"; bg = "var(--warning-soft)"; }
  else if (counts.UNUSED > 0) { label = `🟢 ACTIF — ${counts.UNUSED}`; color = "var(--success)"; bg = "var(--success-soft)"; }
  else if (counts.USED > 0) { label = `🔵 UTILISÉ — ${counts.USED}`; color = "var(--primary)"; bg = "var(--primary-soft)"; }
  else if (counts.DISABLED > 0) { label = `🔴 DÉSACTIVÉ — ${counts.DISABLED}`; color = "var(--danger)"; bg = "var(--danger-soft)"; }

  badge.textContent = label;
  badge.style.color = color;
  box.style.background = bg;
  box.classList.remove("hidden");
  if (actBtn) actBtn.style.display = counts.PENDING > 0 ? "block" : "none";
  if (disBtn) disBtn.style.display = counts.UNUSED > 0 ? "block" : "none";
  actionsBox.classList.toggle("hidden", counts.PENDING === 0 && counts.UNUSED === 0);
}

const _actBtn = $("activateBatchBtn");
if (_actBtn) _actBtn.onclick = async () => {
  if (!loadedLot) return;
  if (!confirm(`Activer le lot "${loadedLot}" ?`)) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const res = await fetch("/api/batch-actions?action=activate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const result = await res.json();
    if (result.status === "OK") { window.toast("✅ " + result.message, "success"); $("loadLotBtn").click(); }
    else window.toast("Erreur : " + (result.message || ""), "error");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

const _disBtn = $("disableBatchBtn");
if (_disBtn) _disBtn.onclick = async () => {
  if (!loadedLot) return;
  if (!confirm(`Désactiver le lot "${loadedLot}" ?`)) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const res = await fetch("/api/batch-actions?action=disable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const result = await res.json();
    if (result.status === "OK") { window.toast("🛑 " + result.message, "success"); $("loadLotBtn").click(); }
    else window.toast("Erreur : " + (result.message || ""), "error");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

// 🏪 Shop batch handlers
const _sbt = $("shopBatchToggle");
if (_sbt) {
  _sbt.addEventListener("change", async () => {
    const fields = $("shopBatchFields");
    if (!fields) return;
    if (_sbt.checked) {
      fields.classList.remove("hidden");
      await loadShopsForSelect();
    } else {
      fields.classList.add("hidden");
    }
  });
}

const _asb = $("applyShopBatchBtn");
if (_asb) {
  _asb.onclick = async () => {
    if (!loadedLot) { window.toast("حمّل دفعة أولًا", "error"); return; }
    const shopId = $("shopBatchSelect")?.value;
    const price = parseFloat($("shopBatchPrice")?.value || 0);

    if (!shopId) { window.toast("اختر المحل", "error"); return; }
    if (!price || price <= 0) { window.toast("أدخل سعرًا صحيحًا", "error"); return; }

    _asb.disabled = true;
    _asb.textContent = "⏳...";

    try {
      const { data, error } = await sb.rpc("admin_mark_shop_batch", {
        p_lot: loadedLot,
        p_shop_id: shopId,
        p_product_price: price
      });

      if (error) throw error;
      if (data.status !== "OK") {
        window.toast("خطأ: " + (data.message || ""), "error");
        return;
      }

      window.toast(`✅ تم الربط: ${data.updated} كود → ${data.shop_name}`, "success");

      const resBox = $("shopBatchResult");
      if (resBox) {
        resBox.className = "result success";
        resBox.innerHTML = `<h2>✅ تم الربط</h2><p>${data.updated} كود → ${escapeHtml(data.shop_name)}</p><p>السعر: ${formatMoney(data.product_price)}</p>`;
      }
    } catch (e) {
      window.toast("خطأ: " + e.message, "error");
    } finally {
      _asb.disabled = false;
      _asb.textContent = "✅ تطبيق على كل الأكواد";
    }
  };
}

const _rsb2 = $("removeShopBatchBtn");
if (_rsb2) {
  _rsb2.onclick = async () => {
    if (!loadedLot) return;
    if (!confirm("إلغاء ربط هذه الدفعة بالمحل؟")) return;

    _rsb2.disabled = true;
    try {
      const { data, error } = await sb.rpc("admin_unmark_shop_batch", {
        p_lot: loadedLot
      });

      if (error) throw error;
      if (data.status !== "OK") {
        window.toast("خطأ: " + (data.message || ""), "error");
        return;
      }

      window.toast(`✅ أُلغي الربط عن ${data.updated} كود`, "info");
      if ($("shopBatchToggle")) $("shopBatchToggle").checked = false;
      if ($("shopBatchFields")) $("shopBatchFields").classList.add("hidden");
    } catch (e) {
      window.toast("خطأ: " + e.message, "error");
    } finally {
      _rsb2.disabled = false;
    }
  };
}

const _plb = $("printLotBtn");
if (_plb) _plb.onclick = async () => {
  if (!loadedLot) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const res = await fetch("/api/batch-manager?action=print", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const data = await res.json();
    if (data.status !== "OK") { window.toast("Erreur : " + (data.message || ""), "error"); return; }
    const codes = (data.codes || []).map(c => c.code).filter(Boolean);
    if (codes.length === 0) { window.toast("Aucun code.", "error"); return; }

    try {
      await sb.rpc("admin_add_inventory_movement", {
        p_type: "OUT", p_quantity: -Math.abs(codes.length),
        p_reason: `Impression lot ${loadedLot}`,
        p_reference: `${data.brand || loadedLotBrand || "?"} - Lot ${loadedLot}`
      });
    } catch (e) { console.warn(e); }

    printLabels(codes, data.brand || loadedLotBrand || "MARQUE", data.lot || loadedLotLot, data.logo_url || loadedLotLogo);
  } catch (err) { window.toast("Erreur : " + err.message, "error"); }
};

const _elcb = $("exportLotCodesBtn");
if (_elcb) _elcb.onclick = async () => {
  if (!loadedLot) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const res = await fetch("/api/batch-manager?action=print", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });
    const data = await res.json();
    if (data.status !== "OK") { window.toast("Erreur", "error"); return; }
    const rows = (data.codes || []).map((c, i) => ({ "#": i + 1, "Code": c.code, "Statut": c.status || "UNUSED", "Lot": data.lot || loadedLot, "Marque": data.brand || loadedLotBrand }));
    downloadExcel(rows, "Codes_" + loadedLot, "Codes");
  } catch (err) { window.toast("Erreur : " + err.message, "error"); }
};

// ============================================================
// ADV SEARCH buttons
// ============================================================
const _advBtn = $("advSearchBtn");
if (_advBtn) _advBtn.onclick = () => loadAdvancedSearch();

const _advReset = $("advResetBtn");
if (_advReset) _advReset.onclick = () => {
  ["advSearchText", "advSearchStatus", "advSearchDateFrom", "advSearchDateTo"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("advSearchLimit")) $("advSearchLimit").value = "100";
  const rb = $("advSearchResults"); if (rb) rb.innerHTML = "";
  const sb2 = $("advSearchStats"); if (sb2) sb2.style.display = "none";
  advSearchData = [];
};

const _advExport = $("advExportBtn");
if (_advExport) _advExport.onclick = () => {
  if (!advSearchData || advSearchData.length === 0) { window.toast("Aucun résultat.", "error"); return; }
  const rows = advSearchData.map(r => ({ "Code": r.secret_code || "", "Statut": r.secret_status || "", "Marque": r.brand || "", "Lot": r.lot || "" }));
  downloadExcel(rows, "Recherche_Avancee", "Résultats");
};

// ============================================================
// DEBTS filters
// ============================================================
["debtsSearch", "debtsSort", "debtsAge"].forEach(id => {
  const el = $(id); if (!el) return;
  if (id === "debtsSearch") {
    let timer; el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadDebts, 400); });
  } else el.addEventListener("change", loadDebts);
});

// ============================================================
// ORDERS filters
// ============================================================
["ordersSearch", "ordersStatus", "ordersPayment"].forEach(id => {
  const el = $(id); if (!el) return;
  if (id === "ordersSearch") {
    let timer; el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadOrders, 400); });
  } else el.addEventListener("change", loadOrders);
});

// ============================================================
// INVENTORY actions
// ============================================================
$("addStockBtn")?.addEventListener("click", async () => {
  const qtyStr = prompt("📥 Combien d'étiquettes avez-vous reçu ?");
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty <= 0) { window.toast("Quantité invalide", "error"); return; }
  const reason = prompt("📝 Raison :", "Réception usine") || "Réception";
  try {
    const { data, error } = await sb.rpc("admin_add_inventory_movement", { p_type: "IN", p_quantity: qty, p_reason: reason, p_reference: null });
    if (error) throw error;
    if (data?.status === "OK") { window.toast(`✅ +${qty}`, "success"); loadInventory(); }
    else window.toast("Erreur : " + (data?.message || ""), "error");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
});

$("adjustStockBtn")?.addEventListener("click", async () => {
  const qtyStr = prompt("⚙️ Ajustement (+ pour ajouter, - pour retirer)");
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty === 0) { window.toast("Quantité invalide", "error"); return; }
  const reason = prompt("📝 Raison :", "Ajustement") || "Ajustement";
  try {
    const { data, error } = await sb.rpc("admin_add_inventory_movement", { p_type: "ADJUST", p_quantity: qty, p_reason: reason, p_reference: null });
    if (error) throw error;
    if (data?.status === "OK") { window.toast(`✅ ${qty > 0 ? "+" : ""}${qty}`, "success"); loadInventory(); }
    else window.toast("Erreur", "error");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
});

$("settingsStockBtn")?.addEventListener("click", async () => {
  const current = inventoryData?.min_stock || 1000;
  const qtyStr = prompt(`🔧 Seuil d'alerte\n\nActuel : ${current}`, current);
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  if (isNaN(qty) || qty < 0) { window.toast("Valeur invalide", "error"); return; }
  try {
    const { data, error } = await sb.rpc("admin_update_inventory_settings", { p_min_stock: qty });
    if (error) throw error;
    if (data?.status === "OK") { window.toast(`✅ Seuil : ${qty}`, "success"); loadInventory(); }
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
});

// ============================================================
// FAQ form
// ============================================================
$("addFaqBtn")?.addEventListener("click", () => openFaqForm(null));
$("cancelFaqBtn")?.addEventListener("click", () => {
  resetFaqForm();
  const box = $("faqEditBox"); if (box) box.classList.add("hidden");
});

const _sfb = $("saveFaqBtn");
if (_sfb) _sfb.onclick = async () => {
  const qAr = ($("faqQuestionAr")?.value || "").trim();
  const aAr = ($("faqAnswerAr")?.value || "").trim();
  if (!qAr || qAr.length < 3) { window.toast("السؤال بالعربية مطلوب", "error"); return; }
  if (!aAr || aAr.length < 5) { window.toast("الجواب بالعربية مطلوب", "error"); return; }

  const payload = {
    question: qAr, answer: aAr,
    question_fr: ($("faqQuestionFr")?.value || "").trim() || null,
    answer_fr: ($("faqAnswerFr")?.value || "").trim() || null,
    question_en: ($("faqQuestionEn")?.value || "").trim() || null,
    answer_en: ($("faqAnswerEn")?.value || "").trim() || null,
    sort_order: parseInt($("faqSortOrder")?.value || "0", 10) || 0,
    is_active: $("faqIsActive")?.checked !== false,
    updated_at: new Date().toISOString()
  };

  _sfb.disabled = true; _sfb.textContent = "...";
  let error;
  if (editingFaqId) {
    const res = await sb.from("faq_items").update(payload).eq("id", editingFaqId);
    error = res.error;
  } else {
    const res = await sb.from("faq_items").insert(payload);
    error = res.error;
  }
  _sfb.disabled = false; _sfb.textContent = "💾 ENREGISTRER";
  if (error) { window.toast("Erreur : " + error.message, "error"); return; }
  resetFaqForm();
  const box = $("faqEditBox"); if (box) box.classList.add("hidden");
  loadFAQ();
};

// ============================================================
// DELETE lot
// ============================================================
const _pdb = $("previewDeleteBtn");
if (_pdb) _pdb.onclick = async () => {
  const lot = ($("deleteLotSearch").value || "").trim();
  const preview = $("deletePreview");
  const confirmBox = $("deleteConfirmBox");
  pendingDeleteLot = null;
  if (!lot) { if (preview) { preview.className = "result danger"; preview.innerHTML = `<p>Entrez un lot.</p>`; } return; }

  const { data, error } = await sb.from("qr_codes").select("secret_status").eq("lot", lot);
  if (error || !data || data.length === 0) {
    if (preview) { preview.className = "result danger"; preview.innerHTML = `<h2>AUCUN RÉSULTAT</h2>`; }
    return;
  }
  pendingDeleteLot = lot;
  pendingDeleteCount = data.length;
  if (preview) { preview.className = "result danger"; preview.innerHTML = `<h2>⚠️ PRÊT</h2><p>Lot : ${escapeHtml(lot)} — ${data.length} codes</p>`; }
  if ($("deleteConfirmInput")) $("deleteConfirmInput").value = "";
  if ($("confirmDeleteBtn")) $("confirmDeleteBtn").disabled = true;
  if (confirmBox) confirmBox.classList.remove("hidden");
};

$("deleteConfirmInput")?.addEventListener("input", (e) => {
  const v = e.target.value.trim().toUpperCase();
  const cdb = $("confirmDeleteBtn"); if (cdb) cdb.disabled = (v !== "DELETE");
});

const _cdb = $("confirmDeleteBtn");
if (_cdb) _cdb.onclick = async () => {
  if (!pendingDeleteLot) return;
  if ($("deleteConfirmInput").value.trim().toUpperCase() !== "DELETE") return;

  const lot = pendingDeleteLot;
  const count = pendingDeleteCount;
  _cdb.disabled = true;
  try {
    const { error } = await sb.from("qr_codes").delete().eq("lot", lot);
    if (error) throw error;
    try { await sb.from("qr_delete_logs").insert({ lot, count, action: "DELETE" }); } catch (e) {}
    const res = $("deleteResult");
    if (res) { res.className = "result success"; res.innerHTML = `<h2>✓ SUPPRESSION</h2><p>${count} codes supprimés</p>`; }
    if ($("deletePreview")) $("deletePreview").classList.add("hidden");
    if ($("deleteConfirmBox")) $("deleteConfirmBox").classList.add("hidden");
    if ($("deleteLotSearch")) $("deleteLotSearch").value = "";
    pendingDeleteLot = null;
    loadStats();
    loadCharts();
  } catch (err) { window.toast("Erreur : " + err.message, "error"); }
  finally { _cdb.disabled = false; }
};

// ============================================================
// NEW ORDER MODAL
// ============================================================
const _nob = $("newOrderBtn");
if (_nob) _nob.onclick = () => openNewOrderModal();

async function openNewOrderModal() {
  const modal = $("newOrderModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  ["orderBrand", "orderBrandPhone", "orderBrandEmail", "orderDeliveryCompany", "orderTrackingNumber", "orderWilaya", "orderBaladiya", "orderDeliveryAddress", "orderRecipientPhone", "orderShippingDate", "orderNotes"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("orderUnitPrice")) $("orderUnitPrice").value = "15";
  if ($("orderDiscount")) $("orderDiscount").value = "0";
  if ($("orderDeliveryCost")) $("orderDeliveryCost").value = "0";
  if ($("orderTva")) $("orderTva").value = "0";

  const deliveryRadio = document.querySelector('input[name="orderDeliveryMethod"][value="delivery"]');
  if (deliveryRadio) deliveryRadio.checked = true;

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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token })
    });
    const data = await res.json();
    if (data.status !== "OK") return;
    allBrandsCache = data.brands || [];
    const dl = $("brandsList");
    if (dl) dl.innerHTML = allBrandsCache.map(b => `<option value="${escapeHtml(b.brand_name)}">`).join("");
  } catch (e) { console.warn(e); }
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
    html += `<div class="order-item-row">
      <div>
        <input data-item-idx="${idx}" data-field="lot" placeholder="N° de lot" value="${escapeHtml(item.lot_number)}">
        <div class="lot-check-hint" data-hint="${idx}"></div>
      </div>
      <input data-item-idx="${idx}" data-field="qty" type="number" min="1" placeholder="Qté" value="${item.quantity || ''}">
      <button data-remove-idx="${idx}" type="button">✕</button>
    </div>`;
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
  if (!lot || lot.length < 1) { hint.textContent = ""; hint.className = "lot-check-hint"; return; }

  hint.textContent = "🔍 Vérification...";
  const token = await getAdminToken();
  if (!token) return;

  try {
    const res = await fetch("/api/orders?action=check-lots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, lots: [lot] })
    });
    const data = await res.json();
    const result = data.results?.[0];

    if (!result || !result.exists) { hint.textContent = "❌ Lot introuvable"; hint.className = "lot-check-hint err"; }
    else { hint.textContent = `✅ ${result.count} codes — ${result.brand || "?"}`; hint.className = "lot-check-hint ok"; }
  } catch (e) { hint.textContent = "⚠️ Erreur"; hint.className = "lot-check-hint warn"; }
}

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
  const el = $(id); if (el) el.addEventListener("input", updateOrderTotals);
});

document.querySelectorAll('input[name="orderDeliveryMethod"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const method = document.querySelector('input[name="orderDeliveryMethod"]:checked')?.value;
    const fields = $("deliveryFields");
    if (fields) fields.style.display = method === "hand_to_hand" ? "none" : "block";
  });
});

const _aoi = $("addOrderItemBtn");
if (_aoi) _aoi.onclick = () => {
  currentOrderItems.push({ lot_number: "", quantity: 0 });
  renderOrderItems();
};

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

  if (!brandName) { if (errBox) { errBox.innerHTML = "<p style='margin:0'>Marque obligatoire</p>"; errBox.classList.remove("hidden"); } return; }
  if (validItems.length === 0) { if (errBox) { errBox.innerHTML = "<p style='margin:0'>Au moins un lot</p>"; errBox.classList.remove("hidden"); } return; }

  const token = await getAdminToken();
  if (!token) return;

  const method = document.querySelector('input[name="orderDeliveryMethod"]:checked')?.value || "delivery";

  const payload = {
    access_token: token, brand_name: brandName,
    brand_phone: $("orderBrandPhone").value.trim() || null,
    brand_email: $("orderBrandEmail").value.trim() || null,
    items: validItems.map(it => ({ lot_number: it.lot_number, quantity: it.quantity })),
    unit_price: parseFloat($("orderUnitPrice").value || 0),
    discount_percent: parseFloat($("orderDiscount").value || 0),
    delivery_cost: parseFloat($("orderDeliveryCost").value || 0),
    tva: parseFloat($("orderTva").value || 0),
    delivery_method: method,
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
  _cob.textContent = "⏳...";

  try {
    const res = await fetch("/api/orders?action=create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === "OK") {
      const found = allBrandsCache.find(b => b.brand_name.toLowerCase() === brandName.toLowerCase());
      if (!found || !found.is_registered) {
        fetch("/api/orders?action=save-contact", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, brand_name: brandName, phone: $("orderBrandPhone").value.trim() || null, email: $("orderBrandEmail").value.trim() || null })
        }).catch(e => {});
      }
      window.toast(`✅ ${data.order.order_number} créée`, "success");
      $("newOrderModal").classList.add("hidden");
      loadOrders();
    } else {
      if (errBox) { errBox.innerHTML = `<p style='margin:0'>${escapeHtml(data.message || "Erreur")}</p>`; errBox.classList.remove("hidden"); }
    }
  } catch (e) { if (errBox) { errBox.innerHTML = "<p style='margin:0'>Erreur réseau</p>"; errBox.classList.remove("hidden"); } }
  finally { _cob.disabled = false; _cob.textContent = "✓ Créer la commande"; }
};

// ============================================================
// ORDER DETAILS MODAL
// ============================================================
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, order_id: orderId })
    });
    const data = await res.json();
    if (data.status !== "OK" || !data.order) { body.innerHTML = `<p class="muted">Erreur</p>`; return; }

    const o = data.order;
    currentOrderId = orderId;
    title.textContent = `📄 ${o.order_number}`;

    const statusOptions = Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${o.order_status === k ? "selected" : ""}>${v}</option>`).join("");
    const paymentOptions = Object.entries(PAYMENT_LABELS).map(([k, v]) => `<option value="${k}" ${o.payment_status === k ? "selected" : ""}>${v}</option>`).join("");
    const itemsRows = (o.items || []).map(it => `<tr><td>Lot ${escapeHtml(it.lot_number)}</td><td style="text-align:right">${it.quantity}</td></tr>`).join("");

    body.innerHTML = `
      <div class="details">
        <div><b>Marque</b><span>${escapeHtml(o.brand_name)}</span></div>
        ${o.brand_phone ? `<div><b>Téléphone</b><span>${escapeHtml(o.brand_phone)}</span></div>` : ""}
        ${o.brand_email ? `<div><b>Email</b><span>${escapeHtml(o.brand_email)}</span></div>` : ""}
        <div><b>Date</b><span>${o.created_at ? new Date(o.created_at).toLocaleString("fr-FR") : "—"}</span></div>
        <div><b>Méthode</b><span>${o.delivery_method === "hand_to_hand" ? "🤝 Main à main" : "🚚 Livraison"}</span></div>
      </div>
      <h3 style="margin:20px 0 8px;font-size:13px;font-weight:900">📦 Articles</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:left;padding:8px 6px;background:var(--bg-secondary);font-size:10px;text-transform:uppercase">Lot</th><th style="text-align:right;padding:8px 6px;background:var(--bg-secondary);font-size:10px;text-transform:uppercase">Qté</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="details" style="margin-top:14px">
        <div><b>Sous-total</b><span>${formatMoney(o.subtotal)}</span></div>
        ${parseFloat(o.discount_amount || 0) > 0 ? `<div><b>Remise</b><span>-${formatMoney(o.discount_amount)}</span></div>` : ""}
        ${parseFloat(o.delivery_cost || 0) > 0 ? `<div><b>Livraison</b><span>${formatMoney(o.delivery_cost)}</span></div>` : ""}
        <div><b style="color:var(--gold)">TOTAL</b><span style="color:var(--gold);font-size:18px;font-weight:900">${formatMoney(o.total_price)}</span></div>
      </div>
      <div style="margin-top:22px;padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px">
        <h3 style="margin:0 0 12px;font-size:12px;font-weight:900">⚙️ Modifier</h3>
        <label style="font-size:11px;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:6px">STATUT</label>
        <select id="orderUpdateStatus" style="margin-bottom:12px">${statusOptions}</select>
        <label style="font-size:11px;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:6px">PAIEMENT</label>
        <select id="orderUpdatePayment" style="margin-bottom:12px">${paymentOptions}</select>
        <label style="font-size:11px;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:6px">MONTANT PAYÉ (DA)</label>
        <input id="orderUpdatePaidAmount" type="number" step="0.01" min="0" value="${o.paid_amount || 0}" style="margin-bottom:12px">
        <button id="saveOrderChangesBtn" class="btn btn-success btn-block">💾 ENREGISTRER</button>
      </div>
    `;

    footer.innerHTML = `
      <button id="printInvoiceFromDetails" class="btn btn-primary">🖨 Facture</button>
      <button id="deleteOrderBtn" class="btn btn-danger">🗑️ Supprimer</button>
    `;

    $("saveOrderChangesBtn").onclick = () => saveOrderChanges(o.id);
    $("printInvoiceFromDetails").onclick = () => printOrderInvoice(o.id);
    $("deleteOrderBtn").onclick = () => deleteOrder(o.id);
  } catch (e) { body.innerHTML = `<p class="muted">Erreur : ${escapeHtml(e.message)}</p>`; }
};

async function saveOrderChanges(orderId) {
  const token = await getAdminToken();
  if (!token) return;
  try {
    const res = await fetch("/api/orders?action=update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token, order_id: orderId,
        order_status: $("orderUpdateStatus")?.value,
        payment_status: $("orderUpdatePayment")?.value,
        paid_amount: parseFloat($("orderUpdatePaidAmount")?.value || 0)
      })
    });
    const data = await res.json();
    if (data.status === "OK") {
      window.toast("✅ Commande mise à jour", "success");
      $("orderDetailsModal").classList.add("hidden");
      loadOrders();
    } else window.toast("Erreur : " + (data.message || ""), "error");
  } catch (e) { window.toast("Erreur réseau", "error"); }
}

async function deleteOrder(orderId) {
  if (!confirm("Supprimer cette commande ?")) return;
  const token = await getAdminToken();
  if (!token) return;
  try {
    const res = await fetch("/api/orders?action=delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token, order_id: orderId })
    });
    const data = await res.json();
    if (data.status === "OK") { window.toast("✅ Supprimée", "success"); $("orderDetailsModal").classList.add("hidden"); loadOrders(); }
    else window.toast("Erreur : " + (data.message || ""), "error");
  } catch (e) { window.toast("Erreur réseau", "error"); }
}

const _codb = $("closeOrderDetailsBtn");
if (_codb) _codb.onclick = () => $("orderDetailsModal").classList.add("hidden");

// ============================================================
// BRAND DETAILS MODAL
// ============================================================
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, search: brandName, limit: 10 })
        });
        const data = await res.json();
        if (data.status === "OK") orders = (data.orders || []).filter(o => o.brand_name.toLowerCase() === brandName.toLowerCase());
      } catch (e) {}
    }

    const tierIcons = { VIP: "💎", GOLD: "🥇", SILVER: "🥈", REGULAR: "👤" };
    const tier = brand.tier || "REGULAR";

    let ordersHtml = "";
    if (orders.length === 0) ordersHtml = `<p style="text-align:center;padding:16px 0;color:var(--text-secondary);font-size:12px">Aucune commande</p>`;
    else {
      orders.slice(0, 5).forEach(o => {
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—";
        const payIcon = o.payment_status === "PAID" ? "✅" : o.payment_status === "PARTIAL" ? "🟡" : "❌";
        ordersHtml += `<div style="padding:10px 12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="min-width:0;flex:1">
            <div style="font-family:monospace;font-weight:800;font-size:12px;word-break:break-all">${escapeHtml(o.order_number)}</div>
            <div style="font-size:10px;color:var(--text-secondary);margin-top:4px">📅 ${escapeHtml(date)} ${payIcon}</div>
          </div>
          <div style="font-weight:900;font-size:13px;color:var(--gold);white-space:nowrap">${formatMoney(o.total_price)}</div>
        </div>`;
      });
    }

    body.innerHTML = `
      <div style="text-align:center;padding:16px 0 20px">
        <div style="font-size:48px;margin-bottom:8px">🏢</div>
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:900">${escapeHtml(brand.brand_name)}</h2>
        <div style="display:inline-flex;gap:6px;padding:4px 12px;background:var(--bg-secondary);border-radius:100px;font-size:11px;font-weight:800">
          ${brand.is_registered ? "✅ Inscrite" : "⚠️ Non inscrite"} · ${tierIcons[tier]} ${tier}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="text-align:center;padding:12px 8px;background:var(--bg-secondary);border-radius:12px">
          <div style="font-size:20px;font-weight:900">${brand.codes_count || 0}</div>
          <div style="font-size:9px;color:var(--text-secondary);font-weight:800">CODES</div>
        </div>
        <div style="text-align:center;padding:12px 8px;background:var(--bg-secondary);border-radius:12px">
          <div style="font-size:20px;font-weight:900">${brand.total_orders || 0}</div>
          <div style="font-size:9px;color:var(--text-secondary);font-weight:800">COMMANDES</div>
        </div>
        <div style="text-align:center;padding:12px 8px;background:var(--bg-secondary);border-radius:12px">
          <div style="font-size:14px;font-weight:900;color:var(--success)">${formatMoney(brand.total_spent || 0)}</div>
          <div style="font-size:9px;color:var(--text-secondary);font-weight:800">DÉPENSÉ</div>
        </div>
      </div>
      <div class="details" style="margin-bottom:20px">
        ${brand.email ? `<div><b>Email</b><span>${escapeHtml(brand.email)}</span></div>` : ""}
        ${brand.phone ? `<div><b>Téléphone</b><span>${escapeHtml(brand.phone)}</span></div>` : ""}
      </div>
      <h3 style="margin:20px 0 10px;font-size:13px;font-weight:900">📋 Dernières commandes</h3>
      ${ordersHtml}
    `;

    footer.innerHTML = `
      <button id="brandDetailsNewOrderBtn" class="btn btn-gold">➕ Nouvelle commande</button>
      ${brand.phone ? `<a href="https://wa.me/${encodeURIComponent(brand.phone.replace(/[^0-9]/g,''))}" target="_blank" class="btn btn-success" style="text-decoration:none">💬 WhatsApp</a>` : ""}
    `;

    const newOrderBtn = $("brandDetailsNewOrderBtn");
    if (newOrderBtn) {
      newOrderBtn.onclick = () => {
        $("brandDetailsModal").classList.add("hidden");
        openNewOrderModal().then(() => {
          if ($("orderBrand")) $("orderBrand").value = brand.brand_name;
          if ($("orderBrandPhone")) $("orderBrandPhone").value = brand.phone || "";
          if ($("orderBrandEmail")) $("orderBrandEmail").value = brand.email || "";
        });
      };
    }

  } catch (e) {
    body.innerHTML = `<p class="muted">Erreur : ${escapeHtml(e.message)}</p>`;
  }
};

const _cbdb = $("closeBrandDetailsBtn");
if (_cbdb) _cbdb.onclick = () => $("brandDetailsModal").classList.add("hidden");

// ============================================================
// EXPORT EXCEL BUTTONS
// ============================================================
const _edb = $("exportDebtsBtn");
if (_edb) _edb.onclick = () => {
  if (!debtsData || debtsData.length === 0) { window.toast("Aucune dette.", "error"); return; }
  const rows = debtsData.map(d => ({
    "Marque": d.brand_name,
    "Téléphone": d.brand_phone || "",
    "Email": d.brand_email || "",
    "Factures": d.invoices_count || 0,
    "Total dû": d.total_due || 0,
    "Jours": d.days_old || 0
  }));
  downloadExcel(rows, "Dettes", "Dettes");
};

const _efb = $("exportFeedbackBtn");
if (_efb) _efb.onclick = async () => {
  try {
    let query = sb.from("qr_feedback").select("*").order("created_at", { ascending: false }).limit(5000);
    if (currentFeedbackFilter !== "all") query = query.eq("type", currentFeedbackFilter);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) { window.toast("Aucune donnée.", "error"); return; }
    const rows = data.map(r => ({
      "Type": r.type || "",
      "Note": r.rating || "",
      "Commentaire": r.comment || "",
      "Code": r.secret_code || "",
      "IP": r.ip || "",
      "Date": r.created_at || ""
    }));
    downloadExcel(rows, "Avis", "Avis");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

const _emb = $("exportMessagesBtn");
if (_emb) _emb.onclick = async () => {
  try {
    let query = sb.from("brand_messages").select("*").order("created_at", { ascending: false }).limit(5000);
    if (currentMessagesFilter !== "all") query = query.eq("status", currentMessagesFilter);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) { window.toast("Aucune donnée.", "error"); return; }
    const rows = data.map(m => ({
      "Marque": m.brand_name || "",
      "Email": m.email || "",
      "Téléphone": m.phone || "",
      "Sujet": m.subject || "",
      "Message": m.message || "",
      "Statut": m.status || "",
      "Date": m.created_at || ""
    }));
    downloadExcel(rows, "Messages", "Messages");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

const _ebrb = $("exportBrandsBtn");
if (_ebrb) _ebrb.onclick = () => {
  if (!allBrandsCache || allBrandsCache.length === 0) { window.toast("Aucune marque.", "error"); return; }
  const rows = allBrandsCache.map(b => ({
    "Marque": b.brand_name,
    "Inscrite": b.is_registered ? "Oui" : "Non",
    "Email": b.email || "",
    "Téléphone": b.phone || "",
    "Codes": b.codes_count || 0,
    "Commandes": b.total_orders || 0,
    "Dépensé": b.total_spent || 0,
    "Niveau": b.tier || "REGULAR"
  }));
  downloadExcel(rows, "Marques", "Marques");
};

const _efkb = $("exportFakesBtn");
if (_efkb) _efkb.onclick = async () => {
  try {
    let query = sb.from("fake_reports").select("*").order("created_at", { ascending: false }).limit(5000);
    if (currentFakesFilter !== "all") query = query.eq("status", currentFakesFilter);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) { window.toast("Aucune donnée.", "error"); return; }
    const rows = data.map(r => ({
      "Wilaya": r.wilaya || "",
      "Marque": r.product_brand || "",
      "Produit": r.product_name || "",
      "Code essayé": r.attempted_code || "",
      "Commentaire": r.comment || "",
      "Statut": r.status || "",
      "Analysé IA": r.ai_analyzed ? "Oui" : "Non",
      "IP": r.ip || "",
      "Date": r.created_at || ""
    }));
    downloadExcel(rows, "Contrefacons", "Contrefaçons");
  } catch (e) { window.toast("Erreur : " + e.message, "error"); }
};

// ============================================================
// FIN DU FICHIER admin.js (v6 — Full)
// ============================================================
// ============================================================
// UNASSIGNED REPORTS (البلاغات المجهولة)
// ============================================================
async function loadUnassignedReports() {
  const container = $("unassignedList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  try {
    const { data, error } = await sb
      .from("fake_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // فلترة البلاغات التي ليس لها ماركة (سواء NULL أو نص فارغ أو مسافات)
    const unassigned = (data || []).filter(r => {
      const brand = (r.product_brand || "").trim();
      return brand === "";
    });

    const badge = $("unassignedBadge");
    if (badge) {
      if (unassigned.length > 0) { badge.textContent = unassigned.length; badge.style.display = "inline-block"; }
      else badge.style.display = "none";
    }

    if (unassigned.length === 0) {
      container.innerHTML = `<p class="muted" style="text-align:center;padding:40px 0;color:var(--success);">🎉 لا توجد بلاغات مجهولة حالياً.</p>`;
      return;
    }

    let html = "";
    unassigned.forEach(r => {
      const date = r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : "—";
      html += `
        <div class="log-row log-warning" style="padding:16px; margin-bottom:12px; border-left:4px solid var(--warning);">
          <div class="log-top">
            <span class="log-result log-result-warning">⚠️ غير موجه</span>
            <span class="log-date">${escapeHtml(date)}</span>
          </div>
          <div style="display:flex; gap:12px; margin-top:12px;">
            ${r.product_image ? `<img src="${escapeHtml(r.product_image)}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">` : ""}
            <div style="flex:1;">
              <div style="font-size:13px; font-weight:800;">📦 ${escapeHtml(r.product_name || 'منتج غير معروف')}</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">📍 ${escapeHtml(r.wilaya || '—')}</div>
            </div>
          </div>
          <div style="margin-top:12px; padding:10px; background:var(--bg-secondary); border-radius:8px; font-size:12px;">
            💬 ${escapeHtml(r.comment || 'لا يوجد تعليق')}
          </div>
          <div style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--border);">
            <label style="font-size:11px; font-weight:800; color:var(--text-secondary); display:block; margin-bottom:6px;">توجيه إلى علامة تجارية:</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="brand-assign-${r.id}" class="form-input" placeholder="اسم الماركة" style="flex:1; padding:8px 12px; font-size:13px;">
              <button onclick="assignReportToBrand(${r.id})" class="btn btn-success" style="padding:8px 16px; font-size:12px;">✅ توجيه</button>
              <button onclick="deleteUnassignedReport(${r.id})" class="btn btn-danger" style="padding:8px 16px; font-size:12px;">🗑️</button>
            </div>
          </div>
        </div>`;
    });
    container.innerHTML = html;

  } catch (err) {
    console.error("loadUnassignedReports error:", err);
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

window.assignReportToBrand = async function(reportId) {
  const input = document.getElementById(`brand-assign-${reportId}`);
  const newBrand = (input?.value || "").trim();
  if (!newBrand) { window.toast("الرجاء كتابة اسم الماركة", "error"); return; }

  try {
    const { error } = await sb.from("fake_reports").update({ product_brand: newBrand }).eq("id", reportId);
    if (error) throw error;
    window.toast(`✅ تم توجيه البلاغ إلى ${newBrand}`, "success");
    loadUnassignedReports();
  } catch (e) { window.toast("خطأ: " + e.message, "error"); }
};

window.deleteUnassignedReport = async function(reportId) {
  if (!confirm("حذف هذا البلاغ نهائياً؟")) return;
  try {
    const { error } = await sb.from("fake_reports").delete().eq("id", reportId);
    if (error) throw error;
    window.toast("✅ تم الحذف", "success");
    loadUnassignedReports();
  } catch (e) { window.toast("خطأ: " + e.message, "error"); }
};

// ✅ ربط الزر (فقط إذا كنا في لوحة التحكم)
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    // التحقق من أننا في لوحة التحكم (وليس صفحة تسجيل الدخول)
    const adminApp = document.getElementById("adminApp");
    if (!adminApp || adminApp.classList.contains("hidden")) return;

    const unassignedBtn = document.querySelector('button[data-panel="unassigned"]');
    if (unassignedBtn) {
      unassignedBtn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".sidebar-nav button").forEach(b => b.classList.remove("active"));
        const panel = $("panel-unassigned");
        if (panel) panel.classList.add("active");
        unassignedBtn.classList.add("active");
        const mt = $("mobileTitle"); if (mt) mt.textContent = "بلاغات غير موجهة";
        const sb1 = $("sidebar"); if (sb1) sb1.classList.remove("open");
        const ov = $("overlay"); if (ov) ov.classList.remove("show");
        loadUnassignedReports();
      });
    }
    const refreshBtn = $("refreshUnassignedBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => loadUnassignedReports());
    }
  }, 1000);
});
    if (unassignedBtn) {
      unassignedBtn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".sidebar-nav button").forEach(b => b.classList.remove("active"));
        const panel = $("panel-unassigned");
        if (panel) panel.classList.add("active");
        unassignedBtn.classList.add("active");
        const mt = $("mobileTitle"); if (mt) mt.textContent = "بلاغات غير موجهة";
        const sb1 = $("sidebar"); if (sb1) sb1.classList.remove("open");
        const ov = $("overlay"); if (ov) ov.classList.remove("show");
        loadUnassignedReports();
      });
    }
    const refreshBtn = $("refreshUnassignedBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => loadUnassignedReports());
    }
  }, 1000);
});
