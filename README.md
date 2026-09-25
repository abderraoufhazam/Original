# 🛡️ Produit dz ORG

نظام جزائري للتحقق من أصالة المنتجات عبر **QR ثابت + كود سري مخفي**.

---

## 🎯 الفكرة

كل منتج يحمل ملصقاً عليه:
- 📱 **QR ثابت** — نفس الرمز لكل المنتجات (توفير طباعة)
- 🔐 **كود سري فريد** — تحت طبقة خدش فضية/ذهبية
- ✂️ **خط طي** — لحماية الكود قبل البيع

المستهلك يمسح QR → يخدش → يُدخل الكود → يعرف النتيجة.

---

## 🚀 تشغيل المشروع (خطوات أولية)

### 1. متغيرات البيئة في Vercel

| المتغير | الوصف |
|---|---|
| `SUPABASE_URL` | عنوان مشروع Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة (سري) |
| `ENCRYPTION_KEY` | مفتاح تشفير AES-256 (32 حرف+) |
| `GEMINI_API_KEY` | مفتاح Google Gemini |
| `CALLMEBOT_PHONE` | رقم واتساب الإشعارات |
| `CALLMEBOT_API_KEY` | مفتاح CallMeBot |

### 2. قاعدة البيانات

افتح Supabase → SQL Editor → شغّل `schema.sql` كاملاً:
- 9 جداول
- فهارس
- RLS + Policies
- دالة `verify_code_v2`
- bucket `fake-products`

### 3. النشر

```bash
vercel --prod
