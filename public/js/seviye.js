/* Seviye temalari, oduller ve profil cerceveleri */
var SEVIYE_SIRASI = [
    'baslangic',
    'cirak',
    'ogrenci',
    'caliskan',
    'azimli',
    'kararli',
    'uzman',
    'kahraman',
    'efsane',
    'sampiyon'
];

var SEVIYE_BILGI = {
    baslangic: { etiket: 'Başlangıç', ikon: '🌱', esik: 0 },
    cirak: { etiket: 'Çırak', ikon: '🔰', esik: 40 },
    ogrenci: { etiket: 'Öğrenci', ikon: '📖', esik: 90 },
    caliskan: { etiket: 'Çalışkan', ikon: '📘', esik: 160 },
    azimli: { etiket: 'Azimli', ikon: '🔥', esik: 250 },
    kararli: { etiket: 'Kararlı', ikon: '💪', esik: 370 },
    uzman: { etiket: 'Uzman', ikon: '🎯', esik: 520 },
    kahraman: { etiket: 'Kahraman', ikon: '🦸', esik: 700 },
    efsane: { etiket: 'Efsane', ikon: '⭐', esik: 950 },
    sampiyon: { etiket: 'Şampiyon', ikon: '👑', esik: 1250 }
};

var SECILI_TEMA_KEY = 'seciliSeviyeTema';

var ODUL_TANIMLARI = [
    { id: 'tema_baslangic', seviye: 'baslangic', ad: 'Mor gece', aciklama: 'Klasik mor-lila panel teması', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_baslangic', seviye: 'baslangic', ad: 'Başlangıç halkası', aciklama: 'İnce mor profil çerçevesi', tip: 'cerceve', ikon: '⭕' },
    { id: 'tema_cirak', seviye: 'cirak', ad: 'Gökyüzü mavisi', aciklama: 'Açık mavi-cyan arka plan', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_cirak', seviye: 'cirak', ad: 'Buzlu çerçeve', aciklama: 'Cam efektli mavi halka', tip: 'cerceve', ikon: '❄️' },
    { id: 'tema_ogrenci', seviye: 'ogrenci', ad: 'İndigo ders', aciklama: 'Sakin indigo-mor tonlar', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_ogrenci', seviye: 'ogrenci', ad: 'Kitap çerçevesi', aciklama: 'Kesik çizgili indigo halka', tip: 'cerceve', ikon: '📚' },
    { id: 'tema_caliskan', seviye: 'caliskan', ad: 'Orman yeşili', aciklama: 'Taze yeşil gradient tema', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_caliskan', seviye: 'caliskan', ad: 'Gümüş çift halka', aciklama: 'Çalışkan seviye gümüş çerçeve', tip: 'cerceve', ikon: '💠' },
    { id: 'tema_azimli', seviye: 'azimli', ad: 'Gün batımı', aciklama: 'Turuncu-altın sıcak tema', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_azimli', seviye: 'azimli', ad: 'Altın parıltı', aciklama: 'Parlayan altın profil halkası', tip: 'cerceve', ikon: '✨' },
    { id: 'arkaplan_azimli', seviye: 'azimli', ad: 'Sıcak parıltı', aciklama: 'Arka planda hafif ışık efekti', tip: 'arkaplan', ikon: '🌅' },
    { id: 'tema_kararli', seviye: 'kararli', ad: 'Mercan ateşi', aciklama: 'Kırmızı-pembe enerjik tema', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_kararli', seviye: 'kararli', ad: 'Alev halkası', aciklama: 'Kırmızı nabızlı çerçeve animasyonu', tip: 'cerceve', ikon: '🔴' },
    { id: 'tema_uzman', seviye: 'uzman', ad: 'Kraliyet moru', aciklama: 'Mor-pembe uzman paleti', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_uzman', seviye: 'uzman', ad: 'Kristal çerçeve', aciklama: 'Çok katmanlı mor kristal halka', tip: 'cerceve', ikon: '💎' },
    { id: 'arkaplan_uzman', seviye: 'uzman', ad: 'Yıldız tozu', aciklama: 'Panelde hafif yıldız deseni', tip: 'arkaplan', ikon: '✦' },
    { id: 'tema_kahraman', seviye: 'kahraman', ad: 'Okyanus dalgası', aciklama: 'Mavi-turkuaz kahraman teması', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_kahraman', seviye: 'kahraman', ad: 'Kalkan çerçevesi', aciklama: 'Kalın mavi koruma halkası', tip: 'cerceve', ikon: '🛡️' },
    { id: 'tema_efsane', seviye: 'efsane', ad: 'Neon gecesi', aciklama: 'Pembe-turuncu neon gradient', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_efsane', seviye: 'efsane', ad: 'Neon halka', aciklama: 'Parlayan neon profil çerçevesi', tip: 'cerceve', ikon: '💫' },
    { id: 'arkaplan_efsane', seviye: 'efsane', ad: 'Aurora', aciklama: 'Kuzey ışıkları arka plan efekti', tip: 'arkaplan', ikon: '🌌' },
    { id: 'tema_sampiyon', seviye: 'sampiyon', ad: 'Gökkuşağı premium', aciklama: 'Canlı çok renkli şampiyon teması', tip: 'tema', ikon: '🎨' },
    { id: 'cerceve_sampiyon', seviye: 'sampiyon', ad: 'Şampiyon tacı', aciklama: 'Animasyonlu gökkuşağı çerçeve', tip: 'cerceve', ikon: '👑' },
    { id: 'arkaplan_sampiyon', seviye: 'sampiyon', ad: 'Zafer ışığı', aciklama: 'Altın parıltılı premium arka plan', tip: 'arkaplan', ikon: '🏆' }
];

function seviyeIndeks(kod) {
    var i = SEVIYE_SIRASI.indexOf(kod);
    return i < 0 ? 0 : i;
}

function seviyeIlerlemeHesapla(puan) {
    var p = Number(puan) || 0;
    var ust = SEVIYE_BILGI.sampiyon.esik;
    if (p >= ust) return { yuzde: 100, onceki: ust, sonraki: null };
    var onceki = 0;
    var sonraki = SEVIYE_BILGI.cirak.esik;
    for (var i = 0; i < SEVIYE_SIRASI.length; i++) {
        var esik = SEVIYE_BILGI[SEVIYE_SIRASI[i]].esik;
        if (p < esik) {
            sonraki = esik;
            onceki = i > 0 ? SEVIYE_BILGI[SEVIYE_SIRASI[i - 1]].esik : 0;
            break;
        }
    }
    var aralik = sonraki - onceki;
    var yuzde = aralik > 0 ? Math.min(100, Math.round(((p - onceki) / aralik) * 100)) : 100;
    return { yuzde: yuzde, onceki: onceki, sonraki: sonraki };
}

function odulleriHesapla(seviyeKod) {
    var idx = seviyeIndeks(seviyeKod);
    return ODUL_TANIMLARI.map(function (o) {
        return {
            id: o.id,
            ad: o.ad,
            aciklama: o.aciklama,
            tip: o.tip,
            ikon: o.ikon,
            seviye: o.seviye,
            seviyeEtiket: (SEVIYE_BILGI[o.seviye] || {}).etiket || o.seviye,
            acildi: seviyeIndeks(o.seviye) <= idx
        };
    });
}

function seciliTemaAl() {
    try {
        var kayitli = localStorage.getItem(SECILI_TEMA_KEY);
        if (kayitli && SEVIYE_SIRASI.indexOf(kayitli) >= 0) return kayitli;
    } catch (e) {}
    return null;
}

function seciliTemaKaydet(seviyeKod) {
    try {
        localStorage.setItem(SECILI_TEMA_KEY, seviyeKod);
    } catch (e) {}
}

function seviyeTemasiUygula(seviyeKod) {
    var kod = SEVIYE_SIRASI.indexOf(seviyeKod) >= 0 ? seviyeKod : 'baslangic';
    document.documentElement.setAttribute('data-seviye', kod);
    document.documentElement.classList.remove('seviye-arkaplan-aktif');
    if (seviyeIndeks(kod) >= seviyeIndeks('azimli')) {
        document.documentElement.classList.add('seviye-arkaplan-aktif');
    }
}

function gorunurTemaUygula(maksSeviyeKod) {
    var maks = SEVIYE_SIRASI.indexOf(maksSeviyeKod) >= 0 ? maksSeviyeKod : 'baslangic';
    var secili = seciliTemaAl();
    var kullan = secili;
    if (!kullan || seviyeIndeks(kullan) > seviyeIndeks(maks)) {
        kullan = maks;
        if (secili && secili !== maks) {
            seciliTemaKaydet(maks);
        }
    }
    seviyeTemasiUygula(kullan);
    return kullan;
}

function temalariListele(seviyeKod) {
    return ODUL_TANIMLARI.filter(function (o) {
        return o.tip === 'tema';
    }).map(function (o) {
        return {
            id: o.id,
            seviye: o.seviye,
            ad: o.ad,
            aciklama: o.aciklama,
            ikon: o.ikon,
            seviyeEtiket: (SEVIYE_BILGI[o.seviye] || {}).etiket || o.seviye,
            esik: (SEVIYE_BILGI[o.seviye] || {}).esik || 0,
            acildi: seviyeIndeks(o.seviye) <= seviyeIndeks(seviyeKod)
        };
    });
}

function profilBasHarf(kullanici) {
    if (!kullanici) return '?';
    var ad = (kullanici.ad || '').trim();
    var soyad = (kullanici.soyad || '').trim();
    if (ad && soyad) return (ad.charAt(0) + soyad.charAt(0)).toUpperCase();
    if (ad) return ad.charAt(0).toUpperCase();
    var ka = (kullanici.kullanici_adi || '').trim();
    return ka ? ka.charAt(0).toUpperCase() : '?';
}

seviyeTemasiUygula('baslangic');

function seviyeKonfetiRenkleri(kod) {
    var m = {
        baslangic: ['#667eea', '#764ba2', '#a78bfa'],
        cirak: ['#4facfe', '#00f2fe', '#43e97b'],
        ogrenci: ['#5c6bc0', '#7986cb', '#9fa8da'],
        caliskan: ['#11998e', '#38ef7d', '#56ab2f'],
        azimli: ['#f7971e', '#ffd200', '#ff6b6b'],
        kararli: ['#ff512f', '#dd2476', '#f093fb'],
        uzman: ['#834d9b', '#d04ed6', '#667eea'],
        kahraman: ['#2193b0', '#6dd5ed', '#38ef7d'],
        efsane: ['#ee0979', '#ff6a00', '#ffd200'],
        sampiyon: ['#667eea', '#f7971e', '#38ef7d', '#ff6b6b', '#f093fb', '#ffd200']
    };
    return m[kod] || m.baslangic;
}
