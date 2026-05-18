

USE ogrenci_takip;

ALTER TABLE kullanicilar MODIFY COLUMN sifre VARCHAR(255) NULL;

ALTER TABLE kullanicilar ADD COLUMN rol VARCHAR(32) NOT NULL DEFAULT 'kullanici';

ALTER TABLE kullanicilar ADD COLUMN google_id VARCHAR(64) NULL;
ALTER TABLE kullanicilar ADD COLUMN github_id VARCHAR(64) NULL;
ALTER TABLE kullanicilar ADD COLUMN facebook_id VARCHAR(64) NULL;

CREATE UNIQUE INDEX uk_google_id ON kullanicilar (google_id);
CREATE UNIQUE INDEX uk_github_id ON kullanicilar (github_id);
CREATE UNIQUE INDEX uk_facebook_id ON kullanicilar (facebook_id);

