-- ============================================================
-- OriginalDz — Database Constraints
-- ============================================================
-- ⚠️ شغّل مرة واحدة على قاعدة بيانات جديدة
-- ============================================================

-- UNIQUE على الأكواد (لمنع التكرار)
ALTER TABLE qr_codes 
  ADD CONSTRAINT qr_codes_secret_code_hash_unique 
  UNIQUE (secret_code_hash);

ALTER TABLE qr_codes 
  ADD CONSTRAINT qr_codes_secret_code_unique 
  UNIQUE (secret_code);
