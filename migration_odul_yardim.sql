

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

CREATE TABLE IF NOT EXISTS vs_istekleri (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    gonderen_id INT UNSIGNED NOT NULL,
    alan_id INT UNSIGNED NOT NULL,
    durum ENUM('bekliyor','kabul','red','iptal','tamamlandi') NOT NULL DEFAULT 'bekliyor',
    gonderen_bildirildi TINYINT(1) NOT NULL DEFAULT 0,
    olusturma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vs_alan_durum (alan_id, durum),
    KEY idx_vs_gonderen_durum (gonderen_id, durum),
    CONSTRAINT fk_vs_gonderen FOREIGN KEY (gonderen_id) REFERENCES kullanicilar (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_vs_alan FOREIGN KEY (alan_id) REFERENCES kullanicilar (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
