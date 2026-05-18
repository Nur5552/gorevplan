

USE ogrenci_takip;

CREATE TABLE IF NOT EXISTS kullanici_odul (
    kullanici_id INT UNSIGNED NOT NULL,
    puan INT UNSIGNED NOT NULL DEFAULT 0,
    seviye VARCHAR(32) NOT NULL DEFAULT 'baslangic',
    PRIMARY KEY (kullanici_id),
    CONSTRAINT fk_odul_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yardim_talepleri (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    kullanici_id INT UNSIGNED NOT NULL,
    tur ENUM('ucretsiz','ucretli') NOT NULL,
    durum ENUM('yeni','inceleniyor','cozuldu') NOT NULL DEFAULT 'yeni',
    konu VARCHAR(200) NULL,
    mesaj TEXT NOT NULL,
    olusturma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_yardim_kullanici (kullanici_id),
    CONSTRAINT fk_yardim_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
