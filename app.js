// app.js — Vérification + Avis + i18n + Offline + Wilaya + AI

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

const wilayaModal = document.getElementById("wilayaModal");
const wilayaSelect = document.getElementById("wilayaSelect");
const wilayaComment = document.getElementById("wilayaComment");
const wilayaDescription = document.getElementById("wilayaDescription");
const wilayaBrand = document.getElementById("wilayaBrand");
const wilayaProductName = document.getElementById("wilayaProductName");
const wilayaImage = document.getElementById("wilayaImage");
const wilayaImagePreview = document.getElementById("wilayaImagePreview");
const wilayaImagePreviewImg = document.getElementById("wilayaImagePreviewImg");
const wilayaImageRemove = document.getElementById("wilayaImageRemove");
const wilayaAiLoading = document.getElementById("wilayaAiLoading");
const wilayaAiResult = document.getElementById("wilayaAiResult");
const wilayaSubmit = document.getElementById("wilayaSubmit");
const wilayaMsg = document.getElementById("wilayaMsg");
const wilayaClose = document.getElementById("wilayaClose");

let currentCode = "";
let currentRating = 0;
let lastResultData = null;
let currentImageDataUrl = null;

function vibrate(pattern = 30) {
  if ("vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function show(type, html) {
  result.className = "result " + type;
  result.innerHTML = html;
  if (type === "success") vibrate([80, 50, 80]);
  else if (type === "warning") vibrate([150, 80, 150]);
  else if (type === "danger") vibrate([250, 100, 250, 100, 250]);
}

// ============================================================
// OFFLINE HISTORY
// ============================================================
function saveVerification(code, status, product) {
  try {
    const key = "qr_verify_history";
    let history = JSON.parse(localStorage.getItem(key) || "[]");
    history.unshift({
      code: code,
      status: status,
      product: product ? { brand: product.brand || null, product_name: product.product_name || null } : null,
      date: new Date().toISOString()
    });
    history = history.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) { console.warn("Save history error:", e); }
}

function loadOfflineHistory() {
  try {
    const key = "qr_verify_history";
    const history = JSON.parse(localStorage.getItem(key) || "[]");
    const listEl = document.getElementById("offlineHistoryList");
    if (!listEl) return;
    if (history.length === 0) { listEl.innerHTML = `<p class="muted" style="text-align:center;padding:20px">لا يوجد سجل محلي</p>`; return; }

    let html = "";
    history.forEach(item => {
      const statusMap = {
        "ORIGINAL": { class: "success", label: "أصلي", icon: "✅" },
        "USED": { class: "warning", label: "مستعمل", icon: "⚠️" },
        "PENDING": { class: "warning", label: "غير مفعّل", icon: "⏳" },
        "NOT_FOUND": { class: "danger", label: "مقلد", icon: "❌" },
        "DISABLED": { class: "danger", label: "معطل", icon: "🚫" },
        "EXPIRED": { class: "warning", label: "منتهي", icon: "⏰" }
      };
      const st = statusMap[item.status] || { class: "warning", label: item.status, icon: "❓" };
      const date = item.date ? new Date(item.date).toLocaleString("ar-DZ") : "";
      const productName = item.product?.product_name || item.product?.brand || "";

      html += `
        <div class="offline-history-item ${st.class}">
          <div class="offline-history-icon">${st.icon}</div>
          <div class="offline-history-info">
            <div class="offline-history-code">${escapeHtml(item.code)}</div>
            <div class="offline-history-meta">${productName ? escapeHtml(productName) + " • " : ""}${escapeHtml(date)}</div>
          </div>
          <div class="offline-history-status ${st.class}">${st.label}</div>
        </div>`;
    });
    listEl.innerHTML = html;
  } catch (e) { console.warn("Load history error:", e); }
}

// ============================================================
// WILAYA MODAL
// ============================================================
function openWilayaModal() {
  if (!wilayaModal) return;
  wilayaModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (wilayaSelect) wilayaSelect.value = "";
  if (wilayaComment) wilayaComment.value = "";
  if (wilayaDescription) wilayaDescription.value = "";
  if (wilayaBrand) wilayaBrand.value = "";
  if (wilayaProductName) wilayaProductName.value = "";
  if (wilayaMsg) wilayaMsg.classList.add("hidden");
  if (wilayaAiResult) wilayaAiResult.classList.add("hidden");
  if (wilayaAiLoading) wilayaAiLoading.classList.add("hidden");
  removeImage();
}

function closeWilayaModal() {
  if (!wilayaModal) return;
  wilayaModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function removeImage() {
  currentImageDataUrl = null;
  if (wilayaImage) wilayaImage.value = "";
  if (wilayaImagePreview) wilayaImagePreview.classList.add("hidden");
  if (wilayaImagePreviewImg) wilayaImagePreviewImg.src = "";
  if (wilayaAiResult) wilayaAiResult.classList.add("hidden");
}

if (wilayaImage) {
  wilayaImage.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      wilayaMsg.textContent = "الصورة كبيرة جدًا (الحد الأقصى 4 ميغا).";
      wilayaMsg.className = "wilaya-msg error"; removeImage(); return;
    }
    if (!file.type.startsWith("image/")) {
      wilayaMsg.textContent = "الرجاء اختيار صورة صالحة.";
      wilayaMsg.className = "wilaya-msg error"; removeImage(); return;
    }
    try {
      const dataUrl = await compressImage(file, 512, 0.7);
      currentImageDataUrl = dataUrl;
      if (wilayaImagePreviewImg) wilayaImagePreviewImg.src = dataUrl;
      if (wilayaImagePreview) wilayaImagePreview.classList.remove("hidden");
      if (wilayaMsg) wilayaMsg.classList.add("hidden");
      await analyzeImageWithAI(dataUrl);
    } catch (err) {
      console.error("Image error:", err);
      wilayaMsg.textContent = "❌ " + (err.message || "خطأ في معالجة الصورة."); 
wilayaMsg.className = "wilaya-msg error"; 
removeImage();
    }
  });
}

async function analyzeImageWithAI(dataUrl) {
  if (wilayaAiLoading) wilayaAiLoading.classList.remove("hidden");
  if (wilayaAiResult) wilayaAiResult.classList.add("hidden");
  if (wilayaMsg) wilayaMsg.classList.add("hidden");

  try {
    const res = await fetch("/api/ai?mode=analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl })
    });

    if (!res.ok) {
      throw new Error("HTTP error " + res.status);
    }

    const data = await res.json();

    // ✅ التحقق الصارم من البيانات قبل استخدامها
    if (!data || typeof data !== 'object') {
      throw new Error("Invalid response format");
    }

    if (data.status === "OK" && data.brand !== undefined) {
      const brandSelect = document.getElementById("wilayaBrand");
      const detectedBrand = (data.brand || "").trim();
      
      if (detectedBrand && brandSelect) {
        const options = brandSelect.options ? Array.from(brandSelect.options) : [];
        const match = options.find(o => o.value.toLowerCase() === detectedBrand.toLowerCase());
        
        if (match) {
          brandSelect.value = match.value;
        } else {
          const newOpt = document.createElement("option");
          newOpt.value = detectedBrand;
          newOpt.textContent = detectedBrand;
          brandSelect.appendChild(newOpt);
          brandSelect.value = detectedBrand;
        }
      }
      
      if (wilayaProductName) wilayaProductName.value = data.product_name || "";
      if (wilayaDescription) wilayaDescription.value = data.description || "";
      if (wilayaAiResult) wilayaAiResult.classList.remove("hidden");
      // ✅ عرض ملاحظة حمراء متحركة تحت حقل العلامة التجارية
      const brandInput = document.getElementById("wilayaBrand");
      if (brandInput) {
        // إزالة أي ملاحظة قديمة
        const oldNote = document.querySelector(".ai-hint-note");
        if (oldNote) oldNote.remove();

        // إنشاء الملاحظة الجديدة
        const note = document.createElement("div");
        note.className = "ai-hint-note";
        note.style.cssText = `
          margin-top: 8px;
          padding: 10px 14px;
          background: rgba(220, 38, 38, 0.15);
          border: 1.5px solid rgba(220, 38, 38, 0.5);
          border-radius: 10px;
          font-size: 12.5px;
          color: #fca5a5;
          font-weight: 700;
          line-height: 1.5;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: noteShake 0.6s ease-in-out;
        `;
        note.innerHTML = `
          <span style="font-size: 18px;">⚠️</span>
          <span>يرجى مراجعة اسم العلامة التجارية وتصحيحه إذا كان مخطئاً.</span>
        `;

        // إضافة حركة النبض/الاهتزاز
        const style = document.createElement('style');
        style.textContent = `
          @keyframes noteShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-5px); }
            40% { transform: translateX(5px); }
            60% { transform: translateX(-3px); }
            80% { transform: translateX(3px); }
          }
        `;
        if (!document.querySelector('#noteShakeStyle')) {
          style.id = 'noteShakeStyle';
          document.head.appendChild(style);
        }

        // ✅ إضافة الملاحظة تحت حقل الإدخال مباشرة
        brandInput.insertAdjacentElement('afterend', note);
      }
      
    } else {
      // ⚠️ فشل التحليل (لكن الـ API رد)
      console.warn("AI Analysis Failed:", data);
      if (wilayaMsg) {
        wilayaMsg.textContent = "⚠️ لم نتمكن من تحليل الصورة تلقائياً. يرجى كتابة البيانات يدوياً.";
        wilayaMsg.className = "wilaya-msg error";
        wilayaMsg.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error("AI Analysis Network Error:", err);
    if (wilayaMsg) {
      wilayaMsg.textContent = "⚠️ خدمة التحليل غير متوفرة حالياً. يرجى كتابة البيانات يدوياً.";
      wilayaMsg.className = "wilaya-msg error";
      wilayaMsg.classList.remove("hidden");
    }
  } finally {
    if (wilayaAiLoading) wilayaAiLoading.classList.add("hidden");
  }
}

function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("لم يتم اختيار أي صورة."));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (ev) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("المتصفح لا يدعم معالجة الصور."));
            return;
          }
          
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          
          if (!dataUrl || dataUrl === "data:,") {
            reject(new Error("فشل تحويل الصورة."));
            return;
          }
          
          resolve(dataUrl);
        } catch (e) {
          reject(new Error("خطأ أثناء معالجة الصورة: " + e.message));
        }
      };
      
      img.onerror = () => {
        reject(new Error("الصورة غير صالحة أو تالفة."));
      };
      
      img.src = ev.target.result;
    };
    
    reader.onerror = () => {
      reject(new Error("فشل قراءة الملف من الجهاز."));
    };
    
    reader.readAsDataURL(file);
  });
}

if (wilayaClose) wilayaClose.addEventListener("click", closeWilayaModal);
const _wo = document.querySelector(".wilaya-modal-overlay");
if (_wo) _wo.addEventListener("click", closeWilayaModal);

if (wilayaSubmit) {
  wilayaSubmit.addEventListener("click", async () => {
    const wilaya = (wilayaSelect?.value || "").trim();
    const comment = (wilayaComment?.value || "").trim();
    const description = (wilayaDescription?.value || "").trim();
    const brand = (wilayaBrand?.value || "").trim();
    const productName = (wilayaProductName?.value || "").trim();

    if (!wilaya) { wilayaMsg.textContent = "الرجاء اختيار الولاية"; wilayaMsg.className = "wilaya-msg error"; return; }
    if (!currentImageDataUrl) { wilayaMsg.textContent = "الرجاء تصوير المنتج أولًا"; wilayaMsg.className = "wilaya-msg error"; return; }

    wilayaSubmit.disabled = true;
    wilayaSubmit.textContent = "جاري الإرسال...";
    wilayaMsg.classList.add("hidden");

    try {
      const payload = {
        attempted_code: currentCode || null,
        wilaya: wilaya,
        comment: comment || null,
        product_description: description || null,
        product_brand: brand || null,
        product_name: productName || null,
        product_image: currentImageDataUrl || null
      };
      const res = await fetch("/api/submit?type=report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "OK") {
        wilayaMsg.textContent = "✓ تم إرسال البلاغ. شكرًا لك!";
        wilayaMsg.className = "wilaya-msg success";
        setTimeout(() => { closeWilayaModal(); wilayaSubmit.disabled = false; wilayaSubmit.textContent = "📩 إرسال البلاغ"; }, 2000);
      } else {
        wilayaMsg.textContent = "Erreur : " + (data.message || ""); wilayaMsg.className = "wilaya-msg error";
        wilayaSubmit.disabled = false; wilayaSubmit.textContent = "📩 إرسال البلاغ";
      }
    } catch (e) {
      wilayaMsg.textContent = "خطأ في الاتصال. الرجاء المحاولة مجددًا.";
      wilayaMsg.className = "wilaya-msg error";
      wilayaSubmit.disabled = false; wilayaSubmit.textContent = "📩 إرسال البلاغ";
    }
  });
}

// ============================================================
// RENDU DES RÉSULTATS
// ============================================================
function renderResult(data) {
  if (!data) { result.className = "result hidden"; return; }

  if (data.status === "ORIGINAL") {
    if (data.is_shop_lot === true) {
      window.__lastVerifiedProduct = null;
      show("success", `
        <div class="product-card" style="border-color:#22c55e;">
          <div class="card-badge" style="background:linear-gradient(135deg,#0f172a,#1e293b);"><span class="card-badge-icon">🛡️</span><span>منتج من محل موثوق</span></div>
          <div class="card-header" style="margin-top:14px;"><h2 class="card-brand" style="color:#16a34a;font-size:22px;">✅ منتج أصلي</h2><p class="card-product" style="font-size:14px;line-height:1.7;margin-top:10px;">هذا المنتج يباع في <b style="color:#16a34a;">محل موثوق من OriginalDz</b></p></div>
          <div style="background:linear-gradient(160deg,#fef3c7,#fde68a);border:2px solid #f59e0b;border-radius:16px;padding:18px 16px;margin:18px 0;text-align:right;">
            <div style="font-size:14px;font-weight:900;color:#92400e;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><span>⚠️</span><span>في حالة كان المنتج مقلدًا:</span></div>
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;">
              <li style="font-size:13.5px;color:#78350f;line-height:1.6;padding-right:22px;position:relative;"><span style="position:absolute;right:0;top:0;">•</span><b>أبلغنا فورًا</b> عبر الزر أدناه</li>
              <li style="font-size:13.5px;color:#78350f;line-height:1.6;padding-right:22px;position:relative;"><span style="position:absolute;right:0;top:0;">•</span>سيتم <b>تعويضك بـ 50%</b> من سعر المنتج</li>
              <li style="font-size:11.5px;color:#a16207;line-height:1.5;margin-top:6px;font-style:italic;padding-right:22px;">(بعد تأكدنا من أن المنتج مقلد فعلًا)</li>
            </ul>
          </div>
          <div class="card-actions" style="margin-top:16px;"><button type="button" class="card-action-btn primary" onclick="document.getElementById('reportBtn').click()"><span>🚨</span><span>أبلغنا الآن</span></button></div>
        </div>`);
      reportSection.classList.remove("hidden");
      return;
    }

    const p = data.product || {};
    window.__lastVerifiedProduct = { brand: p.brand || null, product_name: p.product_name || null, reference: p.reference || null, lot: p.lot || null, manufacture_date: p.manufacture_date || null, expiry_date: p.expiry_date || null };
    const productCardId = "product-card-" + Date.now();
    window.__currentProductCardId = productCardId;

    show("success", `
      <div class="product-card" id="${productCardId}">
        <div class="card-badge"><span class="card-badge-icon">✓</span><span>${escapeHtml(t("originalTitle"))}</span></div>
        ${p.product_image ? `<div class="card-image-wrap"><img class="card-image" src="${escapeHtml(p.product_image)}" alt=""></div>` : `<div class="card-image-wrap card-image-placeholder"><img src="/icon.png" alt=""></div>`}
        <div class="card-header">${p.brand ? `<h2 class="card-brand">${escapeHtml(p.brand)}</h2>` : ""}${p.product_name ? `<p class="card-product">${escapeHtml(p.product_name)}</p>` : ""}</div>
        <div class="card-details">
          ${p.reference ? `<div class="card-detail-row"><span class="card-detail-icon">🔖</span><span class="card-detail-label">${escapeHtml(t("referenceLabel"))}</span><span class="card-detail-value">${escapeHtml(p.reference)}</span></div>` : ""}
          ${p.lot ? `<div class="card-detail-row"><span class="card-detail-icon">📦</span><span class="card-detail-label">${escapeHtml(t("lotLabel"))}</span><span class="card-detail-value">${escapeHtml(p.lot)}</span></div>` : ""}
          ${p.manufacture_date ? `<div class="card-detail-row"><span class="card-detail-icon">📅</span><span class="card-detail-label">${escapeHtml(t("fabricationLabel"))}</span><span class="card-detail-value">${escapeHtml(p.manufacture_date)}</span></div>` : ""}
          ${p.expiry_date ? `<div class="card-detail-row"><span class="card-detail-icon">⏰</span><span class="card-detail-label">${escapeHtml(t("expirationLabel"))}</span><span class="card-detail-value">${escapeHtml(p.expiry_date)}</span></div>` : ""}
        </div>
        ${p.description ? `<div class="card-description">${escapeHtml(p.description)}</div>` : ""}
        <div class="card-actions">
          <button type="button" class="card-action-btn" id="saveCardBtn-${productCardId}"><span>💾</span><span>حفظ البطاقة</span></button>
          <button type="button" class="card-action-btn primary" id="shareCardBtn-${productCardId}"><span>📤</span><span>مشاركة</span></button>
        </div>
      </div>
      ${(p.instagram_url || p.facebook_url || p.tiktok_url) ? `
        <div class="social-links">
          <p class="social-title">${escapeHtml(t("followUs"))}</p>
          <div class="social-buttons">
            ${p.instagram_url ? `<a href="${escapeHtml(p.instagram_url)}" target="_blank" rel="noopener" class="social-btn social-instagram" aria-label="Instagram"><img src="/instagram.png" alt="Instagram" class="social-icon-img"><span>Instagram</span></a>` : ""}
            ${p.facebook_url ? `<a href="${escapeHtml(p.facebook_url)}" target="_blank" rel="noopener" class="social-btn social-facebook" aria-label="Facebook"><img src="/facebook.png" alt="Facebook" class="social-icon-img"><span>Facebook</span></a>` : ""}
            ${p.tiktok_url ? `<a href="${escapeHtml(p.tiktok_url)}" target="_blank" rel="noopener" class="social-btn social-tiktok" aria-label="TikTok"><img src="/tiktok.png" alt="TikTok" class="social-icon-img"><span>TikTok</span></a>` : ""}
          </div>
        </div>` : ""}
    `);

    setTimeout(() => {
      const saveBtn = document.getElementById("saveCardBtn-" + productCardId);
      const shareBtn = document.getElementById("shareCardBtn-" + productCardId);
      if (saveBtn) saveBtn.onclick = () => saveProductCard(p);
      if (shareBtn) shareBtn.onclick = () => shareProductCard(p);
    }, 100);

    feedbackSection.classList.remove("hidden");
    reportSection.classList.remove("hidden");

  } else if (data.status === "USED") {
    window.__lastVerifiedProduct = null;
    show("warning", `<div class="icon">!</div><h2>${escapeHtml(t("usedTitle"))}</h2><p>${escapeHtml(t("usedMsg"))}</p>`);
    reportSection.classList.remove("hidden");
  } else if (data.status === "PENDING") {
    window.__lastVerifiedProduct = null;
    show("warning", `<div class="icon">⏳</div><h2>${escapeHtml(t("pendingTitle"))}</h2><p>${escapeHtml(t("pendingMsg"))}</p>`);
  } else if (data.status === "DISABLED" || data.status === "EXPIRED") {
    window.__lastVerifiedProduct = null;
    show("warning", `<div class="icon">!</div><h2>${escapeHtml(t("invalidTitle"))}</h2><p>${escapeHtml(t("invalidMsg"))}</p>`);
    reportSection.classList.remove("hidden");
  } else {
    window.__lastVerifiedProduct = null;
    show("danger", `<div class="icon">×</div><h2>${escapeHtml(t("notOriginalTitle"))}</h2><p>${escapeHtml(t("notOriginalMsg"))}</p>`);
    reportSection.classList.remove("hidden");
    setTimeout(() => { openWilayaModal(); }, 1500);
  }
}

window.__reapplyMessages = function () {
  if (lastResultData) renderResult(lastResultData);
  if (!btn.disabled) btn.textContent = t("verifyBtn"); else btn.textContent = t("verifying");
  if (!feedbackMsg.classList.contains("hidden") && feedbackMsg.textContent.includes("✓")) feedbackMsg.textContent = t("feedbackThanks");
  if (!reportMsg.classList.contains("hidden") && reportMsg.textContent.includes("✓")) reportMsg.textContent = t("reportThanks");
};

// ============================================================
// ÉTOILES & FEEDBACK
// ============================================================
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
    if (!currentRating) { feedbackMsg.textContent = t("feedbackSelectRating"); feedbackMsg.style.color = "#dc2626"; feedbackMsg.classList.remove("hidden"); return; }
    feedbackSubmit.disabled = true; feedbackSubmit.textContent = "...";
    try {
      const res = await fetch("/api/submit?type=feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret_code: currentCode, type: "rating", rating: currentRating, comment: feedbackComment.value.trim() }) });
      const data = await res.json();
      if (data.status === "OK") {
        feedbackMsg.textContent = t("feedbackThanks"); feedbackMsg.style.color = "#16a34a"; feedbackMsg.classList.remove("hidden");
        feedbackSection.style.opacity = "0.6"; feedbackSection.style.pointerEvents = "none";
      } else { feedbackMsg.textContent = "Erreur : " + (data.message || ""); feedbackMsg.style.color = "#dc2626"; feedbackMsg.classList.remove("hidden"); }
    } catch (e) { feedbackMsg.textContent = t("errorConn"); feedbackMsg.style.color = "#dc2626"; feedbackMsg.classList.remove("hidden"); }
    finally { feedbackSubmit.disabled = false; feedbackSubmit.textContent = t("feedbackSubmit"); }
  });
}

if (reportBtn) {
  reportBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openWilayaModal(); });
}

function resetFeedbackSections() {
  feedbackSection.classList.add("hidden"); reportSection.classList.add("hidden");
  feedbackSection.style.opacity = "1"; feedbackSection.style.pointerEvents = "auto";
  reportSection.style.opacity = "1"; reportSection.style.pointerEvents = "auto";
  starsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  currentRating = 0; feedbackComment.value = ""; feedbackMsg.classList.add("hidden"); reportMsg.classList.add("hidden");
}

// ============================================================
// VÉRIFICATION
// ============================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  currentCode = code; lastResultData = null; window.__lastVerifiedProduct = null; resetFeedbackSections();
  btn.disabled = true; btn.textContent = t("verifying"); result.className = "result hidden";
  try {
    const r = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret_code: code }) });
    const data = await r.json();
    lastResultData = data; renderResult(data); saveVerification(code, data.status, data.product);
  } catch {
    show("danger", `<h2>${escapeHtml(t("errorTitle"))}</h2><p>${escapeHtml(t("errorMsg"))}</p>`);
  } finally { btn.disabled = false; btn.textContent = t("verifyBtn"); }
});

if (typeof applyTranslations === "function") { applyTranslations(); }

// ============================================================
// ONLINE / OFFLINE
// ============================================================
function updateOnlineStatus() {
  const banner = document.getElementById("offlineBanner");
  const history = document.getElementById("offlineHistory");
  const isOnline = navigator.onLine;
  if (isOnline) {
    if (banner) banner.classList.add("hidden");
    if (history) history.classList.add("hidden");
  } else {
    if (banner) banner.classList.remove("hidden");
    if (history) { history.classList.remove("hidden"); loadOfflineHistory(); }
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
setTimeout(updateOnlineStatus, 1000);
window.__applyOfflineHistory = loadOfflineHistory;

// ============================================================
// PULL TO REFRESH
// ============================================================
(function initPullToRefresh() {
  let startY = 0, currentY = 0, pulling = false;
  const THRESHOLD = 80, MAX_PULL = 140;
  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  indicator.innerHTML = '<div class="spinner"></div><span>جاري التحديث...</span>';
  document.body.appendChild(indicator);

  document.addEventListener("touchstart", (e) => { if (window.scrollY === 0 && !pulling) startY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (startY === 0) return;
    currentY = e.touches[0].clientY - startY;
    if (currentY > 0 && currentY < MAX_PULL && window.scrollY === 0) {
      pulling = true; indicator.style.transition = "none";
      indicator.style.transform = `translateX(-50%) translateY(${Math.min(currentY - 70, 0)}px)`;
    }
  }, { passive: true });
  document.addEventListener("touchend", async () => {
    if (!pulling) { startY = 0; return; }
    if (currentY >= THRESHOLD) {
      indicator.style.transition = "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      indicator.style.transform = "translateX(-50%) translateY(0)";
      if (typeof vibrate === "function") vibrate(30);
      try {
        const codeInput = document.getElementById("code"); if (codeInput) codeInput.value = "";
        const resultBox = document.getElementById("result"); if (resultBox) { resultBox.className = "result hidden"; resultBox.innerHTML = ""; }
        const feedbackSection = document.getElementById("feedbackSection"); if (feedbackSection) feedbackSection.classList.add("hidden");
        const reportSection = document.getElementById("reportSection"); if (reportSection) reportSection.classList.add("hidden");
        window.currentRating = 0;
        const starsContainer = document.getElementById("stars"); if (starsContainer) starsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        if (typeof resetFeedbackSections === "function") resetFeedbackSections();
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { console.warn("Refresh error:", e); }
      setTimeout(() => { indicator.style.transform = "translateX(-50%) translateY(-80px)"; }, 400);
    } else {
      indicator.style.transition = "transform 200ms ease";
      indicator.style.transform = "translateX(-50%) translateY(-80px)";
    }
    pulling = false; startY = 0; currentY = 0;
  });
})();

// ============================================================
// ENHANCED TOAST SYSTEM
// ============================================================
window.showToast = function(message, type = "info", title = "") {
  let container = document.getElementById("toastContainer");
  if (!container) { container = document.createElement("div"); container.id = "toastContainer"; container.className = "toast-container"; document.body.appendChild(container); }
  const icons = { success: "✓", error: "✕", warning: "!", info: "i" };
  const defaultTitles = { success: "نجح", error: "خطأ", warning: "تحذير", info: "معلومة" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-icon">${icons[type] || "i"}</div><div class="toast-content"><div class="toast-title">${title || defaultTitles[type] || ""}</div><div class="toast-message">${String(message).replace(/[<>]/g, "")}</div></div>`;
  container.appendChild(toast);
  if (typeof vibrate === "function") { if (type === "success") vibrate(30); else if (type === "error") vibrate([50, 30, 50]); }
  setTimeout(() => { toast.classList.add("toast-out"); setTimeout(() => toast.remove(), 300); }, 3500);
};
window.toast = window.showToast;

// ============================================================
// PRODUCT CARD — SAVE & SHARE
// ============================================================
async function saveProductCard(p) {
  if (typeof html2canvas === "undefined") {
    try { await new Promise((resolve, reject) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); }); }
    catch (e) { toast("فشل تحميل الأداة", "error"); return; }
  }
  const cardId = window.__currentProductCardId; const cardEl = cardId ? document.getElementById(cardId) : null;
  if (!cardEl) { toast("لم يتم العثور على البطاقة", "error"); return; }
  try {
    toast("جاري إنشاء الصورة...", "info", "الرجاء الانتظار");
    if (typeof vibrate === "function") vibrate(30);
    const canvas = await html2canvas(cardEl, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
    const link = document.createElement("a");
    const brandSlug = (p.brand || "product").replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-");
    link.download = `OriginalDz-${brandSlug}-${Date.now()}.png`; link.href = canvas.toDataURL("image/png"); link.click();
    toast("تم حفظ البطاقة في التنزيلات", "success", "✓ تم");
    if (typeof vibrate === "function") vibrate([80, 50, 80]);
  } catch (e) { console.error("Save card error:", e); toast("فشل حفظ البطاقة", "error"); }
}

async function shareProductCard(p) {
  const brand = p.brand || "", productName = p.product_name || "";
  const text = ["✅ منتج أصلي", "", brand ? `🏢 ${brand}` : "", productName ? `📦 ${productName}` : "", "", "تحققت من أصالته على OriginalDz 🇩🇿"].filter(Boolean).join("\n");
  const url = location.origin;
  if (navigator.share) {
    try { await navigator.share({ title: "منتج أصلي — OriginalDz", text: text, url: url }); if (typeof vibrate === "function") vibrate(30); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text + "\n" + url); toast("تم نسخ النص — الصقه في أي مكان", "success", "✓ تم"); if (typeof vibrate === "function") vibrate(30); }
  catch (e) { toast("فشل النسخ", "error"); }
}

// ============================================================
// SCAN LABEL
// ============================================================
(function initScanLabel() {
  const scanBtn = document.getElementById("scanLabelBtn"); const imageInput = document.getElementById("labelImageInput"); const codeInput = document.getElementById("code");
  if (!scanBtn || !imageInput || !codeInput) return;
  scanBtn.addEventListener("click", () => { imageInput.click(); });
  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { if (typeof toast === "function") toast("اختر صورة صالحة", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { if (typeof toast === "function") toast("الصورة كبيرة جدًا (5MB كحد أقصى)", "error"); return; }
    const originalText = scanBtn.textContent; scanBtn.textContent = "⏳"; scanBtn.disabled = true;
    try {
      const dataUrl = await compressLabelImage(file);
      const res = await fetch("/api/ai?mode=read-label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
      const data = await res.json();
      if (data.status === "OK" && data.code) {
        codeInput.value = data.code; codeInput.focus();
        if (typeof vibrate === "function") vibrate(30);
        if (typeof toast === "function") { const isHigh = data.confidence === "high"; toast(isHigh ? "✅ تم قراءة الكود" : "⚠️ تحقق من الكود قبل التحقق", isHigh ? "success" : "warning"); }
      } else { if (typeof toast === "function") toast(data.message || "لم نتمكن من قراءة الكود، اكتبه يدويًا", "warning"); }
    } catch (err) { console.error("Scan error:", err); if (typeof toast === "function") toast("خطأ في المسح", "error"); }
    finally { scanBtn.textContent = originalText; scanBtn.disabled = false; imageInput.value = ""; }
  });
  function compressLabelImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width, height = img.height; const maxWidth = 800;
          if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, width, height);
          try { resolve(canvas.toDataURL("image/jpeg", 0.7)); } catch (e) { reject(e); }
        };
        img.onerror = reject; img.src = ev.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }
})();
