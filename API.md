# 📡 OriginalDz — API Documentation

هذا الملف يوثق جميع الـ Endpoints المتاحة في المنصة.

**Base URL:** `https://originaldz.online/api`

---

## 🔓 Endpoints العامة (لا تحتاج تسجيل دخول)

### 1. التحقق من كود
**`POST /verify`**

**Body:**
```json
{
  "secret_code": "ABC1234"
}
