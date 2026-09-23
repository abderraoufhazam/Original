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
let currentMessagesFilter = "all";
let unreadMessagesCount = 0;

let chartDaily = null;
let chartResults = null;
let chartTopLots = null;

let pendingDeleteLot = null;
let pendingDeleteCount = 0;

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
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
  messages: "Messages",
  brands: "Marques",
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
    const res = await fetch("/api/list-brands", {
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
    const now = new Date();
    const last7days = brands.filter(b => {
      const d = new Date(b.created_at);
      return (now - d) < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const active = brands.filter(b => b.last_sign_in_at).length;

    if (statsBox) {
      statsBox.innerHTML = `
        <div class="stat-card">
          <div class="stat-num">${brands.length}</div>
          <div class="stat-label">TOTAL</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#16a34a">${last7days}</div>
          <div class="stat-label">7 DERNIERS JOURS</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#2563eb">${active}</div>
          <div class="stat-label">ACTIVES</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#dc2626">${brands.length - active}</div>
          <div class="stat-label">INACTIVES</div>
        </div>
      `;
    }

    if (brands.length === 0) {
      container.innerHTML = `<p class="muted">Aucune marque inscrite pour le moment.</p>`;
      return;
    }

    let html = "";
    brands.forEach(b => {
      const created = b.created_at ? new Date(b.created_at).toLocaleString() : "—";
      const lastSeen = b.last_sign_in_at ? new Date(b.last_sign_in_at).toLocaleString() : "Jamais connecté";
      const isRecent = (now - new Date(b.created_at)) < 24 * 60 * 60 * 1000;

      html += `
        <div class="log-row log-${isRecent ? "success" : "warning"}" style="padding:16px">
          <div class="log-top">
            <span class="log-result log-result-${isRecent ? "success" : "warning"}">
              ${isRecent ? "🆕 NOUVELLE" : "🏢 MARQUE"}
            </span>
            <span class="log-date">${escapeHtml(created)}</span>
          </div>

          <div style="font-weight:800;font-size:15px;color:inherit;margin:8px 0 6px">
            ${escapeHtml(b.brand_name || "(sans nom)")}
          </div>

          <div class="log-meta" style="margin-bottom:10px">
            <span>📧 ${escapeHtml(b.email)}</span>
            ${b.phone ? `<span>📱 ${escapeHtml(b.phone)}</span>` : ""}
          </div>

          <div style="font-size:11px;color:#64748b;margin-bottom:10px">
            Dernière connexion : ${escapeHtml(lastSeen)}
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${b.phone ? `<a href="https://wa.me/${encodeURIComponent(b.phone.replace(/[^0-9]/g,''))}?text=${encodeURIComponent('Bonjour ' + (b.brand_name || '') + ', bienvenue sur Produit dz ORG !')}" target="_blank" rel="noopener" style="flex:1;padding:8px 12px;background:#25D366;color:#fff;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;text-align:center;min-width:110px;display:inline-flex;align-items:center;justify-content:center;gap:4px">💬 WhatsApp</a>` : ""}
            <a href="mailto:${escapeHtml(b.email)}" style="flex:1;padding:8px 12px;background:#0f172a;color:#fff;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;text-align:center;min-width:110px;display:inline-flex;align-items:center;justify-content:center;gap:4px">📧 Email</a>
          </div>
        </div>`;
    });
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p class="muted">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

const _rbb = $("refreshBrandsBtn");
if (_rbb) _rbb.onclick = () => loadBrands();

// ============================================================
// DELETE LOG
// ============================================================
async function loadDeleteLog() {
  const container = $("deleteLogList");
  if (!container) return;
  container.innerHTML = `<p class="muted">Chargement...</p>`;

  const { data, error } = await sb
    .from("qr_delete_logs")
    .select("*")
    .order("deleted_at", { ascending: false })
    .limit(20);

  if (error) {
    container.innerHTML = `<p class="muted">Aucune donnée.</p>`;
    return;
  }
  if (!data || data.length === 0) {
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

const _rdlb = $("refreshDeleteLogBtn");
if (_rdlb) _rdlb.onclick = () => loadDeleteLog();

// ============================================================
// CHARTS
// ============================================================
function getChartColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    text: isDark ? "#cbd5e1" : "#334155",
    grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"
  };
}

async function loadCharts() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const { data: verifs } = await sb
      .from("qr_verifications")
      .select("created_at, result")
      .gte("created_at", since.toISOString())
      .limit(10000);

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
          datasets: [{
            label: "Vérifications",
            data: counts.total,
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#16a34a",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0f172a", titleColor: "#fff", bodyColor: "#e2e8f0", padding: 10, cornerRadius: 8 }
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } },
            x: { ticks: { color: colors.text, font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
  } catch (e) { console.warn("chartDaily error:", e); }

  try {
    const { data: allVerifs } = await sb
      .from("qr_verifications")
      .select("result")
      .limit(10000);

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
          datasets: [{
            data: [distribution.ORIGINAL, distribution.USED, distribution.NOT_FOUND],
            backgroundColor: ["#16a34a", "#eab308", "#dc2626"],
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
              labels: { color: getChartColors().text, padding: 14, font: { size: 12, weight: "600" }, usePointStyle: true, pointStyle: "circle" }
            },
            tooltip: {
              backgroundColor: "#0f172a", titleColor: "#fff", bodyColor: "#e2e8f0", padding: 10, cornerRadius: 8,
              callbacks: {
                label: function(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                  return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  } catch (e) { console.warn("chartResults error:", e); }

  try {
    const { data: verifs } = await sb
      .from("qr_verifications")
      .select("lot, result")
      .eq("result", "ORIGINAL")
      .limit(10000);

    const lotCounts = {};
    (verifs || []).forEach(v => {
      if (v.lot) lotCounts[v.lot] = (lotCounts[v.lot] || 0) + 1;
    });

    const top = Object.entries(lotCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = top.map(t => t[0] || "—");
    const data = top.map(t => t[1]);

    const ctx = document.getElementById("chartTopLots");
    if (ctx) {
      if (chartTopLots) chartTopLots.destroy();

      if (labels.length === 0) {
        const parent = ctx.parentElement;
        if (parent && !parent.querySelector(".empty-msg")) {
          parent.innerHTML = `<p class="muted empty-msg" style="text-align:center;padding:40px 0">Aucune donnée pour le moment.</p>`;
        }
        return;
      }

      chartTopLots = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Vérifications",
            data: data,
            backgroundColor: [
              "rgba(22,163,74,0.85)",
              "rgba(59,130,246,0.85)",
              "rgba(234,179,8,0.85)",
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
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a", titleColor: "#fff", bodyColor: "#e2e8f0", padding: 10, cornerRadius: 8,
              callbacks: {
                title: (items) => "Lot: " + items[0].label,
                label: (ctx) => " " + ctx.parsed.x + " vérification(s)"
              }
            }
          },
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
// AUTH
// ============================================================
async function refresh() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const lp = $("loginPage"); if (lp) lp.classList.add("hidden");
    const aa = $("adminApp"); if (aa) aa.classList.remove("hidden");
    const url = location.origin + "/verify";
    const pu = $("publicUrl"); if (pu) pu.textContent = url;
    const qr = $("qr"); if (qr) {
      qr.innerHTML = "";
      new QRCode(qr, { text: url, width: 180, height: 180 });
    }
    loadStats();
    loadLog();
    loadFeedback();
    loadCharts();
    loadMessagesBadge();
  }
}
refresh();

const _lf = $("loginForm");
if (_lf) _lf.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lb = $("loginBtn");
  if (lb) { lb.disabled = true; lb.textContent = "CONNEXION..."; }
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (lb) { lb.disabled = false; lb.textContent = "SE CONNECTER"; }
  if (error) {
    const el = $("loginError");
    if (el) {
      el.className = "result danger";
      el.innerHTML = `<p style="margin:0">${escapeHtml(error.message)}</p>`;
    }
    return;
  }
  const el = $("loginError"); if (el) el.classList.add("hidden");
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
// CREATE BATCH
// ============================================================
const _cb = $("createBtn");
if (_cb) _cb.onclick = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const brand = $("brand").value.trim();
  if (!brand) return alert("La marque est obligatoire.");

  const qty = Math.min(10000, Math.max(1, Number($("quantity").value) || 1));

  _cb.disabled = true;
  _cb.textContent = "CRÉATION...";
  const ar = $("adminResult"); if (ar) ar.className = "result hidden";

  try {
    const res = await fetch("/api/create-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({
        brand: brand,
        product_name: $("product_name").value.trim() || null,
        reference: $("reference").value.trim() || null,
        lot: $("lot").value.trim() || null,
        manufacture_date: $("manufacture_date").value || null,
        expiry_date: $("expiry_date").value || null,
        product_image: $("product_image").value.trim() || null,
        logo_url: $("logo_url").value.trim() || null,
        instagram_url: $("instagram_url").value.trim() || null,
        facebook_url: $("facebook_url").value.trim() || null,
        tiktok_url: $("tiktok_url").value.trim() || null,
        description: $("description").value.trim() || null,
        quantity: qty,
        access_token: session.access_token
      })
    });

    const data = await res.json();

    if (data.status === "OK") {
      lastCodes = data.codes || [];
      lastLogo = $("logo_url").value.trim() || "";
      if (ar) {
        ar.className = "result success";
        ar.innerHTML = `
          <h2>✓ LOT CRÉÉ</h2>
          <p>${data.inserted} codes générés avec succès.</p>
          <p style="font-size:12px;margin-top:8px;color:#64748b">🔒 Les codes sont chiffrés en base de données (AES-256).</p>
        `;
      }
      const pb = $("printBtn"); if (pb) pb.classList.remove("hidden");
      const ebt = $("exportNewLotBtn"); if (ebt) ebt.classList.remove("hidden");
      loadStats();
      loadCharts();
    } else {
      if (ar) {
        ar.className = "result danger";
        ar.innerHTML = `
          <p>Erreur : ${escapeHtml(data.message || "")}</p>
          ${data.detail ? `<p style="font-size:11px;color:#dc2626;word-break:break-all">${escapeHtml(data.detail)}</p>` : ""}
        `;
      }
    }
  } catch (err) {
    if (ar) {
      ar.className = "result danger";
      ar.innerHTML = `<p>Erreur : ${escapeHtml(err.message)}</p>`;
    }
  } finally {
    _cb.disabled = false;
    _cb.textContent = "CRÉER LE LOT";
  }
};

// ============================================================
// SEARCH
// ============================================================
const _sb = $("searchBtn");
if (_sb) _sb.onclick = async () => {
  const code = ($("searchCode").value || "").trim().toUpperCase();
  const res = $("searchResult");
  if (!res) return;
  if (!code) { res.className = "result hidden"; return; }

  const { data, error } = await sb
    .from("qr_codes")
    .select("*")
    .eq("secret_code", code)
    .limit(1);

  if (error || !data || data.length === 0) {
    res.className = "result danger";
    res.innerHTML = `<h2>NON TROUVÉ</h2><p>Aucun code ne correspond.</p><p style="font-size:11px;color:#64748b;margin-top:8px">Note : les codes chiffrés ne sont pas recherchables ici.</p>`;
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
      ${r.used_at ? `<div><b>Utilisé le</b><span>${escapeHtml(new Date(r.used_at).toLocaleString())}</span></div>` : ""}
    </div>
  `;
};

// ============================================================
// LOAD LOT
// ============================================================
const _llb = $("loadLotBtn");
if (_llb) _llb.onclick = async () => {
  const lot = ($("editLotSearch").value || "").trim();
  const info = $("lotInfo");
  const form = $("editForm");
  const printLotBtn = $("printLotBtn");
  const exportBtn = $("exportLotCodesBtn");

  if (!info) return;

  if (!lot) {
    info.className = "result danger";
    info.innerHTML = `<p>Entrez un numéro de lot.</p>`;
    if (form) form.classList.add("hidden");
    if (printLotBtn) printLotBtn.classList.add("hidden");
    if (exportBtn) exportBtn.classList.add("hidden");
    return;
  }

  info.className = "result";
  info.innerHTML = `<p>Chargement...</p>`;
  if (form) form.classList.add("hidden");
  if (printLotBtn) printLotBtn.classList.add("hidden");
  if (exportBtn) exportBtn.classList.add("hidden");
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
  loadedLotCodes = data.map(row => row.secret_code).filter(Boolean);
  loadedLotBrand = r.brand || "MARQUE";
  loadedLotLot = r.lot || lot;
  loadedLotLogo = r.logo_url || "";

  const hasEncrypted = data.some(row => row.secret_code_encrypted);

  info.className = "result success";
  info.innerHTML = `
    <h2>${data.length} code(s) trouvé(s)</h2>
    ${hasEncrypted ? `<p style="font-size:11px;color:#16a34a;margin:6px 0">🔒 Lot chiffré — utilisez IMPRIMER ou EXPORTER</p>` : ""}
    <div class="details">
      ${r.brand ? `<div><b>Marque</b><span>${escapeHtml(r.brand)}</span></div>` : ""}
      ${r.product_name ? `<div><b>Produit</b><span>${escapeHtml(r.product_name)}</span></div>` : ""}
      ${r.reference ? `<div><b>Référence</b><span>${escapeHtml(r.reference)}</span></div>` : ""}
      ${r.lot ? `<div><b>Lot</b><span>${escapeHtml(r.lot)}</span></div>` : ""}
      ${r.manufacture_date ? `<div><b>Fabrication</b><span>${escapeHtml(r.manufacture_date)}</span></div>` : ""}
      ${r.expiry_date ? `<div><b>Expiration</b><span>${escapeHtml(r.expiry_date)}</span></div>` : ""}
    </div>
  `;

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

// ============================================================
// UPDATE LOT
// ============================================================
const _ub = $("updateBatchBtn");
if (_ub) _ub.onclick = async () => {
  if (!loadedLot) return alert("Chargez d'abord un lot.");

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const info = $("lotInfo");
  const updates = {};
  const v = id => {
    const el = $(id);
    return el ? (el.value || "").trim() : "";
  };

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

  if (Object.keys(updates).length === 0) return alert("Aucun champ à modifier.");
  if (!confirm(`Confirmer la mise à jour du lot "${loadedLot}" ?`)) return;

  _ub.disabled = true;
  _ub.textContent = "MISE À JOUR...";

  const { error } = await sb.from("qr_codes").update(updates).eq("lot", loadedLot);

  _ub.disabled = false;
  _ub.textContent = "METTRE À JOUR LE LOT";

  if (error) {
    if (info) {
      info.className = "result danger";
      info.innerHTML = `<p>Erreur : ${escapeHtml(error.message)}</p>`;
    }
    return;
  }

  if (info) {
    info.className = "result success";
    info.innerHTML = `<h2>✓ LOT MIS À JOUR</h2><p>Tous les codes du lot "${escapeHtml(loadedLot)}" ont été modifiés.</p>`;
  }
  loadStats();

  if (updates.brand) loadedLotBrand = updates.brand;
  if (updates.logo_url) loadedLotLogo = updates.logo_url;
  if (updates.lot) {
    loadedLot = updates.lot;
    loadedLotLot = updates.lot;
    if ($("editLotSearch")) $("editLotSearch").value = updates.lot;
    if ($("editNewLot")) $("editNewLot").value = "";
  }
};

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
    let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Liste des codes</title>
    <style>
      @page { margin: 12mm; }
      body { font-family: Arial, sans-serif; padding: 15px; margin: 0; color: #111; }
      .toolbar { background: #111; color: #fff; padding: 12px; text-align: center; margin-bottom: 20px; border-radius: 8px; }
      .toolbar button { background: #fff; color: #111; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; }
      .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #111; }
      .header h1 { margin: 0 0 6px; font-size: 22px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
      th { background: #111; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
      td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .num { color: #6b7280; width: 45px; font-weight: bold; }
      .code-cell { font-family: 'Courier New', monospace; font-weight: bold; font-size: 15px; letter-spacing: 2px; }
      @media print { .toolbar { display: none !important; } body { padding: 0; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
    <div class="header">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:50px;margin-bottom:10px">` : ""}
      <h1>${escapeHtml(brand)}</h1>
      <p><b>Liste des codes de sécurité</b></p>
      <p>${lot ? "Lot: " + escapeHtml(lot) + " — " : ""}Total: ${codes.length}</p>
    </div>
    <table><thead><tr><th class="num">#</th><th>Code de sécurité</th></tr></thead><tbody>`;

    codes.forEach((code, i) => {
      html += `<tr><td class="num">${i + 1}</td><td class="code-cell">${code.match(/.{1,4}/g).join(" ")}</td></tr>`;
    });

    html += `</tbody></table></body></html>`;
    w.document.write(html);
    w.document.close();
    return;
  }

  const size = ($("labelSize") && $("labelSize").value) || "60x90";
  let labelWidth, labelHeight, qrSize, codeFontSize, brandFontSize;
  if (size === "50x50") {
    labelWidth = "50mm"; labelHeight = "50mm"; qrSize = "22mm"; codeFontSize = "9px"; brandFontSize = "8px";
  } else if (size === "70x50") {
    labelWidth = "70mm"; labelHeight = "50mm"; qrSize = "28mm"; codeFontSize = "11px"; brandFontSize = "10px";
  } else {
    labelWidth = "60mm"; labelHeight = "90mm"; qrSize = "34mm"; codeFontSize = "13px"; brandFontSize = "11px";
  }

  let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>Impression</title>
  <style>
    @page { margin: 8mm; }
    body { font-family: Arial, sans-serif; padding: 10px; margin: 0; background: #f5f5f5; }
    .toolbar { background: #111; color: #fff; padding: 12px; text-align: center; margin-bottom: 15px; border-radius: 8px; }
    .toolbar button { background: #fff; color: #111; border: 0; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    .info { font-size: 12px; color: #333; margin: 15px 0; padding: 14px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; }
    .sheet { display: flex; flex-wrap: wrap; gap: 4mm; background: #fff; padding: 10px; border-radius: 8px; }
    .label { width: ${labelWidth}; height: ${labelHeight}; border: 1px dashed #bbb; display: flex; flex-direction: column; page-break-inside: avoid; background: #fff; position: relative; border-radius: 3mm; overflow: hidden; }
    .label-top { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3mm; text-align: center; }
    .label-logo { max-height: 8mm; max-width: 40mm; margin-bottom: 1.5mm; }
    .label-brand { font-size: ${brandFontSize}; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2mm; }
    .label-qr { width: ${qrSize}; height: ${qrSize}; display: block; }
    .label-inst { font-size: 7px; color: #666; margin-top: 2mm; }
    .label-fold { height: 6mm; display: flex; align-items: center; justify-content: center; font-size: 6px; color: #888; border-top: 1px dashed #666; border-bottom: 1px dashed #666; background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 3px, #e8e8e8 3px, #e8e8e8 6px); }
    .label-bottom { height: 28mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; text-align: center; }
    .label-code-title { font-size: 6.5px; color: #888; letter-spacing: 1.5px; margin-bottom: 1.5mm; text-transform: uppercase; }
    .label-code { font-family: 'Courier New', monospace; font-size: ${codeFontSize}; font-weight: bold; letter-spacing: 1.5px; padding: 1.5mm 3mm; border: 1px solid #ddd; border-radius: 2mm; background: #fafafa; }
    .label-hint { font-size: 5.5px; color: #999; margin-top: 1.5mm; font-style: italic; }
    .label-lot { position: absolute; top: 2mm; right: 2mm; font-size: 6px; color: #aaa; font-family: monospace; }
    @media print { .toolbar, .info { display: none !important; } body { padding: 0; } .sheet { padding: 0; gap: 2mm; } }
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">🖨 IMPRIMER</button></div>
  <div class="info"><b>📋 MODE D'EMPLOI :</b> Pliez le long de la ligne pointillée.</div>
  <div class="sheet">`;

  codes.forEach((code) => {
    html += `
      <div class="label">
        ${lot ? `<div class="label-lot">LOT ${escapeHtml(lot)}</div>` : ""}
        <div class="label-top">
          ${logoUrl ? `<img class="label-logo" src="${escapeHtml(logoUrl)}">` : ""}
          <div class="label-brand">${escapeHtml(brand)}</div>
          <img class="label-qr" src="${qrUrl}">
          <div class="label-inst">Scannez puis entrez le code</div>
        </div>
        <div class="label-fold">✂ - - - PLIEZ ICI - - - ✂</div>
        <div class="label-bottom">
          <div class="label-code-title">Code de sécurité</div>
          <div class="label-code">${code.match(/.{1,4}/g).join(" ")}</div>
          <div class="label-hint">Ne pas révéler avant l'achat</div>
        </div>
      </div>`;
  });

  html += `</div></body></html>`;
  w.document.write(html);
  w.document.close();
}

const _pb = $("printBtn");
if (_pb) _pb.onclick = () => {
  printLabels(lastCodes, $("brand").value.trim() || "MARQUE", $("lot").value.trim() || "", lastLogo);
};

const _plb = $("printLotBtn");
if (_plb) _plb.onclick = async () => {
  if (!loadedLot) return alert("Aucun lot chargé.");

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return alert("Connectez-vous.");

  const btn = _plb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "🔓 Déchiffrement...";

  try {
    const res = await fetch("/api/print-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });

    const data = await res.json();

    if (data.status !== "OK") {
      alert("Erreur : " + (data.message || ""));
      return;
    }

    const codes = (data.codes || []).map(c => c.code).filter(Boolean);

    if (codes.length === 0) {
      alert("Aucun code à imprimer.");
      return;
    }

    printLabels(codes, data.brand || loadedLotBrand || "MARQUE", data.lot || loadedLotLot, data.logo_url || loadedLotLogo);

  } catch (err) {
    alert("Erreur réseau : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

// ============================================================
// EXCEL EXPORT
// ============================================================
function downloadExcel(data, filename, sheetName) {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("Bibliothèque Excel non chargée. Rechargez la page.");
    return;
  }

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
  if (!lastCodes || lastCodes.length === 0) return alert("Aucun code à exporter.");

  const brand = $("brand").value.trim() || "MARQUE";
  const lot = $("lot").value.trim() || "—";
  const productName = $("product_name").value.trim() || "";
  const reference = $("reference").value.trim() || "";

  const rows = lastCodes.map((code, i) => ({
    "#": i + 1,
    "Code de sécurité": code,
    "Statut": "UNUSED",
    "Lot": lot,
    "Marque": brand,
    "Produit": productName,
    "Référence": reference
  }));

  downloadExcel(rows, "Codes_" + lot, "Codes");
};

const _elcb = $("exportLotCodesBtn");
if (_elcb) _elcb.onclick = async () => {
  if (!loadedLot) return alert("Chargez d'abord un lot.");

  const btn = _elcb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Export...";

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      alert("Session expirée.");
      return;
    }

    const res = await fetch("/api/print-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ lot: loadedLot, access_token: session.access_token })
    });

    const data = await res.json();

    if (data.status !== "OK") {
      alert("Erreur : " + (data.message || ""));
      return;
    }

    const rows = (data.codes || []).map((c, i) => ({
      "#": i + 1,
      "Code de sécurité": c.code,
      "Statut": c.status || "UNUSED",
      "Lot": data.lot || loadedLot,
      "Marque": data.brand || loadedLotBrand,
      "Produit": data.product_name || "",
      "Référence": data.reference || ""
    }));

    downloadExcel(rows, "Codes_" + loadedLot, "Codes");
  } catch (err) {
    alert("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

const _emb = $("exportMessagesBtn");
if (_emb) _emb.onclick = async () => {
  const btn = _emb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Export...";

  try {
    const { data, error } = await sb
      .from("brand_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) throw error;
    if (!data || data.length === 0) {
      alert("Aucun message à exporter.");
      return;
    }

    const rows = data.map(m => ({
      "Date": m.created_at ? new Date(m.created_at).toLocaleString() : "",
      "Marque": m.brand_name || "",
      "Email": m.email || "",
      "Téléphone": m.phone || "",
      "Sujet": m.subject || "",
      "Message": m.message || "",
      "Statut": m.status === "NEW" ? "Nouveau" : "Lu"
    }));

    downloadExcel(rows, "Messages", "Messages");
  } catch (err) {
    alert("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

const _ebb = $("exportBrandsBtn");
if (_ebb) _ebb.onclick = async () => {
  const btn = _ebb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Export...";

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      alert("Session expirée.");
      return;
    }

    const res = await fetch("/api/list-brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ access_token: session.access_token })
    });

    const data = await res.json();

    if (data.status !== "OK") {
      alert("Erreur : " + (data.message || ""));
      return;
    }

    if (!data.brands || data.brands.length === 0) {
      alert("Aucune marque à exporter.");
      return;
    }

    const rows = data.brands.map(b => ({
      "Marque": b.brand_name || "",
      "Email": b.email || "",
      "Téléphone": b.phone || "",
      "Inscrit le": b.created_at ? new Date(b.created_at).toLocaleString() : "",
      "Dernière connexion": b.last_sign_in_at ? new Date(b.last_sign_in_at).toLocaleString() : "Jamais",
      "Statut": b.last_sign_in_at ? "Active" : "Inactive"
    }));

    downloadExcel(rows, "Marques", "Marques");
  } catch (err) {
    alert("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

const _efb = $("exportFeedbackBtn");
if (_efb) _efb.onclick = async () => {
  const btn = _efb;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Export...";

  try {
    const { data, error } = await sb
      .from("qr_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) throw error;
    if (!data || data.length === 0) {
      alert("Aucun avis à exporter.");
      return;
    }

    const rows = data.map(f => ({
      "Date": f.created_at ? new Date(f.created_at).toLocaleString() : "",
      "Type": f.type === "rating" ? "Avis" : "Signalement",
      "Note": f.rating || "",
      "Commentaire": f.comment || "",
      "Code": f.secret_code || "",
      "IP": f.ip || ""
    }));

    downloadExcel(rows, "Avis_Clients", "Avis");
  } catch (err) {
    alert("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
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

  if (!lot) {
    if (preview) {
      preview.className = "result danger";
      preview.innerHTML = `<p>Entrez un numéro de lot.</p>`;
    }
    return;
  }

  if (preview) {
    preview.className = "result";
    preview.innerHTML = `<p>Recherche...</p>`;
  }

  const { data, error } = await sb
    .from("qr_codes")
    .select("secret_status")
    .eq("lot", lot);

  if (error) {
    if (preview) {
      preview.className = "result danger";
      preview.innerHTML = `<p>Erreur : ${escapeHtml(error.message)}</p>`;
    }
    return;
  }

  if (!data || data.length === 0) {
    if (preview) {
      preview.className = "result danger";
      preview.innerHTML = `<h2>AUCUN RÉSULTAT</h2><p>Aucun code trouvé pour le lot "<b>${escapeHtml(lot)}</b>".</p>`;
    }
    return;
  }

  const statuses = { UNUSED: 0, USED: 0, DISABLED: 0, EXPIRED: 0 };
  data.forEach(r => {
    if (statuses[r.secret_status] !== undefined) statuses[r.secret_status]++;
  });

  pendingDeleteLot = lot;
  pendingDeleteCount = data.length;

  if (preview) {
    preview.className = "result danger";
    preview.innerHTML = `
      <h2>⚠️ PRÊT À SUPPRIMER</h2>
      <p>Lot : <b>${escapeHtml(lot)}</b></p>
      <p>Total : <b>${data.length}</b> code(s)</p>
      <div class="details" style="margin-top:12px">
        <div><b>UNUSED</b><span>${statuses.UNUSED}</span></div>
        <div><b>USED</b><span>${statuses.USED}</span></div>
        <div><b>DISABLED</b><span>${statuses.DISABLED}</span></div>
        <div><b>EXPIRED</b><span>${statuses.EXPIRED}</span></div>
      </div>
    `;
  }

  if ($("deleteConfirmInput")) $("deleteConfirmInput").value = "";
  if ($("confirmDeleteBtn")) $("confirmDeleteBtn").disabled = true;
  if (confirmBox) {
    confirmBox.classList.remove("hidden");
    confirmBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }
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
  if (!session) return alert("Connectez-vous.");

  const btn = _cdb;
  btn.disabled = true;
  btn.textContent = "SUPPRESSION EN COURS...";

  const lot = pendingDeleteLot;
  const count = pendingDeleteCount;

  try {
    const { error: deleteError } = await sb
      .from("qr_codes")
      .delete()
      .eq("lot", lot);

    if (deleteError) throw deleteError;

    try {
      await sb.from("qr_delete_logs").insert({ lot: lot, count: count });
    } catch (logErr) {
      console.warn("Log insert failed:", logErr);
    }

    const result = $("deleteResult");
    if (result) {
      result.className = "result success";
      result.innerHTML = `
        <h2>✓ SUPPRESSION RÉUSSIE</h2>
        <p><b>${count}</b> code(s) du lot "<b>${escapeHtml(lot)}</b>" ont été supprimés définitivement.</p>
      `;
    }

    if ($("deletePreview")) $("deletePreview").classList.add("hidden");
    if ($("deleteConfirmBox")) $("deleteConfirmBox").classList.add("hidden");
    if ($("deleteLotSearch")) $("deleteLotSearch").value = "";
    pendingDeleteLot = null;
    pendingDeleteCount = 0;

    loadStats();
    loadCharts();
    loadDeleteLog();

  } catch (err) {
    const result = $("deleteResult");
    if (result) {
      result.className = "result danger";
      result.innerHTML = `<p>Erreur : ${escapeHtml(err.message)}</p>`;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "🗑️ SUPPRIMER DÉFINITIVEMENT";
  }
};
