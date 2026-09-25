# 🛡️ Produit dz ORG

نظام التحقق من أصالة المنتجات عبر QR + كود سري.

## 🚀 تشغيل المشروع

1. اربط GitHub بـ Vercel
2. أضف متغيرات البيئة في Vercel:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - ENCRYPTION_KEY
   - GEMINI_API_KEY
   - CALLMEBOT_PHONE
   - CALLMEBOT_API_KEY
3. شغّل schema.sql في Supabase
4. انشر: `vercel --prod`

## 🎯 المسارات

- `/` = الصفحة الرئيسية
- `/verify` = التحقق
- `/signup` = تسجيل ماركة
- `/admin.html` = لوحة الأدمن

## 📊 حالات الكود

- `PENDING` = غير مفعّل
- `UNUSED` = جاهز
- `USED` = مستعمل
- `DISABLED` = معطّل

## ⚠️ مهم

- حد Hobby: **12 ملف API** كحد أقصى
- الأدمن: mepirf@gmail.com, abderraoufhazam@gmail.com
