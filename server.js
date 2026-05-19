require('dotenv').config();
const fs = require('fs');
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { EventEmitter } = require('events');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();
const BASE_URL = (process.env.BASE_URL || 'https://www.gorevplan.com.tr').replace(/\/$/, '');
const GOREV_DURUMLARI = ['bekliyor', 'devam_ediyor', 'tamamlandi'];
const TAMAMLAMA_PUANI = 15;
const FORUM_URL = process.env.FORUM_URL || 'https://www.reddit.com/r/GetStudying/';
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    app.set('trust proxy', 1);
}

function seviyeKodu(puan) {
    const p = Number(puan) || 0;
    if (p >= 300) return 'sampiyon';
    if (p >= 150) return 'azimli';
    if (p >= 50) return 'caliskan';
    return 'baslangic';
}

function seviyeEtiket(kod) {
    const m = { baslangic: 'Başlangıç', caliskan: 'Çalışkan', azimli: 'Azimli', sampiyon: 'Şampiyon' };
    return m[kod] || kod;
}

function sonrakiEsik(puan) {
    const p = Number(puan) || 0;
    if (p < 50) return { hedef: 50, kalan: Math.max(0, 50 - p) };
    if (p < 150) return { hedef: 150, kalan: Math.max(0, 150 - p) };
    if (p < 300) return { hedef: 300, kalan: Math.max(0, 300 - p) };
    return { hedef: null, kalan: 0 };
}

function yoksay(e, kodlar) {
    return e && kodlar.includes(e.code);
}

function siraSorgu(liste, bitti) {
    let i = 0;
    function siradaki(hata) {
        if (hata) return bitti(hata);
        if (i >= liste.length) return bitti();
        const adim = liste[i++];
        db.query(adim.sql, (err) => {
            if (err && adim.yoksay && adim.yoksay(err)) return siradaki();
            if (err) return siradaki(err);
            siradaki();
        });
    }
    siradaki();
}

function veritabaniHazirla(cb) {
    const adimlar = [
        {
            sql: `CREATE TABLE IF NOT EXISTS kullanicilar (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                ad VARCHAR(100) NOT NULL,
                soyad VARCHAR(100) NOT NULL,
                kullanici_adi VARCHAR(100) NOT NULL UNIQUE,
                sifre VARCHAR(255) NULL,
                rol VARCHAR(32) NOT NULL DEFAULT 'kullanici',
                google_id VARCHAR(64) NULL UNIQUE,
                github_id VARCHAR(64) NULL UNIQUE,
                facebook_id VARCHAR(64) NULL UNIQUE,
                olusturma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_kullanici_adi (kullanici_adi)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS gorevler (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                kullanici_id INT UNSIGNED NOT NULL,
                gorev_adi VARCHAR(255) NOT NULL,
                aciklama TEXT NULL,
                son_tarih DATE NULL,
                durum ENUM('bekliyor','devam_ediyor','tamamlandi') NOT NULL DEFAULT 'bekliyor',
                olusturma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_gorev_kullanici (kullanici_id),
                CONSTRAINT fk_gorev_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS kullanici_odul (
                kullanici_id INT UNSIGNED NOT NULL,
                puan INT UNSIGNED NOT NULL DEFAULT 0,
                seviye VARCHAR(32) NOT NULL DEFAULT 'baslangic',
                PRIMARY KEY (kullanici_id),
                CONSTRAINT fk_odul_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS yardim_talepleri (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        {
            sql: `ALTER TABLE yardim_talepleri
                ADD COLUMN durum ENUM('yeni','inceleniyor','cozuldu') NOT NULL DEFAULT 'yeni' AFTER tur`,
            yoksay: (e) => yoksay(e, ['ER_DUP_FIELDNAME'])
        },
        {
            sql: 'ALTER TABLE kullanicilar MODIFY COLUMN sifre VARCHAR(255) NULL',
            yoksay: (e) => yoksay(e, ['ER_BAD_FIELD_ERROR'])
        },
        {
            sql: "ALTER TABLE kullanicilar ADD COLUMN rol VARCHAR(32) NOT NULL DEFAULT 'kullanici'",
            yoksay: (e) => yoksay(e, ['ER_DUP_FIELDNAME'])
        },
        {
            sql: 'ALTER TABLE kullanicilar ADD COLUMN google_id VARCHAR(64) NULL DEFAULT NULL',
            yoksay: (e) => yoksay(e, ['ER_DUP_FIELDNAME'])
        },
        {
            sql: 'ALTER TABLE kullanicilar ADD COLUMN github_id VARCHAR(64) NULL DEFAULT NULL',
            yoksay: (e) => yoksay(e, ['ER_DUP_FIELDNAME'])
        },
        {
            sql: 'ALTER TABLE kullanicilar ADD COLUMN facebook_id VARCHAR(64) NULL DEFAULT NULL',
            yoksay: (e) => yoksay(e, ['ER_DUP_FIELDNAME'])
        },
        {
            sql: 'CREATE UNIQUE INDEX uk_google_id ON kullanicilar (google_id)',
            yoksay: (e) => yoksay(e, ['ER_DUP_KEYNAME'])
        },
        {
            sql: 'CREATE UNIQUE INDEX uk_github_id ON kullanicilar (github_id)',
            yoksay: (e) => yoksay(e, ['ER_DUP_KEYNAME'])
        },
        {
            sql: 'CREATE UNIQUE INDEX uk_facebook_id ON kullanicilar (facebook_id)',
            yoksay: (e) => yoksay(e, ['ER_DUP_KEYNAME'])
        }
    ];

    siraSorgu(adimlar, (err) => {
        if (err) console.warn('Veritabanı şeması güncellenirken uyarı:', err.message);
        if (cb) cb();
    });
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const sessions = new Map();

class SimpleStore extends EventEmitter {
    get(sid, cb) { cb(null, sessions.get(sid) || null); }
    set(sid, sess, cb) { sessions.set(sid, sess); cb(); }
    destroy(sid, cb) { sessions.delete(sid); cb(); }
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'gizli-anahtar-123',
    resave: false,
    saveUninitialized: false,
    name: 'ogrenci.sid',
    store: new SimpleStore(),
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/'
    }
}));
app.use(passport.initialize());
app.use(passport.session());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { basarili: false, mesaj: 'Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' }
});

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'MySQL-FEJV.railway.internal',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
    database: process.env.DB_NAME || 'ogrenci_takip',
    charset: 'utf8mb4'
});

let dbReady = false;

let connectionAttempts = 0;
const maxAttempts = 30;
const retryDelay = 5000; // 5 saniye

function connectDB() {
    connectionAttempts++;
    db.connect((err) => {
        if (err) {
            console.error(`Bağlantı denemesi ${connectionAttempts}/${maxAttempts} başarısız:`, err.message);
            if (connectionAttempts < maxAttempts) {
                console.log(`${retryDelay/1000} saniye sonra tekrar deneniyor...`);
                setTimeout(connectDB, retryDelay);
            } else {
                console.error('Maksimum deneme sayısına ulaşıldı. Sunucu başlatılıyor...');
                startServer();
            }
            return;
        }
        dbReady = true;
        console.log('MySQL bağlandı');
        veritabaniHazirla(() => startServer());
    });
}

connectDB();
db.on('error', (err) => console.error('MySQL:', err.code, err.message));

function findUserById(id, done) {
    db.query('SELECT * FROM kullanicilar WHERE id = ?', [id], (e, rows) => {
        if (e) return done(e);
        done(null, rows[0] || null);
    });
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => findUserById(id, done));

function findOAuthUser(provider, providerId, cb) {
    const col = { google: 'google_id', github: 'github_id', facebook: 'facebook_id' }[provider];
    if (!col) return cb(new Error('Geçersiz sağlayıcı'));
    db.query(`SELECT * FROM kullanicilar WHERE ${col} = ?`, [providerId], cb);
}

function insertOAuthUser(provider, providerId, ad, soyad, kullanici_adi, cb) {
    const rows = {
        google: { sql: 'INSERT INTO kullanicilar (ad, soyad, kullanici_adi, sifre, google_id) VALUES (?, ?, ?, NULL, ?)', vals: [ad, soyad, kullanici_adi, providerId] },
        github: { sql: 'INSERT INTO kullanicilar (ad, soyad, kullanici_adi, sifre, github_id) VALUES (?, ?, ?, NULL, ?)', vals: [ad, soyad, kullanici_adi, providerId] },
        facebook: { sql: 'INSERT INTO kullanicilar (ad, soyad, kullanici_adi, sifre, facebook_id) VALUES (?, ?, ?, NULL, ?)', vals: [ad, soyad, kullanici_adi, providerId] }
    }[provider];
    db.query(rows.sql, rows.vals, cb);
}

function findOrCreateOAuthUser(provider, profile, done) {
    let providerId, ad = 'Kullanıcı', soyad = '', kullanici_adi;
    if (provider === 'google') {
        providerId = String(profile.id);
        ad = profile.name?.givenName || (profile.displayName && profile.displayName.split(' ')[0]) || ad;
        soyad = profile.name?.familyName || '';
        if (!soyad && profile.displayName) {
            const p = profile.displayName.split(' ');
            if (p.length > 1) soyad = p.slice(1).join(' ');
        }
        kullanici_adi = `google_${providerId}`;
    } else if (provider === 'github') {
        providerId = String(profile.id);
        ad = (profile.displayName && profile.displayName.split(' ')[0]) || profile.username || 'GitHub';
        soyad = profile.displayName ? profile.displayName.split(' ').slice(1).join(' ') : '';
        kullanici_adi = profile.username ? `gh_${profile.username}` : `github_${providerId}`;
    } else if (provider === 'facebook') {
        providerId = String(profile.id);
        ad = profile.name?.givenName || (profile.displayName && profile.displayName.split(' ')[0]) || 'Facebook';
        soyad = profile.name?.familyName || '';
        if (!soyad && profile.displayName) {
            const p = profile.displayName.split(' ');
            if (p.length > 1) soyad = p.slice(1).join(' ');
        }
        kullanici_adi = `fb_${providerId}`;
    } else return done(new Error('Bilinmeyen sağlayıcı'));

    findOAuthUser(provider, providerId, (err, rows) => {
        if (err) return done(err);
        if (rows && rows.length > 0) return done(null, rows[0]);
        const tryInsert = (username, attempt) => {
            insertOAuthUser(provider, providerId, ad, soyad, username, (e, result) => {
                if (e && e.code === 'ER_DUP_ENTRY' && attempt < 5) {
                    return tryInsert(`${kullanici_adi}_${attempt + 1}`, attempt + 1);
                }
                if (e) return done(e);
                findUserById(result.insertId, done);
            });
        };
        tryInsert(kullanici_adi, 0);
    });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use('google', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/google/callback`
    }, (_accessToken, _refreshToken, profile, done) => findOrCreateOAuthUser('google', profile, done)));
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use('github', new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/github/callback`
    }, (_accessToken, _refreshToken, profile, done) => findOrCreateOAuthUser('github', profile, done)));
}
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use('facebook', new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${BASE_URL}/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'name', 'emails']
    }, (_accessToken, _refreshToken, profile, done) => findOrCreateOAuthUser('facebook', profile, done)));
}

function oauthHazir(provider) {
    if (provider === 'google') return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    if (provider === 'github') return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    if (provider === 'facebook') return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    return false;
}
function oauthRedirectKapali(req, res, next) {
    if (!oauthHazir(req.oauthProvider)) return res.redirect('/giris.html?oauth=kapali');
    next();
}

function oturumuAyarla(req, res) {
    if (req.user) {
        req.session.kullanici = {
            id: req.user.id,
            ad: req.user.ad,
            soyad: req.user.soyad,
            kullanici_adi: req.user.kullanici_adi,
            rol: req.user.rol || 'kullanici',
            admin: req.user.rol === 'admin'
        };
    }
    res.redirect('/panel');
}

function guvenliSonraYol(u) {
    if (!u || typeof u !== 'string' || u.includes('//') || !u.startsWith('/')) return '';
    return u.split('?')[0];
}

function girisJsonKaydet(req, res, body) {
    req.session.save((err) => {
        if (err) console.error('Oturum kayıt:', err.message);
        res.json(body);
    });
}

function jsonHata(res, status, mesaj) {
    return res.status(status).json({ basarili: false, mesaj });
}

function girisKontrol(req, res, next) {
    if (req.session && req.session.kullanici) return next();
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (acceptsJson || req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(401).json({ basarili: false, mesaj: 'Oturum bulunamadı.' });
    }
    const sonra = encodeURIComponent(guvenliSonraYol(req.originalUrl) || '/panel');
    res.redirect(`/giris.html?sonra=${sonra}`);
}

function adminKontrol(req, res, next) {
    const ku = req.session && req.session.kullanici;
    const adminMi = !!(ku && (ku.admin === true || ku.rol === 'admin'));
    if (adminMi) return next();
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (acceptsJson || req.xhr) return res.status(403).json({ basarili: false, mesaj: 'Yetkisiz.' });
    res.redirect('/giris.html?sonra=' + encodeURIComponent('/admin'));
}

app.get('/auth/google', (req, res, next) => { req.oauthProvider = 'google'; next(); }, oauthRedirectKapali, passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/giris.html?oauth=hata' }), oturumuAyarla);
app.get('/auth/github', (req, res, next) => { req.oauthProvider = 'github'; next(); }, oauthRedirectKapali, passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/giris.html?oauth=hata' }), oturumuAyarla);
app.get('/auth/facebook', (req, res, next) => { req.oauthProvider = 'facebook'; next(); }, oauthRedirectKapali, passport.authenticate('facebook', { scope: ['public_profile'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/giris.html?oauth=hata' }), oturumuAyarla);

function tanitimGonder(res) {
    const p = path.join(__dirname, 'public', 'tanitim.html');
    if (!fs.existsSync(p)) {
        return res.status(200).type('html').send('<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Görev Takip</title></head><body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#fff"><h1>Görev Takip</h1><p><a href="/giris.html" style="color:#a78bfa">Giriş yap</a></p><p><small>tanitim.html bulunamadı — public klasörünü kontrol edin.</small></p></body></html>');
    }
    res.sendFile(path.resolve(p), (err) => {
        if (err) {
            console.error('tanitim.html:', err.message);
            if (!res.headersSent) res.status(500).send('Sayfa gönderilemedi.');
        }
    });
}

app.get('/', (req, res) => tanitimGonder(res));
app.get('/tanitim.html', (req, res) => tanitimGonder(res));
app.get('/panel', girisKontrol, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html', girisKontrol, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/kayit', authLimiter, async (req, res) => {
    const { ad, soyad, kullanici_adi, sifre } = req.body;
    if (!ad || !soyad || !kullanici_adi || !sifre) {
        return jsonHata(res, 400, 'Tüm alanları doldurun.');
    }
    let sifreliSifre;
    try {
        sifreliSifre = await bcrypt.hash(sifre, 10);
    } catch (e) {
        return jsonHata(res, 500, 'Kayıt hatası');
    }
    db.query('INSERT INTO kullanicilar (ad, soyad, kullanici_adi, sifre) VALUES (?,?,?,?)', [ad, soyad, kullanici_adi, sifreliSifre], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return jsonHata(res, 409, 'Kullanıcı adı kullanılıyor.');
            return jsonHata(res, 500, 'Kayıt hatası');
        }
        res.json({ basarili: true, mesaj: 'Kayıt başarılı.' });
    });
});

app.post('/api/giris', authLimiter, (req, res) => {
    const kaRaw = String(req.body.kullanici_adi || '').trim();
    const sifreT = String(req.body.sifre || '').trim();

    if (!kaRaw) {
        return jsonHata(res, 400, 'Kullanıcı adı girin.');
    }

    db.query('SELECT * FROM kullanicilar WHERE LOWER(TRIM(kullanici_adi)) = LOWER(?)', [kaRaw], async (err, results) => {
        if (err) return jsonHata(res, 500, 'Veritabanı hatası.');
        if (!results || !results.length) return jsonHata(res, 401, 'Kullanıcı bulunamadı.');
        const kullanici = results[0];
        if (!kullanici.sifre) return jsonHata(res, 400, 'Sosyal giriş kullanın.');
        if (!sifreT) return jsonHata(res, 400, 'Şifre girin.');
        if (!(await bcrypt.compare(sifreT, kullanici.sifre))) return jsonHata(res, 401, 'Şifre yanlış.');
        const rol = kullanici.rol || 'kullanici';
        const adminMi = rol === 'admin';
        req.session.kullanici = {
            id: kullanici.id, ad: kullanici.ad, soyad: kullanici.soyad, kullanici_adi: kullanici.kullanici_adi,
            rol, admin: adminMi
        };
        girisJsonKaydet(req, res, { basarili: true, mesaj: 'Giriş başarılı.', admin: adminMi });
    });
});

app.get('/api/cikis', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => res.redirect('/giris.html'));
    });
});

app.get('/api/kullanici', girisKontrol, (req, res) => res.json(req.session.kullanici));

app.get('/api/gorevler', girisKontrol, (req, res) => {
    db.query('SELECT * FROM gorevler WHERE kullanici_id = ? ORDER BY olusturma_tarihi DESC', [req.session.kullanici.id], (err, results) => {
        if (err) return res.json({ basarili: false, mesaj: 'Görevler alınamadı' });
        res.json({ basarili: true, gorevler: results || [] });
    });
});

app.post('/api/gorev-ekle', girisKontrol, (req, res) => {
    const baslik = typeof req.body.gorev_adi === 'string' ? req.body.gorev_adi.trim() : '';
    if (!baslik) {
        return res.json({ basarili: false, mesaj: 'Görev adı boş olamaz.' });
    }
    const aciklama = req.body.aciklama != null && String(req.body.aciklama).trim() !== '' ? String(req.body.aciklama).trim() : null;
    const sonTarih = req.body.son_tarih != null && String(req.body.son_tarih).trim() !== '' ? String(req.body.son_tarih).trim() : null;
    const sql = 'INSERT INTO gorevler (kullanici_id, gorev_adi, aciklama, son_tarih, durum) VALUES (?,?,?,?,?)';
    db.query(sql, [req.session.kullanici.id, baslik, aciklama, sonTarih, 'bekliyor'], (err, result) => {
        if (err) return res.json({ basarili: false, mesaj: 'Görev eklenemedi' });
        res.json({ basarili: true, mesaj: 'Eklendi', id: result.insertId });
    });
});

app.delete('/api/gorev-sil/:id', girisKontrol, (req, res) => {
    db.query('DELETE FROM gorevler WHERE id = ? AND kullanici_id = ?', [req.params.id, req.session.kullanici.id], (err) => {
        if (err) return res.json({ basarili: false, mesaj: 'Silinemedi' });
        res.json({ basarili: true, mesaj: 'Silindi' });
    });
});

app.put('/api/gorev-guncelle/:id', girisKontrol, (req, res) => {
    const durum = req.body && req.body.durum != null ? String(req.body.durum) : '';
    if (!GOREV_DURUMLARI.includes(durum)) {
        return res.json({ basarili: false, mesaj: 'Geçersiz durum.' });
    }
    const uid = req.session.kullanici.id;
    const gid = req.params.id;
    db.query('SELECT durum FROM gorevler WHERE id = ? AND kullanici_id = ?', [gid, uid], (err, rows) => {
        if (err) return res.json({ basarili: false, mesaj: 'Güncellenemedi' });
        if (!rows || !rows.length) return res.json({ basarili: false, mesaj: 'Görev bulunamadı.' });
        const eskiDurum = rows[0].durum;
        db.query('UPDATE gorevler SET durum = ? WHERE id = ? AND kullanici_id = ?', [durum, gid, uid], (err2, info) => {
            if (err2) return res.json({ basarili: false, mesaj: 'Güncellenemedi' });
            if (!info || info.affectedRows === 0) return res.json({ basarili: false, mesaj: 'Görev bulunamadı.' });
            const odulKazanim = durum === 'tamamlandi' && eskiDurum !== 'tamamlandi';
            if (!odulKazanim) {
                return res.json({ basarili: true, mesaj: 'Güncellendi', tamamlamaOdulu: null });
            }
            db.query(
                'INSERT INTO kullanici_odul (kullanici_id, puan) VALUES (?, ?) ON DUPLICATE KEY UPDATE puan = kullanici_odul.puan + ?',
                [uid, TAMAMLAMA_PUANI, TAMAMLAMA_PUANI],
                (e3) => {
                    if (e3) {
                        console.error('Odul:', e3.message);
                        return res.json({
                            basarili: true,
                            mesaj: 'Güncellendi',
                            tamamlamaOdulu: { kazandi: true, puanHatasi: true, kazanilanPuan: TAMAMLAMA_PUANI }
                        });
                    }
                    db.query('SELECT puan FROM kullanici_odul WHERE kullanici_id = ?', [uid], (e4, pr) => {
                        const puan = pr && pr[0] ? Number(pr[0].puan) : TAMAMLAMA_PUANI;
                        const sev = seviyeKodu(puan);
                        db.query('UPDATE kullanici_odul SET seviye = ? WHERE kullanici_id = ?', [sev, uid], () => {
                            res.json({
                                basarili: true,
                                mesaj: 'Güncellendi',
                                tamamlamaOdulu: {
                                    kazandi: true,
                                    puan,
                                    seviye: sev,
                                    seviyeEtiket: seviyeEtiket(sev),
                                    kazanilanPuan: TAMAMLAMA_PUANI,
                                    sonraki: sonrakiEsik(puan)
                                }
                            });
                        });
                    });
                }
            );
        });
    });
});

app.get('/api/odul', girisKontrol, (req, res) => {
    const uid = req.session.kullanici.id;
    db.query('SELECT puan, seviye FROM kullanici_odul WHERE kullanici_id = ?', [uid], (err, rows) => {
        if (err) return res.json({ basarili: false, mesaj: 'Okunamadı' });
        const puan = rows && rows[0] ? Number(rows[0].puan) : 0;
        const sev = seviyeKodu(puan);
        db.query('UPDATE kullanici_odul SET seviye = ? WHERE kullanici_id = ? AND seviye <> ?', [sev, uid, sev], () => {
            res.json({
                basarili: true,
                puan,
                seviye: sev,
                seviyeEtiket: seviyeEtiket(sev),
                sonraki: sonrakiEsik(puan),
                tamamlamaPuani: TAMAMLAMA_PUANI
            });
        });
    });
});

app.get('/api/yardim-bilgi', girisKontrol, (req, res) => {
    res.json({
        basarili: true,
        forumUrl: FORUM_URL,
        ucretliEkstra: [
            'Talebin öncelikli kuyrukta değerlendirilmesi',
            'Moderatörden 48 saat içinde ilk yanıt hedefi (iş günlerinde)',
            'İstersen ekran görüntüsü / dosya linki ile detaylı inceleme',
            'Haftalık kısa özet: kaç görev tamamladın, önerilen sonraki adım',
            'İleride: canlı sohbet penceresi veya görüntülü kısa seans (planlanan)'
        ]
    });
});

app.post('/api/yardim', girisKontrol, (req, res) => {
    const tur = req.body && req.body.tur != null ? String(req.body.tur) : '';
    const uid = req.session.kullanici.id;
    if (tur === 'ucretsiz') {
        db.query(
            'INSERT INTO yardim_talepleri (kullanici_id, tur, konu, mesaj) VALUES (?,?,?,?)',
            [uid, 'ucretsiz', 'Forum yönlendirmesi', 'Kullanıcı ücretsiz forum bağlantısını kullandı.'],
            () => {}
        );
        return res.json({
            basarili: true,
            mesaj: 'Topluluk forumuna yönlendirilebilirsiniz.',
            forumUrl: FORUM_URL
        });
    }
    if (tur === 'ucretli') {
        const konu = typeof req.body.konu === 'string' ? req.body.konu.trim().slice(0, 200) : '';
        const mesaj = typeof req.body.mesaj === 'string' ? req.body.mesaj.trim() : '';
        if (!mesaj || mesaj.length < 8) {
            return res.json({ basarili: false, mesaj: 'Sorunuzu en az 8 karakter olarak yazın.' });
        }
        db.query(
            'INSERT INTO yardim_talepleri (kullanici_id, tur, konu, mesaj) VALUES (?,?,?,?)',
            [uid, 'ucretli', konu || null, mesaj],
            (e) => {
                if (e) return res.json({ basarili: false, mesaj: 'Kaydedilemedi.' });
                res.json({
                    basarili: true,
                    mesaj: 'Talebiniz moderatör ekibine ve yöneticiye iletildi. Ödeme ve yanıt süreci için iletişim bilgilerinizi güncel tutun.'
                });
            }
        );
        return;
    }
    res.json({ basarili: false, mesaj: 'Geçersiz talep türü.' });
});

app.get('/admin', girisKontrol, adminKontrol, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/admin/istatistikler', girisKontrol, adminKontrol, (req, res) => {
    const sayimSql = `
        SELECT
            (SELECT COUNT(*) FROM kullanicilar) AS kullanici_sayisi,
            (SELECT COUNT(*) FROM gorevler) AS gorev_sayisi,
            (SELECT COUNT(*) FROM yardim_talepleri WHERE tur = 'ucretli') AS ucretli_yardim
    `;
    db.query(sayimSql, (e1, rows) => {
        if (e1) return res.json({ basarili: false });
        db.query('SELECT durum, COUNT(*) as sayi FROM gorevler GROUP BY durum', (e2, rDurum) => {
            if (e2) return res.json({ basarili: false });
            const n = (x) => Number(x);
            const r = rows[0];
            const ku = n(r.kullanici_sayisi);
            res.json({
                basarili: true,
                istatistikler: {
                    toplamKullanici: ku,
                    aktifKullanici: ku,
                    toplamGorev: n(r.gorev_sayisi),
                    ucretliYardimTalebi: n(r.ucretli_yardim),
                    gorevDurumlari: (rDurum || []).map((x) => ({ ...x, sayi: n(x.sayi) }))
                }
            });
        });
    });
});

app.get('/api/admin/kullanicilar', girisKontrol, adminKontrol, (req, res) => {
    db.query('SELECT id, ad, soyad, kullanici_adi, rol FROM kullanicilar ORDER BY ad', (err, results) => {
        if (err) return res.json({ basarili: false });
        res.json({ basarili: true, kullanicilar: results });
    });
});

app.get('/api/admin/gorevler', girisKontrol, adminKontrol, (req, res) => {
    db.query(`SELECT g.*, k.ad, k.soyad, k.kullanici_adi FROM gorevler g JOIN kullanicilar k ON g.kullanici_id = k.id ORDER BY g.olusturma_tarihi DESC`, (err, results) => {
        if (err) return res.json({ basarili: false });
        res.json({ basarili: true, gorevler: results });
    });
});

app.get('/api/admin/yardim-talepleri', girisKontrol, adminKontrol, (req, res) => {
    const kullanici = typeof req.query.kullanici === 'string' ? req.query.kullanici.trim() : '';
    const durum = typeof req.query.durum === 'string' ? req.query.durum.trim() : '';
    const baslangic = typeof req.query.baslangic === 'string' ? req.query.baslangic.trim() : '';
    const bitis = typeof req.query.bitis === 'string' ? req.query.bitis.trim() : '';
    const durumlar = ['yeni', 'inceleniyor', 'cozuldu'];
    const where = [];
    const params = [];
    if (kullanici) {
        where.push('(k.ad LIKE ? OR k.soyad LIKE ? OR k.kullanici_adi LIKE ?)');
        const m = `%${kullanici}%`;
        params.push(m, m, m);
    }
    if (durum && durumlar.includes(durum)) {
        where.push('y.durum = ?');
        params.push(durum);
    }
    if (baslangic && /^\d{4}-\d{2}-\d{2}$/.test(baslangic)) {
        where.push('DATE(y.olusturma_tarihi) >= ?');
        params.push(baslangic);
    }
    if (bitis && /^\d{4}-\d{2}-\d{2}$/.test(bitis)) {
        where.push('DATE(y.olusturma_tarihi) <= ?');
        params.push(bitis);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    db.query(
        `SELECT y.id, y.tur, y.durum, y.konu, y.mesaj, y.olusturma_tarihi, k.ad, k.soyad, k.kullanici_adi
         FROM yardim_talepleri y
         JOIN kullanicilar k ON y.kullanici_id = k.id
         ${whereSql}
         ORDER BY y.olusturma_tarihi DESC
         LIMIT 200`,
        params,
        (err, results) => {
            if (err) return res.json({ basarili: false });
            res.json({ basarili: true, talepler: results || [] });
        }
    );
});

app.put('/api/admin/yardim-talepleri/:id/durum', girisKontrol, adminKontrol, (req, res) => {
    const id = Number(req.params.id);
    const durum = req.body && typeof req.body.durum === 'string' ? req.body.durum.trim() : '';
    const durumlar = ['yeni', 'inceleniyor', 'cozuldu'];
    if (!Number.isInteger(id) || id <= 0) {
        return res.json({ basarili: false, mesaj: 'Geçersiz talep id.' });
    }
    if (!durumlar.includes(durum)) {
        return res.json({ basarili: false, mesaj: 'Geçersiz durum.' });
    }
    db.query(
        'UPDATE yardim_talepleri SET durum = ? WHERE id = ?',
        [durum, id],
        (err, results) => {
            if (err) return res.json({ basarili: false });
            if (!results || !results.affectedRows) {
                return res.json({ basarili: false, mesaj: 'Talep bulunamadı.' });
            }
            res.json({ basarili: true, mesaj: 'Talep durumu güncellendi.' });
        }
    );
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const PORT = Number(process.env.PORT || 3000);
function startServer() {
    const dene = (port, deneme) => {
        const server = app.listen(port, () => console.log(`http://localhost:${port}`));
        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE' && deneme < 5) {
                const yeniPort = port + 1;
                console.warn(`Port ${port} kullanımda, ${yeniPort} deneniyor...`);
                return dene(yeniPort, deneme + 1);
            }
            throw err;
        });
    };
    dene(PORT, 0);
}
