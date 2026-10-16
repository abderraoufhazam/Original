// ============================================================
// helpers.js — Shared utility functions for OriginalDz
// ============================================================

/**
 * Escape HTML characters (prevents XSS)
 */
function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/**
 * Format amount as Algerian Dinar (DA)
 * Example: 1500 → "1 500 DA"
 */
function formatMoney(amount) {
  const num = parseFloat(amount || 0);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }) + " DA";
}

/**
 * Format amount as Algerian Dinar (دج) - for shop dashboard
 * Example: 1500 → "1 500 دج"
 */
function formatMoneyDZ(amount) {
  const num = parseFloat(amount || 0);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + " دج";
}

/**
 * Normalize and uppercase a code for display
 */
function formatDisplayCode(code) {
  if (!code) return '';
  return String(code).trim().toUpperCase();
}

/**
 * Format date to French locale
 */
function formatDateFr(dateStr, options = {}) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("fr-FR", options);
  } catch {
    return "—";
  }
}

// Expose globally (for use in inline scripts and modules)
window.escapeHtml = escapeHtml;
window.formatMoney = formatMoney;
window.formatMoneyDZ = formatMoneyDZ;
window.formatDisplayCode = formatDisplayCode;
window.formatDateFr = formatDateFr;
