

USE ogrenci_takip;

ALTER TABLE kullanicilar
  MODIFY COLUMN sifre VARCHAR(255) NULL;

ALTER TABLE kullanicilar
  ADD COLUMN google_id VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN github_id VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN facebook_id VARCHAR(64) NULL DEFAULT NULL;

ALTER TABLE kullanicilar
  ADD UNIQUE KEY uk_google_id (google_id),
  ADD UNIQUE KEY uk_github_id (github_id),
  ADD UNIQUE KEY uk_facebook_id (facebook_id);
