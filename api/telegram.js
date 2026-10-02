// api/telegram.js
// Telegram Bot — التحقق من الأكواد

import { hashCode } from './_crypto.js';

const TELEGRAM_API = "https://api.telegram.org";

export default async function handler(req, res) {
  // ✅ استجابة سريعة لـ Telegram
  if (req.method === "GET") {
    return res.status(200).json({ status: "OK", message: "Original Telegram Bot" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const update = req.body || {};
    const message = update.message;

    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const firstName = message.from?.first_name || "";
    const rawText = message.text.trim();

    // ✅ الأوامر الخاصة
    if (rawText === "/start") {
      await sendMessage(chatId, `مرحبًا ${firstName} 👋\n\n` +
        `🤖 *OriginalDz Bot*\n\n` +
        `أنا هنا للتحقق من أصالة المنتجات 🇩🇿\n\n` +
        `*كيف أستخدم؟*\n` +
        `1️⃣ امسح QR على المنتج\n` +
        `2️⃣ اكشف الكود السري (خدش الطبقة)\n` +
        `3️⃣ أرسل الكود هنا\n\n` +
        `*مثال:*\n` +
        `\`DHY583T\``,
        "Markdown"
      );
      return res.status(200).json({ ok: true });
    }

    if (rawText === "/help") {
      await sendMessage(chatId,
        `*مساعدة*\n\n` +
        `📱 أرسل الكود المكون من 7 أحرف\n` +
        `مثال: \`DHY583T\`\n\n` +
        `🌐 أو استخدم الموقع:\n` +
        `originaldz.online\n\n` +
        `📞 للدعم:\n` +
        `+213 556 339 415`
      );
      return res.status(200).json({ ok: true });
    }

    if (rawText.startsWith("/")) {
      await sendMessage(chatId, "الأوامر المتاحة:\n/start\n/help");
      return res.status(200).json({ ok: true });
    }

    // ✅ التحقق من الكود
    const cleanCode = rawText.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (cleanCode.length < 6 || cleanCode.length > 14) {
      await sendMessage(chatId,
        `⚠️ *كود غير صالح*\n\n` +
        `أرسل الكود المكون من 7 أحرف فقط.\n` +
        `مثال: \`DHY583T\``,
        "Markdown"
      );
      return res.status(200).json({ ok: true });
    }

    // تحقق عبر Supabase
    const result = await verifyCode(cleanCode);

    if (!result) {
      await sendMessage(chatId, "❌ حدث خطأ في التحقق. حاول لاحقًا.");
      return res.status(200).json({ ok: true });
    }

    // ✅ اعرض النتيجة
    await sendVerificationResult(chatId, result);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Telegram handler error:", error);
    return res.status(200).json({ ok: true });
  }
}

// ============================================================
// 📤 إرسال رسالة
// ============================================================
async function sendMessage(chatId, text, parseMode = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN missing");
    return;
  }

  const body = {
    chat_id: chatId,
    text: text,
    disable_web_page_preview: true
  };

  if (parseMode) body.parse_mode = parseMode;

  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}

// ============================================================
// 🔍 التحقق من الكود
// ============================================================
async function verifyCode(code) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const codeHash = hashCode(code);

    const rpcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/verify_code_v2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          p_code_hash: codeHash,
          p_plaintext_code: code
        })
      }
    );

    if (!rpcRes.ok) {
      console.error("Supabase RPC error:", await rpcRes.text());
      return null;
    }

    return await rpcRes.json();
  } catch (e) {
    console.error("verifyCode error:", e);
    return null;
  }
}

// ============================================================
// 📊 عرض النتيجة
// ============================================================
async function sendVerificationResult(chatId, data) {
  const status = data.status;

  // ✅ أصلي
  if (status === "ORIGINAL") {
    const p = data.product || {};

    const lines = [
      "✅ *منتج أصلي*",
      "",
      "تم التحقق بنجاح 🎉",
      ""
    ];

    if (p.brand) lines.push(`🏢 *الماركة:* ${p.brand}`);
    if (p.product_name) lines.push(`📦 *المنتج:* ${p.product_name}`);
    if (p.reference) lines.push(`🔖 *المرجع:* ${p.reference}`);
    if (p.lot) lines.push(`📊 *Lot:* ${p.lot}`);
    if (p.manufacture_date) lines.push(`📅 *الإنتاج:* ${p.manufacture_date}`);
    if (p.expiry_date) lines.push(`⏰ *الانتهاء:* ${p.expiry_date}`);

    lines.push("");
    lines.push("🌐 originaldz.online");
    lines.push("🇩🇿 OriginalDz");

    await sendMessage(chatId, lines.join("\n"), "Markdown");
    return;
  }

  // ⚠️ مستعمل من قبل
  if (status === "USED") {
    await sendMessage(chatId,
      "⚠️ *كود مستعمل من قبل*\n\n" +
      "هذا الكود تم التحقق منه سابقًا.\n" +
      "إذا كنت تعتقد أنه خطأ، تواصل مع الماركة.",
      "Markdown"
    );
    return;
  }

  // ⏳ غير مفعل
  if (status === "PENDING") {
    await sendMessage(chatId,
      "⏳ *منتج غير مفعّل*\n\n" +
      "هذا الكود لم يُفعّل بعد.\n" +
      "تواصل مع العلامة التجارية.",
      "Markdown"
    );
    return;
  }

  // 🚫 معطل أو منتهي
  if (status === "DISABLED" || status === "EXPIRED") {
    await sendMessage(chatId,
      "🚫 *كود غير صالح*\n\n" +
      "هذا الكود معطّل أو منتهي الصلاحية.",
      "Markdown"
    );
    return;
  }

  // ❌ غير موجود = مقلد
  await sendMessage(chatId,
    "❌ *منتج غير أصلي*\n\n" +
    "لم نجد هذا الكود في قاعدة بياناتنا.\n" +
    "احذر — قد يكون المنتج مقلدًا!\n\n" +
    "💡 تواصل مع الماركة للتحقق.",
    "Markdown"
  );
}
