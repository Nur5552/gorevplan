

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS ogrenci_takip;
CREATE DATABASE ogrenci_takip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ogrenci_takip;

CREATE TABLE kullanicilar (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ad VARCHAR(100) NOT NULL,
  soyad VARCHAR(100) NOT NULL,
  kullanici_adi VARCHAR(64) NOT NULL,
  sifre VARCHAR(255) NULL,
  rol VARCHAR(32) NOT NULL DEFAULT 'kullanici',
  google_id VARCHAR(64) NULL DEFAULT NULL,
  github_id VARCHAR(64) NULL DEFAULT NULL,
  facebook_id VARCHAR(64) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_kullanici_adi (kullanici_adi),
  UNIQUE KEY uk_google_id (google_id),
  UNIQUE KEY uk_github_id (github_id),
  UNIQUE KEY uk_facebook_id (facebook_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gorevler (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kullanici_id INT UNSIGNED NOT NULL,
  gorev_adi VARCHAR(255) NOT NULL,
  aciklama TEXT NULL,
  son_tarih DATE NULL,
  durum ENUM('bekliyor', 'devam_ediyor', 'tamamlandi') NOT NULL DEFAULT 'bekliyor',
  olusturma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gorevler_kullanici (kullanici_id),
  CONSTRAINT fk_gorevler_kullanici
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- İlk admin (şifre: admin123 — üretimde değiştirin)
-- Şifre bcrypt ile değiştirilmeli; örnek: Node'da bcrypt.hash('admin123',10) çıktısını kullanın.
-- Basit test için doğrudan kayıt ekranından admin oluşturup phpMyAdmin'de rolü 'admin' yapın:
-- UPDATE kullanicilar SET rol = 'admin' WHERE kullanici_adi = 'sizin_kullanici';
