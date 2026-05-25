/* panel: gorev listesi + muzik - /panel sayfasi */

var MUZIK = {
    spotifyEmbed: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ',
    youtubeEmbed: 'https://www.youtube.com/embed/jfKfPfyJRdk'
};

var tumGorevler = [];
var aktifFiltre = 'hepsi';
var _panelKullanici = null;
var _vsOzet = { gelen: [], gidenBekleyen: [] };
var _vsPollTimer = null;
var _vsSonBaslatIstekId = null;
var _aktifVsHedefId = null;
var _aktifVsIstekId = null;
var _vsBaslangic = null;

var HATIRLATICI_LS = 'gtHatirlaticiAktif';
var _hatirlaticiTimer = null;

function hatirlaticiYardimMetni(kalanMs) {
    var saat = Math.floor(kalanMs / 3600000);
    var dakika = Math.floor((kalanMs % 3600000) / 60000);
    if (saat > 0) {
        return saat + ' saat ' + dakika + ' dakika';
    }
    return dakika + ' dakika';
}

function hatirlaticiLocalKey(gorevId, tip) {
    return 'gtHatir|v1|' + String(gorevId) + '|' + tip;
}

function hatirlaticiOkundu(gorevId, tip, sonIso) {
    try {
        return localStorage.getItem(hatirlaticiLocalKey(gorevId, tip)) === sonIso;
    } catch (e) {
        return false;
    }
}

function hatirlaticiKaydet(gorevId, tip, sonIso) {
    try {
        localStorage.setItem(hatirlaticiLocalKey(gorevId, tip), sonIso);
    } catch (e) {}
}

function hatirlaticiBildirim(baslik, govde, etiket) {
    function yedekDogrudan() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        try {
            new Notification(baslik, { body: govde, tag: etiket, renotify: true });
        } catch (e) {}
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(function (reg) {
                return reg.showNotification(baslik, {
                    body: govde,
                    tag: etiket,
                    renotify: true,
                    icon: '/favicon.ico'
                });
            })
            .catch(yedekDogrudan);
    } else {
        yedekDogrudan();
    }
}

function hatirlaticiSwKaydet() {
    if (!('serviceWorker' in navigator)) {
        return Promise.resolve();
    }
    return navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(function () {
            return navigator.serviceWorker.ready;
        })
        .catch(function () {});
}

function hatirlaticiZamanlayiciyiDurdur() {
    if (_hatirlaticiTimer) {
        clearInterval(_hatirlaticiTimer);
        _hatirlaticiTimer = null;
    }
}

function hatirlaticiZamanlayiciyiBaslat() {
    hatirlaticiZamanlayiciyiDurdur();
    _hatirlaticiTimer = setInterval(hatirlaticiGorevleriTara, 60000);
}

function hatirlaticiGorevleriTara() {
    if (localStorage.getItem(HATIRLATICI_LS) !== '1') {
        return;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    var norm = window.gorevZamanNormalizeSon;
    var sonMsFn = window.gorevZamanYerelGunSonuMs;
    if (typeof norm !== 'function' || typeof sonMsFn !== 'function') {
        return;
    }
    tumGorevler.forEach(function (g) {
        if (!g || g.durum === 'tamamlandi' || !g.son_tarih) {
            return;
        }
        var sonIso = norm(g.son_tarih);
        if (!sonIso) {
            return;
        }
        var bitis =
            typeof window.gorevZamanSonMs === 'function'
                ? window.gorevZamanSonMs(g.son_tarih)
                : sonMsFn(sonIso);
        if (bitis == null) {
            return;
        }
        var kalan = bitis - Date.now();
        var id = g.id;
        var baslik = g.gorev_adi || 'Görev';

        if (kalan <= 0) {
            if (!hatirlaticiOkundu(id, 'overdue', sonIso)) {
                hatirlaticiBildirim(
                    'Süre doldu: ' + baslik,
                    'Son güne göre teslim süresi bitti. Durumu güncellemeyi unutma.',
                    'gt-overdue-' + id + '-' + sonIso
                );
                hatirlaticiKaydet(id, 'overdue', sonIso);
            }
            return;
        }

        var h24 = 24 * 3600000;
        var h1 = 3600000;
        if (kalan <= h1) {
            if (!hatirlaticiOkundu(id, '1h', sonIso)) {
                hatirlaticiBildirim(
                    '1 saat kaldı: ' + baslik,
                    'Yaklaşık ' + hatirlaticiYardimMetni(kalan) + ' içinde son gün bitiyor.',
                    'gt-1h-' + id + '-' + sonIso
                );
                hatirlaticiKaydet(id, '1h', sonIso);
            }
        } else if (kalan <= h24) {
            if (!hatirlaticiOkundu(id, '24h', sonIso)) {
                hatirlaticiBildirim(
                    '24 saat kaldı: ' + baslik,
                    '“' + baslik + '” için son güne son 24 saat.',
                    'gt-24h-' + id + '-' + sonIso
                );
                hatirlaticiKaydet(id, '24h', sonIso);
            }
        }
    });
}

function hatirlaticiButonGuncelle() {
    var btn = document.getElementById('btn-hatirlatici');
    if (!btn) {
        return;
    }
    if (!('Notification' in window)) {
        btn.disabled = true;
        btn.textContent = 'Bildirim yok';
        btn.title = 'Bu tarayıcı masaüstü bildirimini desteklemiyor.';
        return;
    }
    btn.disabled = false;
    if (Notification.permission === 'denied') {
        btn.textContent = 'Bildirim engelli';
        btn.title = 'Site için bildirim engellenmiş; tarayıcı ayarlarından açabilirsiniz.';
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('btn-hatirlatici-aktif');
        return;
    }
    var aktif = localStorage.getItem(HATIRLATICI_LS) === '1' && Notification.permission === 'granted';
    btn.textContent = aktif ? 'Bildirim açık' : 'Hatırlatıcı bildirim';
    btn.title = aktif
        ? 'Tıklayınca hatırlatıcılar kapanır (tarayıcı izni aynı kalır).'
        : 'Son 24 saat, son 1 saat ve süre dolunca bir kez hatırlatır. Tarayıcı açık veya sekme arka planda olmalıdır.';
    btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    if (aktif) {
        btn.classList.add('btn-hatirlatici-aktif');
    } else {
        btn.classList.remove('btn-hatirlatici-aktif');
    }
}

function hatirlaticiKur() {
    var btn = document.getElementById('btn-hatirlatici');
    if (!btn) {
        return;
    }
    hatirlaticiButonGuncelle();
    btn.addEventListener('click', function () {
        if (!('Notification' in window)) {
            return;
        }
        if (Notification.permission === 'denied') {
            window.alert(
                'Bildirimler bu site için engellenmiş. Adres çubuğundaki kilit veya site bilgisi simgesinden bildirimlere izin verebilirsiniz.'
            );
            return;
        }
        var simdiAktif = localStorage.getItem(HATIRLATICI_LS) === '1' && Notification.permission === 'granted';
        if (simdiAktif) {
            localStorage.removeItem(HATIRLATICI_LS);
            hatirlaticiZamanlayiciyiDurdur();
            hatirlaticiButonGuncelle();
            return;
        }
        function acVeBaslat() {
            localStorage.setItem(HATIRLATICI_LS, '1');
            hatirlaticiSwKaydet().then(function () {
                hatirlaticiZamanlayiciyiBaslat();
                hatirlaticiGorevleriTara();
            });
            hatirlaticiButonGuncelle();
        }
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(function (p) {
                hatirlaticiButonGuncelle();
                if (p !== 'granted') {
                    return;
                }
                acVeBaslat();
            });
            return;
        }
        if (Notification.permission === 'granted') {
            acVeBaslat();
        }
    });

    if (localStorage.getItem(HATIRLATICI_LS) === '1' && Notification.permission === 'granted') {
        hatirlaticiSwKaydet().then(function () {
            hatirlaticiZamanlayiciyiBaslat();
            hatirlaticiGorevleriTara();
        });
    }
}

function esc(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function escAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

document.addEventListener('DOMContentLoaded', function () {
    kullaniciBilgisiGetir();
    gorevleriGetir();
    odulBilgisiniYukle();
    liderlikYukle();
    filtreButonlariAyarla();
    muzikKur();
    yardimModalKur();
    yanPanelKur();
    vsIstekKur();
    kutlamaKapatKur();
    hatirlaticiKur();
});

function yanPanelKur() {
    var panel = document.getElementById('yan-panel');
    var backdrop = document.getElementById('yan-panel-backdrop');
    var kapat = document.getElementById('yan-panel-kapat');
    var baslik = document.getElementById('yan-panel-baslik');
    var temalarGovde = document.getElementById('yan-panel-temalar');
    var duelloGovde = document.getElementById('yan-panel-duello');
    var aktifPanel = null;

    function panelAc(tip) {
        if (!panel || !temalarGovde || !duelloGovde) return;
        aktifPanel = tip;
        panel.removeAttribute('hidden');
        panel.classList.add('yan-panel-acik');
        panel.setAttribute('aria-hidden', 'false');
        if (backdrop) {
            backdrop.removeAttribute('hidden');
            backdrop.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('yan-panel-acik');
        temalarGovde.hidden = tip !== 'temalar';
        duelloGovde.hidden = tip !== 'duello';
        if (baslik) {
            baslik.textContent = tip === 'duello' ? 'Düello' : 'Temalar';
        }
        document.querySelectorAll('.yan-menu-btn').forEach(function (btn) {
            var acik = btn.getAttribute('data-yan-panel') === tip;
            btn.classList.toggle('aktif', acik);
            btn.setAttribute('aria-expanded', acik ? 'true' : 'false');
        });
        if (tip === 'duello') {
            liderlikYukle();
            vsOzetYukle(false);
        }
    }

    function panelKapat() {
        if (!panel) return;
        aktifPanel = null;
        panel.setAttribute('hidden', '');
        panel.classList.remove('yan-panel-acik');
        panel.setAttribute('aria-hidden', 'true');
        if (backdrop) {
            backdrop.setAttribute('hidden', '');
            backdrop.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('yan-panel-acik');
        document.querySelectorAll('.yan-menu-btn').forEach(function (btn) {
            btn.classList.remove('aktif');
            btn.setAttribute('aria-expanded', 'false');
        });
    }

    document.querySelectorAll('.yan-menu-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tip = btn.getAttribute('data-yan-panel');
            if (aktifPanel === tip) {
                panelKapat();
                return;
            }
            panelAc(tip);
        });
    });

    if (kapat) kapat.addEventListener('click', panelKapat);
    if (backdrop) backdrop.addEventListener('click', panelKapat);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && aktifPanel) {
            panelKapat();
        }
    });
}

function muzikKur() {
    var spot = document.getElementById('music-spotify');
    var yt = document.getElementById('music-youtube');

    function iframeAt(kutu, tip) {
        if (!kutu || kutu.querySelector('iframe')) return;
        var src = tip === 'spotify' ? MUZIK.spotifyEmbed : MUZIK.youtubeEmbed;
        var fr = document.createElement('iframe');
        fr.src = src;
        fr.className = 'music-iframe';
        fr.setAttribute('loading', 'lazy');
        fr.setAttribute('allowfullscreen', '');
        if (tip === 'spotify') {
            fr.title = 'Spotify';
            fr.height = '152';
            fr.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        } else {
            fr.title = 'YouTube';
            fr.height = '200';
            fr.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        }
        kutu.appendChild(fr);
    }

    document.querySelectorAll('.music-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.music-tab').forEach(function (t) {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            if (tab.dataset.music === 'spotify') {
                spot.hidden = false;
                yt.hidden = true;
                spot.classList.remove('music-frame-hidden');
                yt.classList.add('music-frame-hidden');
                iframeAt(spot, 'spotify');
            } else {
                yt.hidden = false;
                spot.hidden = true;
                yt.classList.remove('music-frame-hidden');
                spot.classList.add('music-frame-hidden');
                iframeAt(yt, 'youtube');
            }
        });
    });
    iframeAt(spot, 'spotify');
}

function kullaniciBilgisiGetir() {
    fetch('/api/kullanici', { credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok || !r.headers.get('content-type') || r.headers.get('content-type').indexOf('application/json') === -1) {
                window.location.href = '/giris.html';
                return null;
            }
            return r.json();
        })
        .then(function (k) {
            if (!k) return;
            _panelKullanici = k;
            profilKullaniciGuncelle(k);
            if (k.admin) document.getElementById('admin-link').style.display = 'inline-block';
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
}

function gorevleriGetir() {
    fetch('/api/gorevler', { credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok || !r.headers.get('content-type') || r.headers.get('content-type').indexOf('application/json') === -1) {
                window.location.href = '/giris.html';
                return null;
            }
            return r.json();
        })
        .then(function (data) {
            if (!data) return;
            if (data.basarili) {
                tumGorevler = data.gorevler;
                gorevleriGoster();
                istatistikleriGuncelle();
                hatirlaticiGorevleriTara();
            }
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
}

function gorevleriGoster() {
    var liste = document.getElementById('gorev-listesi');
    var filtreli = aktifFiltre === 'hepsi' ? tumGorevler : tumGorevler.filter(function (g) {
        return g.durum === aktifFiltre;
    });
    if (filtreli.length === 0) {
        liste.innerHTML = '<p class="bos-mesaj">Bu kategoride görev yok.</p>';
        if (typeof window.gorevZamanlayiciBaslat === 'function') {
            window.gorevZamanlayiciBaslat();
        }
        return;
    }
    liste.innerHTML = filtreli.map(function (gorev) {
        var d = gorev.durum || '';
        var kalanHtml =
            gorev.son_tarih && d !== 'tamamlandi'
                ? '<div class="gorev-zaman-blok" data-son-tarih="' +
                  escAttr(String(gorev.son_tarih)) +
                  '" data-durum="' +
                  escAttr(d) +
                  '">' +
                  '<span class="gorev-son-hedef"></span>' +
                  '<strong class="gorev-kalan-sure" aria-live="polite"></strong>' +
                  '</div>'
                : '';
        return (
            '<div class="gorev-karti ' + esc(d) + '">' +
            '<div class="gorev-icerik"><h3>' + esc(gorev.gorev_adi) + '</h3>' +
            (gorev.aciklama ? '<p>' + esc(gorev.aciklama) + '</p>' : '') +
            '<div class="gorev-meta">' +
            kalanHtml +
            '<span class="durum-badge ' + esc(d) + '">' + durumYazi(d) + '</span></div></div>' +
            '<div class="gorev-aksiyonlar">' +
            '<select onchange="durumDegistir(' + Number(gorev.id) + ', this.value)" class="durum-select">' +
            '<option value="bekliyor"' + (d === 'bekliyor' ? ' selected' : '') + '>Bekliyor</option>' +
            '<option value="devam_ediyor"' + (d === 'devam_ediyor' ? ' selected' : '') + '>Devam</option>' +
            '<option value="tamamlandi"' + (d === 'tamamlandi' ? ' selected' : '') + '>Tamamlandı</option>' +
            '</select><button type="button" onclick="gorevSil(' + Number(gorev.id) + ')" class="btn btn-sil">Sil</button></div></div>'
        );
    }).join('');
    if (typeof window.gorevZamanlayiciBaslat === 'function') {
        window.gorevZamanlayiciBaslat();
    }
}

function istatistikleriGuncelle() {
    document.getElementById('toplam-gorev').textContent = tumGorevler.length;
    document.getElementById('bekleyen-gorev').textContent = tumGorevler.filter(function (g) {
        return g.durum === 'bekliyor';
    }).length;
    document.getElementById('devam-gorev').textContent = tumGorevler.filter(function (g) {
        return g.durum === 'devam_ediyor';
    }).length;
    document.getElementById('tamamlanan-gorev').textContent = tumGorevler.filter(function (g) {
        return g.durum === 'tamamlandi';
    }).length;
}

var formGorev = document.getElementById('gorevForm');
if (formGorev) formGorev.addEventListener('submit', function (e) {
    e.preventDefault();
    var ad = document.getElementById('gorev-adi').value.trim();
    if (!ad) {
        alert('Görev adı yazın.');
        return;
    }
    fetch('/api/gorev-ekle', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gorev_adi: ad,
            aciklama: document.getElementById('aciklama').value,
            son_tarih: document.getElementById('son-tarih').value
        })
    })
        .then(function (r) {
            if (!r.ok || !r.headers.get('content-type') || r.headers.get('content-type').indexOf('application/json') === -1) {
                window.location.href = '/giris.html';
                return null;
            }
            return r.json();
        })
        .then(function (data) {
            if (!data) return;
            if (data.basarili) {
                document.getElementById('gorevForm').reset();
                gorevleriGetir();
            } else alert(data.mesaj || 'Hata');
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
});

function gorevSil(id) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    fetch('/api/gorev-sil/' + id, { method: 'DELETE', credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok || !r.headers.get('content-type') || r.headers.get('content-type').indexOf('application/json') === -1) {
                window.location.href = '/giris.html';
                return null;
            }
            return r.json();
        })
        .then(function (data) {
            if (data && data.basarili) gorevleriGetir();
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
}

function durumDegistir(id, durum) {
    fetch('/api/gorev-guncelle/' + id, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum: durum })
    })
        .then(function (r) {
            if (!r.ok || !r.headers.get('content-type') || r.headers.get('content-type').indexOf('application/json') === -1) {
                window.location.href = '/giris.html';
                return null;
            }
            return r.json();
        })
        .then(function (data) {
            if (!data || !data.basarili) return;
            gorevleriGetir();
            if (durum === 'tamamlandi' && data.tamamlamaOdulu && data.tamamlamaOdulu.kazandi && !data.tamamlamaOdulu.puanHatasi) {
                odulSatiriniGuncelle(data.tamamlamaOdulu);
                kutlamaGoster(data.tamamlamaOdulu);
            } else if (durum === 'tamamlandi' && data.tamamlamaOdulu && data.tamamlamaOdulu.kazandi && data.tamamlamaOdulu.puanHatasi) {
                kutlamaGoster({ kazandi: true, puan: null, kazanilanPuan: 15, seviyeEtiket: '', puanHatasi: true });
                odulBilgisiniYukle();
            } else {
                odulBilgisiniYukle();
            }
            liderlikYukle();
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
}

function seviyeIkon(kod) {
    var b = typeof SEVIYE_BILGI !== 'undefined' && SEVIYE_BILGI[kod];
    return b && b.ikon ? b.ikon : '⭐';
}

function liderlikYukle() {
    var tablo = document.getElementById('liderlik-tablo');
    if (!tablo) return;
    fetch('/api/liderlik', { credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok) return null;
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) return;
            liderlikCiz(d);
            vsOzetYukle(false);
        })
        .catch(function () {});
}

function liderlikCiz(d) {
    var ozet = document.getElementById('liderlik-ozet');
    var benSira = document.getElementById('liderlik-ben-sira');
    var podyum = document.getElementById('liderlik-podyum');
    var tablo = document.getElementById('liderlik-tablo');
    var rakipWrap = document.getElementById('liderlik-rakip-wrap');
    var rakipler = document.getElementById('liderlik-rakipler');
    if (!tablo) return;

    if (benSira) {
        benSira.textContent = d.benimSira != null ? '#' + d.benimSira : '—';
    }
    if (ozet) {
        var metin = d.toplamKullanici + ' öğrenci ligde';
        if (d.birUst) {
            metin += ' · Bir üst sıra: ' + esc(d.birUst.gorunenAd) + ' (' + d.birUst.puan + ' puan)';
        } else if (d.benimSira === 1) {
            metin += ' · Tebrikler, lider sensin!';
        }
        ozet.textContent = metin;
    }

    if (podyum) {
        var podyumKolon = [
            { idx: 1, madalya: '🥈', sinif: 'sira-2' },
            { idx: 0, madalya: '🥇', sinif: 'sira-1' },
            { idx: 2, madalya: '🥉', sinif: 'sira-3' }
        ];
        podyum.innerHTML = podyumKolon
            .map(function (kol) {
                var u = d.podyum[kol.idx];
                if (!u) {
                    return '<div class="podyum-yer bos"></div>';
                }
                return (
                    '<div class="podyum-yer ' +
                    kol.sinif +
                    (u.benMi ? ' benim' : '') +
                    '">' +
                    '<span class="podyum-madalya">' +
                    kol.madalya +
                    '</span>' +
                    '<span class="podyum-avatar cerceve-' +
                    esc(u.seviye) +
                    '">' +
                    esc((u.ad || '?').charAt(0)) +
                    '</span>' +
                    '<strong class="podyum-ad">' +
                    esc(u.gorunenAd) +
                    '</strong>' +
                    '<span class="podyum-seviye">' +
                    seviyeIkon(u.seviye) +
                    ' ' +
                    esc(u.seviyeEtiket) +
                    '</span>' +
                    '<span class="podyum-puan">' +
                    u.puan +
                    ' puan</span>' +
                    '</div>'
                );
            })
            .join('');
    }

    if (rakipWrap && rakipler && d.yakinRakipler && d.yakinRakipler.length) {
        rakipWrap.hidden = false;
        rakipler.innerHTML = d.yakinRakipler
            .map(function (u) {
                return liderlikKartHtml(u, true);
            })
            .join('');
    } else if (rakipWrap) {
        rakipWrap.hidden = true;
    }

    if (!d.liste || !d.liste.length) {
        tablo.innerHTML = '<p class="bos-mesaj">Henüz ligde kimse yok.</p>';
        return;
    }

    tablo.innerHTML = d.liste
        .map(function (u) {
            return liderlikSatirHtml(u);
        })
        .join('');
}

function vsIstekButonHtml(u, kucuk) {
    if (u.benMi) return '';
    var sinif = 'btn btn-yaris' + (kucuk ? ' btn-yaris-kucuk' : '');
    if (_vsOzet.gidenBekleyen.indexOf(Number(u.id)) >= 0) {
        return '<button type="button" class="' + sinif + ' btn-vs-bekliyor" disabled>İstek gönderildi</button>';
    }
    return (
        '<button type="button" class="' + sinif + '" data-vs-istek="' + u.id + '">VS isteği gönder</button>'
    );
}

function liderlikKartHtml(u, kisa) {
    var sinif = 'liderlik-kart' + (u.benMi ? ' benim' : '');
    var yarisBtn = u.benMi || kisa ? '' : vsIstekButonHtml(u);
    return (
        '<article class="' +
        sinif +
        '" role="listitem">' +
        '<span class="liderlik-sira">#' +
        u.sira +
        '</span>' +
        '<span class="liderlik-mini-avatar cerceve-' +
        esc(u.seviye) +
        '">' +
        esc((u.ad || u.kullanici_adi || '?').charAt(0)) +
        '</span>' +
        '<div class="liderlik-kart-bilgi">' +
        '<strong>' +
        esc(u.gorunenAd) +
        (u.benMi ? ' <em>(sen)</em>' : '') +
        '</strong>' +
        '<span class="liderlik-kart-alt">@' +
        esc(u.kullanici_adi) +
        ' · ' +
        seviyeIkon(u.seviye) +
        ' ' +
        esc(u.seviyeEtiket) +
        '</span>' +
        '</div>' +
        '<div class="liderlik-kart-sag">' +
        '<strong>' +
        u.puan +
        ' p</strong>' +
        '<span>' +
        u.tamamlanan +
        ' görev</span>' +
        yarisBtn +
        '</div>' +
        '</article>'
    );
}

function liderlikSatirHtml(u) {
    return (
        '<div class="liderlik-satir' +
        (u.benMi ? ' benim' : '') +
        '" role="listitem">' +
        '<span class="liderlik-sira-num">' +
        u.sira +
        '</span>' +
        '<span class="liderlik-mini-avatar cerceve-' +
        esc(u.seviye) +
        '">' +
        esc((u.ad || u.kullanici_adi || '?').charAt(0)) +
        '</span>' +
        '<div class="liderlik-satir-orta">' +
        '<strong class="liderlik-isim">' +
        esc(u.gorunenAd) +
        (u.benMi ? ' <span class="liderlik-sen-rozet">Sen</span>' : '') +
        '</strong>' +
        '<span class="liderlik-kullanici-alt">@' +
        esc(u.kullanici_adi) +
        '</span>' +
        '</div>' +
        '<div class="liderlik-seviye-kolon">' +
        '<span class="liderlik-seviye-rozet">' +
        seviyeIkon(u.seviye) +
        ' ' +
        esc(u.seviyeEtiket) +
        '</span>' +
        '</div>' +
        '<div class="liderlik-puan-kolon">' +
        '<strong>' +
        u.puan +
        '</strong>' +
        '<span>puan · ' +
        u.tamamlanan +
        ' bitti</span>' +
        '</div>' +
        (u.benMi ? '' : vsIstekButonHtml(u, true)) +
        '</div>'
    );
}

function bildirimGoster(metin, tur) {
    var toast = document.getElementById('bildirim-toast');
    if (!toast) return;
    toast.textContent = metin;
    toast.className = 'bildirim-toast bildirim-toast-goster' + (tur ? ' bildirim-' + tur : '');
    toast.hidden = false;
    clearTimeout(bildirimGoster._timer);
    bildirimGoster._timer = setTimeout(function () {
        toast.hidden = true;
        toast.classList.remove('bildirim-toast-goster');
    }, 3200);
}

function yarisModalAc() {
    var modal = document.getElementById('yaris-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
}

function yarisModalKapat() {
    var modal = document.getElementById('yaris-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
}

function vsSonlandir(mesaj, tur, sessiz) {
    var istekId = _aktifVsIstekId;
    _aktifVsHedefId = null;
    _aktifVsIstekId = null;
    _vsBaslangic = null;
    var serit = document.getElementById('vs-canli-serit');
    if (serit) serit.hidden = true;
    yarisModalKapat();
    if (istekId) {
        fetch('/api/vs/sonlandir', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ istekId: istekId })
        }).catch(function () {});
    }
    if (mesaj && !sessiz) {
        bildirimGoster(mesaj, tur || 'basarili');
    }
}

function vsCanliSeritKapat() {
    vsSonlandir(null, null, true);
}

function vsBaslat(d, istekId) {
    if (!d || !d.ben || !d.hedef) return;
    var benP = Number(d.ben.puan) || 0;
    var hedefP = Number(d.hedef.puan) || 0;
    var yeniRakip = !_aktifVsHedefId || Number(_aktifVsHedefId) !== Number(d.hedef.id);
    if (yeniRakip || !_vsBaslangic) {
        _vsBaslangic = {
            benPuan: benP,
            hedefPuan: hedefP,
            lider: benP > hedefP ? 'ben' : hedefP > benP ? 'hedef' : 'berabere'
        };
    }
    _aktifVsHedefId = d.hedef.id;
    _aktifVsIstekId = istekId || d.vsIstekId || _aktifVsIstekId || null;
}

function vsGecisKontrol(d) {
    if (!_vsBaslangic || !_aktifVsHedefId || !d || !d.ben || !d.hedef) return false;
    if (Number(d.hedef.id) !== Number(_aktifVsHedefId)) return false;
    var benP = Number(d.ben.puan) || 0;
    var hedefP = Number(d.hedef.puan) || 0;
    var simdi = benP > hedefP ? 'ben' : hedefP > benP ? 'hedef' : 'berabere';
    var bas = _vsBaslangic.lider;
    if (bas !== 'ben' && simdi === 'ben') {
        vsSonlandir(
            'Tebrikler! ' + (d.hedef.gorunenAd || 'Rakibi') + ' geçtin — VS bitti!',
            'basarili'
        );
        return true;
    }
    if (bas === 'ben' && simdi === 'hedef') {
        vsSonlandir((d.hedef.gorunenAd || 'Rakip') + ' seni geçti — VS bitti.', 'hata');
        return true;
    }
    if (bas === 'berabere' && simdi === 'ben') {
        vsSonlandir('Öne geçtin — VS kazandın!', 'basarili');
        return true;
    }
    if (bas === 'berabere' && simdi === 'hedef') {
        vsSonlandir((d.hedef.gorunenAd || 'Rakip') + ' öne geçti — VS bitti.', 'hata');
        return true;
    }
    return false;
}

function vsVeriIsle(d, istekId) {
    if (!d || !d.basarili) return false;
    vsBaslat(d, istekId);
    if (vsGecisKontrol(d)) return true;
    return false;
}

function vsCanliSeritKur() {
    var kapat = document.getElementById('vs-canli-kapat');
    var detay = document.getElementById('vs-canli-detay');
    if (kapat) {
        kapat.addEventListener('click', vsCanliSeritKapat);
    }
    if (detay) {
        detay.addEventListener('click', function () {
            if (_aktifVsHedefId) {
                yarisKarsilastirAc(_aktifVsHedefId);
            }
        });
    }
}

function vsIlerlemeYuzde(puan) {
    if (typeof seviyeIlerlemeHesapla === 'function') {
        return seviyeIlerlemeHesapla(puan).yuzde;
    }
    return 0;
}

function vsCizgiVerisiHesapla(ben, hedef) {
    var benPuan = Number(ben.puan) || 0;
    var hedefPuan = Number(hedef.puan) || 0;
    var maxPuan = Math.max(benPuan, hedefPuan, 1);
    var scaleMax = Math.max(maxPuan * 1.12, maxPuan + 25, 50);
    var benKonum = Math.min(96, Math.max(4, Math.round((benPuan / scaleMax) * 100)));
    var hedefKonum = Math.min(96, Math.max(4, Math.round((hedefPuan / scaleMax) * 100)));
    var benGecis = benPuan >= hedefPuan ? 0 : hedefPuan - benPuan + 1;
    var hedefGecis = hedefPuan >= benPuan ? 0 : benPuan - hedefPuan + 1;
    var benPuanOran = Math.round((benPuan / maxPuan) * 100);
    var hedefPuanOran = Math.round((hedefPuan / maxPuan) * 100);
    return {
        benPuan: benPuan,
        hedefPuan: hedefPuan,
        benKonum: benKonum,
        hedefKonum: hedefKonum,
        benGecis: benGecis,
        hedefGecis: hedefGecis,
        benIlerleme: vsIlerlemeYuzde(benPuan),
        hedefIlerleme: vsIlerlemeYuzde(hedefPuan),
        benPuanOran: benPuanOran,
        hedefPuanOran: hedefPuanOran,
        onde: benPuan > hedefPuan ? 'ben' : benPuan < hedefPuan ? 'hedef' : 'berabere'
    };
}

function vsCizgiHtml(ben, hedef, veri, kisa) {
    var benAd = esc(ben.gorunenAd) + ' (sen)';
    var hedefAd = esc(hedef.gorunenAd);
    var sinif = kisa ? ' vs-cizgi-kisa' : '';
    var benGecisMetin =
        veri.benGecis > 0
            ? '<span class="vs-gecis uyari">Geçmek için <strong>' + veri.benGecis + '</strong> puan</span>'
            : '<span class="vs-gecis onde">Öndesin ✓</span>';
    var hedefGecisMetin =
        veri.hedefGecis > 0
            ? '<span class="vs-gecis notr">Rakibin geçmesi için <strong>' + veri.hedefGecis + '</strong> puan</span>'
            : '<span class="vs-gecis geride">Rakip geride</span>';

    return (
        '<div class="vs-cizgi-sahne' +
        sinif +
        '">' +
        '<div class="vs-cizgi-basliklar">' +
        '<div class="vs-cizgi-taraf benim"><strong>' +
        benAd +
        '</strong><span>' +
        veri.benPuan +
        ' puan · %' +
        veri.benIlerleme +
        ' seviye</span></div>' +
        '<div class="vs-cizgi-taraf rakip"><strong>' +
        hedefAd +
        '</strong><span>' +
        veri.hedefPuan +
        ' puan · %' +
        veri.hedefIlerleme +
        ' seviye</span></div>' +
        '</div>' +
        '<div class="vs-hatti" role="img" aria-label="VS ilerleme çizgisi">' +
        '<div class="vs-hatti-cubuk">' +
        '<div class="vs-hatti-iz"></div>' +
        '<span class="vs-hatti-isaret benim' +
        (veri.onde === 'ben' ? ' onde' : '') +
        '" style="left:' +
        veri.benKonum +
        '%"><em>Sen</em><i>' +
        veri.benPuan +
        'p</i></span>' +
        '<span class="vs-hatti-ayrac" aria-hidden="true">VS</span>' +
        '<span class="vs-hatti-isaret rakip' +
        (veri.onde === 'hedef' ? ' onde' : '') +
        '" style="left:' +
        veri.hedefKonum +
        '%"><em>' +
        esc((hedef.gorunenAd || 'R').charAt(0)) +
        '</em><i>' +
        veri.hedefPuan +
        'p</i></span>' +
        '</div>' +
        '</div>' +
        '<div class="vs-cizgi-oranlar">' +
        '<div class="vs-oran-satir benim">' +
        '<span class="vs-oran-etiket">Sen — puan ilerlemen</span>' +
        '<div class="vs-oran-cubuk"><div class="vs-oran-dolgu" style="width:' +
        veri.benPuanOran +
        '%"></div></div>' +
        '<span class="vs-oran-yuzde">%' +
        veri.benPuanOran +
        '</span>' +
        '</div>' +
        '<div class="vs-oran-satir rakip">' +
        '<span class="vs-oran-etiket">' +
        hedefAd +
        ' — puan ilerlemesi</span>' +
        '<div class="vs-oran-cubuk"><div class="vs-oran-dolgu" style="width:' +
        veri.hedefPuanOran +
        '%"></div></div>' +
        '<span class="vs-oran-yuzde">%' +
        veri.hedefPuanOran +
        '</span>' +
        '</div>' +
        '</div>' +
        '<div class="vs-gecis-satir">' +
        benGecisMetin +
        hedefGecisMetin +
        '</div>' +
        '</div>'
    );
}

function vsCanliSeritGuncelle(d) {
    var serit = document.getElementById('vs-canli-serit');
    var icerik = document.getElementById('vs-canli-icerik');
    if (!serit || !icerik || !d || !d.ben || !d.hedef) return;
    if (vsGecisKontrol(d)) return;
    var veri = vsCizgiVerisiHesapla(d.ben, d.hedef);
    icerik.innerHTML = vsCizgiHtml(d.ben, d.hedef, veri, true);
    serit.hidden = false;
}

function yarisKarsilastirAc(hedefId, istekId) {
    var icerik = document.getElementById('yaris-icerik');
    if (!hedefId || !icerik) return;
    _aktifVsHedefId = hedefId;
    if (istekId) _aktifVsIstekId = istekId;
    icerik.innerHTML = '<p class="bos-mesaj">VS yükleniyor…</p>';
    yarisModalAc();
    fetch('/api/liderlik/karsilastir/' + encodeURIComponent(hedefId), { credentials: 'same-origin' })
        .then(function (r) {
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) {
                icerik.innerHTML = '<p class="bos-mesaj">' + esc((d && d.mesaj) || 'Yüklenemedi.') + '</p>';
                return;
            }
            if (vsVeriIsle(d)) return;
            yarisIcerikCiz(d);
            vsCanliSeritGuncelle(d);
        })
        .catch(function () {
            icerik.innerHTML = '<p class="bos-mesaj">Bağlantı hatası.</p>';
        });
}

function vsIstekGonder(hedefId) {
    return fetch('/api/vs/istek', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hedefId: Number(hedefId) })
    })
        .then(function (r) {
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) {
                bildirimGoster((d && d.mesaj) || 'İstek gönderilemedi.', 'hata');
                return d;
            }
            bildirimGoster(d.mesaj || 'İstek gönderildi.', 'basarili');
            vsOzetYukle(true);
            return d;
        })
        .catch(function () {
            bildirimGoster('Bağlantı hatası.', 'hata');
        });
}

function vsGelenListesiCiz() {
    var wrap = document.getElementById('vs-gelen-wrap');
    var liste = document.getElementById('vs-gelen-liste');
    if (!wrap || !liste) return;
    var gelen = _vsOzet.gelen || [];
    if (!gelen.length) {
        wrap.hidden = true;
        liste.innerHTML = '';
        return;
    }
    wrap.hidden = false;
    liste.innerHTML = gelen
        .map(function (i) {
            return (
                '<article class="vs-gelen-kart" role="listitem">' +
                '<span class="liderlik-mini-avatar cerceve-' +
                esc(i.seviye) +
                '">' +
                esc((i.gorunenAd || '?').charAt(0)) +
                '</span>' +
                '<div class="vs-gelen-bilgi">' +
                '<strong>' +
                esc(i.gorunenAd) +
                '</strong>' +
                '<span>@' +
                esc(i.kullanici_adi) +
                ' · ' +
                esc(i.seviyeEtiket) +
                '</span>' +
                '</div>' +
                '<div class="vs-gelen-aksiyon">' +
                '<button type="button" class="btn btn-yaris btn-vs-kabul" data-vs-kabul="' +
                i.id +
                '">Kabul et</button>' +
                '<button type="button" class="btn btn-secondary btn-vs-red" data-vs-red="' +
                i.id +
                '">Reddet</button>' +
                '</div>' +
                '</article>'
            );
        })
        .join('');
}

function vsOzetYukle(yenidenCiz) {
    return fetch('/api/vs/ozet', { credentials: 'same-origin' })
        .then(function (r) {
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) return;
            _vsOzet.gelen = d.gelen || [];
            _vsOzet.gidenBekleyen = d.gidenBekleyen || [];
            vsGelenListesiCiz();
            if (yenidenCiz) {
                liderlikYukle();
            }
            if (d.baslatVs && d.baslatVs.hedefId && _vsSonBaslatIstekId !== d.baslatVs.istekId) {
                _vsSonBaslatIstekId = d.baslatVs.istekId;
                fetch('/api/vs/bildirildi', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ istekId: d.baslatVs.istekId })
                }).catch(function () {});
                bildirimGoster('VS isteğin kabul edildi! Yarış başlıyor.', 'basarili');
                yarisKarsilastirAc(d.baslatVs.hedefId, d.baslatVs.istekId);
            }
        })
        .catch(function () {});
}

function vsIstekKur() {
    var bg = document.getElementById('yaris-modal-kapat-bg');
    var x = document.getElementById('yaris-modal-kapat');

    if (x) x.addEventListener('click', yarisModalKapat);
    if (bg) bg.addEventListener('click', yarisModalKapat);

    document.addEventListener('click', function (e) {
        var istekBtn = e.target.closest('[data-vs-istek]');
        if (istekBtn) {
            var hedefId = istekBtn.getAttribute('data-vs-istek');
            if (!hedefId) return;
            istekBtn.disabled = true;
            vsIstekGonder(hedefId).then(function () {
                istekBtn.disabled = false;
            });
            return;
        }

        var kabulBtn = e.target.closest('[data-vs-kabul]');
        if (kabulBtn) {
            var istekId = kabulBtn.getAttribute('data-vs-kabul');
            if (!istekId) return;
            kabulBtn.disabled = true;
            fetch('/api/vs/istek/' + encodeURIComponent(istekId) + '/kabul', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    if (!d || !d.basarili) {
                        bildirimGoster((d && d.mesaj) || 'Kabul edilemedi.', 'hata');
                        kabulBtn.disabled = false;
                        return;
                    }
                    bildirimGoster('VS başlıyor!', 'basarili');
                    vsOzetYukle(true);
                    if (d.karsiId) {
                        yarisKarsilastirAc(d.karsiId, d.istekId);
                    }
                })
                .catch(function () {
                    bildirimGoster('Bağlantı hatası.', 'hata');
                    kabulBtn.disabled = false;
                });
            return;
        }

        var redBtn = e.target.closest('[data-vs-red]');
        if (redBtn) {
            var redId = redBtn.getAttribute('data-vs-red');
            if (!redId) return;
            fetch('/api/vs/istek/' + encodeURIComponent(redId) + '/red', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    bildirimGoster((d && d.mesaj) || 'Reddedildi.', d && d.basarili ? 'basarili' : 'hata');
                    vsOzetYukle(true);
                });
        }
    });

    vsCanliSeritKur();

    vsOzetYukle(false);
    if (_vsPollTimer) clearInterval(_vsPollTimer);
    _vsPollTimer = setInterval(function () {
        vsOzetYukle(false);
        if (_aktifVsHedefId) {
            fetch('/api/liderlik/karsilastir/' + encodeURIComponent(_aktifVsHedefId), {
                credentials: 'same-origin'
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    if (!d || !d.basarili || !_aktifVsHedefId) return;
                    if (vsVeriIsle(d)) return;
                    vsCanliSeritGuncelle(d);
                    var icerik = document.getElementById('yaris-icerik');
                    var modal = document.getElementById('yaris-modal');
                    if (icerik && modal && !modal.hidden) {
                        yarisIcerikCiz(d);
                    }
                })
                .catch(function () {});
        }
    }, 5000);
}

function yarisIcerikCiz(d) {
    var icerik = document.getElementById('yaris-icerik');
    if (!icerik) return;
    var ben = d.ben;
    var hedef = d.hedef;
    var veri = vsCizgiVerisiHesapla(ben, hedef);
    var sonucSinif = d.sonuc === 'onde' ? 'onde' : d.sonuc === 'geride' ? 'geride' : 'berabere';
    icerik.innerHTML =
        '<p class="yaris-sonuc ' +
        sonucSinif +
        '">' +
        esc(d.mesaj) +
        '</p>' +
        vsCizgiHtml(ben, hedef, veri, false) +
        '<div class="yaris-karsilastir">' +
        yarisKolonHtml(ben, true) +
        '<div class="yaris-vs">VS</div>' +
        yarisKolonHtml(hedef, false) +
        '</div>' +
        '<ul class="yaris-detay">' +
        '<li>Sıra: <strong>#' +
        (d.benimSira || '—') +
        '</strong> sen · <strong>#' +
        (d.hedefSira || '—') +
        '</strong> ' +
        esc(hedef.gorunenAd) +
        '</li>' +
        '<li>Puan farkı: <strong>' +
        (d.puanFark > 0 ? '+' : '') +
        d.puanFark +
        '</strong></li>' +
        '<li>Tamamlanan görev: <strong>' +
        ben.tamamlanan +
        '</strong> sen · <strong>' +
        hedef.tamamlanan +
        '</strong> ' +
        esc(hedef.gorunenAd) +
        ' (fark ' +
        (d.gorevFark > 0 ? '+' : '') +
        d.gorevFark +
        ')</li>' +
        '<li>Seviye ilerlemen: <strong>%' +
        veri.benIlerleme +
        '</strong> sen · <strong>%' +
        veri.hedefIlerleme +
        '</strong> rakip</li>' +
        (veri.benGecis > 0
            ? '<li class="vs-detay-vurgu">Rakibi geçmek için: <strong>' + veri.benGecis + ' puan</strong> daha</li>'
            : '<li class="vs-detay-vurgu onde">Rakibin önündesin — fark: <strong>' +
              (ben.puan - hedef.puan) +
              ' puan</strong></li>') +
        '</ul>';
}

function yarisKolonHtml(u, benMi) {
    return (
        '<div class="yaris-kolon' +
        (benMi ? ' benim' : '') +
        '">' +
        '<span class="liderlik-mini-avatar cerceve-' +
        esc(u.seviye) +
        ' yaris-avatar">' +
        esc((u.ad || '?').charAt(0)) +
        '</span>' +
        '<strong>' +
        esc(u.gorunenAd) +
        (benMi ? ' (sen)' : '') +
        '</strong>' +
        '<span>' +
        seviyeIkon(u.seviye) +
        ' ' +
        esc(u.seviyeEtiket) +
        '</span>' +
        '<span class="yaris-puan">' +
        u.puan +
        ' puan</span>' +
        '<span>' +
        u.tamamlanan +
        ' görev bitti</span>' +
        '</div>'
    );
}

function filtreButonlariAyarla() {
    document.querySelectorAll('.filtre-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filtre-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            aktifFiltre = btn.dataset.filtre;
            gorevleriGoster();
        });
    });
}

function tarihFormat(tarih) {
    if (typeof window.gorevZamanSonMetin === 'function') {
        var metin = window.gorevZamanSonMetin(tarih);
        if (metin) return metin;
    }
    return new Date(tarih).toLocaleDateString('tr-TR');
}

function durumYazi(durum) {
    if (durum === 'bekliyor') return 'Bekliyor';
    if (durum === 'devam_ediyor') return 'Devam ediyor';
    if (durum === 'tamamlandi') return 'Tamamlandı';
    return '—';
}

function odulBilgisiniYukle() {
    fetch('/api/odul', { credentials: 'same-origin' })
        .then(function (r) {
            if (!r.ok) return null;
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) return;
            odulSatiriniGuncelle(d);
            liderlikYukle();
        })
        .catch(function () {});
}

function profilKullaniciGuncelle(k) {
    var adEl = document.getElementById('profil-ad');
    var kaEl = document.getElementById('profil-kullanici');
    var harfEl = document.getElementById('profil-bas-harf');
    if (!adEl) return;
    var ad = (k.ad || '').trim();
    var soyad = (k.soyad || '').trim();
    adEl.textContent = ad ? (soyad ? ad + ' ' + soyad : ad) : 'Hoş geldin';
    if (kaEl) kaEl.textContent = k.kullanici_adi ? '@' + k.kullanici_adi : '';
    if (harfEl) harfEl.textContent = profilBasHarf(k);
}

function odulSatiriniGuncelle(o) {
    var seviyeKod = o.seviye || 'baslangic';
    var bilgi = SEVIYE_BILGI[seviyeKod] || SEVIYE_BILGI.baslangic;
    var aktifTema =
        typeof gorunurTemaUygula === 'function' ? gorunurTemaUygula(seviyeKod) : seviyeKod;

    var avatar = document.getElementById('profil-avatar');
    if (avatar) {
        avatar.className = 'profil-avatar cerceve-' + seviyeKod;
    }

    var puan = typeof o.puan === 'number' ? o.puan : 0;
    var pEl = document.getElementById('odul-puan');
    var sEl = document.getElementById('odul-seviye');
    var iEl = document.getElementById('odul-ilerleme');
    var dolgu = document.getElementById('odul-ilerleme-dolgu');
    var profilPuan = document.getElementById('profil-puan');
    var profilRozet = document.getElementById('profil-seviye-rozet');
    var profilDolgu = document.getElementById('profil-ilerleme-dolgu');
    var profilYuzde = document.getElementById('profil-ilerleme-metin');

    if (pEl) pEl.textContent = String(puan);
    if (sEl) sEl.textContent = o.seviyeEtiket || bilgi.etiket;
    if (profilPuan) profilPuan.textContent = puan + ' puan';
    if (profilRozet) profilRozet.textContent = (bilgi.ikon || '') + ' ' + (o.seviyeEtiket || bilgi.etiket);

    var iler = o.ilerleme;
    if (!iler && typeof puan === 'number' && typeof seviyeIlerlemeHesapla === 'function') {
        iler = seviyeIlerlemeHesapla(puan);
    }
    var yuzde = iler && typeof iler.yuzde === 'number' ? iler.yuzde : 0;
    if (dolgu) dolgu.style.width = yuzde + '%';
    if (profilDolgu) profilDolgu.style.width = yuzde + '%';
    if (profilYuzde) profilYuzde.textContent = yuzde + '%';

    var sn = o.sonraki;
    var ilerlemeMetni = '';
    if (sn && sn.hedef != null) {
        ilerlemeMetni = 'Sonraki seviye için ' + sn.kalan + ' puan kaldı (hedef ' + sn.hedef + ').';
    } else if (sn && sn.hedef == null) {
        ilerlemeMetni = 'Tüm seviyeleri açtın — Şampiyon teması ve tacı senin!';
    } else {
        ilerlemeMetni = 'Her tamamlanan görev +' + (o.tamamlamaPuani || 15) + ' puan.';
    }
    if (iEl) iEl.textContent = ilerlemeMetni;

    var alt = document.getElementById('odul-panel-alt');
    if (alt) {
        var temaBilgi = SEVIYE_BILGI[aktifTema] || bilgi;
        alt.textContent =
            'Aktif tema: ' +
            (temaBilgi.etiket || '') +
            ' · Çerçeve: ' +
            (bilgi.etiket || '') +
            '. ' +
            (sn && sn.hedef != null ? sn.kalan + ' puan sonra yeni tema açılır.' : 'En üst seviyedesin.');
    }

    temaGridiniCiz(seviyeKod, aktifTema);
    vsAktifYenile();
}

function vsAktifYenile() {
    if (!_aktifVsHedefId) return;
    fetch('/api/liderlik/karsilastir/' + encodeURIComponent(_aktifVsHedefId), { credentials: 'same-origin' })
        .then(function (r) {
            return r.json();
        })
        .then(function (d) {
            if (!d || !d.basarili) return;
            if (vsVeriIsle(d)) return;
            vsCanliSeritGuncelle(d);
            var icerik = document.getElementById('yaris-icerik');
            var modal = document.getElementById('yaris-modal');
            if (icerik && modal && !modal.hidden) {
                yarisIcerikCiz(d);
            }
        })
        .catch(function () {});
}

function temaGridiniCiz(maksSeviyeKod, aktifTemaKod) {
    var grid = document.getElementById('odul-grid');
    if (!grid || typeof temalariListele !== 'function') return;
    var liste = temalariListele(maksSeviyeKod);
    grid.innerHTML = liste
        .map(function (t) {
            var sinif =
                'tema-kart tema-sekil-' +
                esc(t.seviye) +
                (t.acildi ? ' tema-acildi' : ' tema-kilitli') +
                (t.seviye === aktifTemaKod ? ' tema-secili' : '');
            var btnTip = t.acildi ? 'button' : 'div';
            var ekstra = t.acildi
                ? ' type="button" data-tema-sec="' + escAttr(t.seviye) + '"'
                : ' aria-disabled="true"';
            return (
                '<' +
                btnTip +
                ' class="' +
                sinif +
                '" role="listitem"' +
                ekstra +
                ' title="' +
                escAttr(t.aciklama) +
                '">' +
                '<span class="tema-kart-onizleme" aria-hidden="true"></span>' +
                '<span class="tema-kart-ikon" aria-hidden="true">' +
                esc(t.ikon) +
                '</span>' +
                '<h3 class="tema-kart-ad">' +
                esc(t.ad) +
                '</h3>' +
                '<p class="tema-kart-meta">' +
                esc(t.seviyeEtiket) +
                ' · ' +
                t.esik +
                ' puan</p>' +
                '<p class="tema-kart-durum">' +
                (t.seviye === aktifTemaKod
                    ? '✓ Seçili'
                    : t.acildi
                      ? 'Uygula'
                      : '🔒 ' + t.esik + ' puan') +
                '</p>' +
                '</' +
                btnTip +
                '>'
            );
        })
        .join('');

    grid.querySelectorAll('[data-tema-sec]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var kod = btn.getAttribute('data-tema-sec');
            if (!kod || typeof seciliTemaKaydet !== 'function') return;
            seciliTemaKaydet(kod);
            seviyeTemasiUygula(kod);
            temaGridiniCiz(maksSeviyeKod, kod);
        });
    });
}

function konfetiPatlat() {
    var root = document.getElementById('confetti-root');
    if (!root) return;
    root.innerHTML = '';
    var sev = document.documentElement.getAttribute('data-seviye') || 'baslangic';
    var renkler = typeof seviyeKonfetiRenkleri === 'function' ? seviyeKonfetiRenkleri(sev) : ['#667eea', '#764ba2'];
    var adet = 48;
    for (var i = 0; i < adet; i++) {
        var p = document.createElement('span');
        p.className = 'confetti-parca';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 0.4 + 's';
        p.style.background = renkler[i % renkler.length];
        p.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
        root.appendChild(p);
    }
    setTimeout(function () {
        root.innerHTML = '';
    }, 2800);
}

function kutlamaGoster(odul) {
    var overlay = document.getElementById('celebration-overlay');
    var text = document.getElementById('celebration-text');
    var puanSatir = document.getElementById('celebration-puan');
    if (!overlay || !text || !puanSatir) return;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('celebration-on');
    text.textContent = odul.puanHatasi
        ? 'Görev tamamlandı; puan sunucuya yazılamadı, sayfayı yenileyip tekrar dene.'
        : 'Görev tamamlandı — aferin!';
    if (odul.puanHatasi) {
        puanSatir.textContent = '';
    } else {
        puanSatir.textContent =
            typeof odul.puan === 'number'
                ? '+' + (odul.kazanilanPuan || 15) + ' puan · Toplam ' + odul.puan + (odul.seviyeEtiket ? ' · ' + odul.seviyeEtiket : '')
                : '+' + (odul.kazanilanPuan || 15) + ' puan';
    }
    konfetiPatlat();
}

function kutlamaKapatKur() {
    var overlay = document.getElementById('celebration-overlay');
    var btn = document.getElementById('celebration-kapat');
    function kapat() {
        if (!overlay) return;
        overlay.classList.remove('celebration-on');
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
    }
    if (btn) btn.addEventListener('click', kapat);
    if (overlay) {
        overlay.querySelector('.celebration-backdrop').addEventListener('click', kapat);
    }
}

function yardimModalKur() {
    var ac = document.getElementById('btn-yardim');
    var modal = document.getElementById('yardim-modal');
    var bg = document.getElementById('yardim-modal-kapat-bg');
    var x = document.getElementById('yardim-modal-kapat');
    var forumLink = document.getElementById('yardim-forum-link');
    var forumUrlTxt = document.getElementById('yardim-forum-url');
    var ekstra = document.getElementById('yardim-ekstra-list');
    var pUcretsiz = document.getElementById('yardim-panel-ucretsiz');
    var pUcretli = document.getElementById('yardim-panel-ucretli');
    var form = document.getElementById('yardim-ucretli-form');
    var ucretliMesaj = document.getElementById('yardim-ucretli-mesaj');

    function kapat() {
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
    }
    function acModal() {
        if (!modal) return;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        fetch('/api/yardim-bilgi', { credentials: 'same-origin' })
            .then(function (r) {
                return r.json();
            })
            .then(function (d) {
                if (!d || !d.basarili) return;
                if (forumLink && d.forumUrl) {
                    forumLink.href = d.forumUrl;
                    if (forumUrlTxt) forumUrlTxt.textContent = d.forumUrl;
                }
                if (ekstra && d.ucretliEkstra && d.ucretliEkstra.length) {
                    ekstra.innerHTML = d.ucretliEkstra
                        .map(function (satir) {
                            return '<li>' + esc(satir) + '</li>';
                        })
                        .join('');
                }
            })
            .catch(function () {});
    }
    if (ac) ac.addEventListener('click', acModal);
    if (bg) bg.addEventListener('click', kapat);
    if (x) x.addEventListener('click', kapat);

    document.querySelectorAll('.yardim-sekme').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.yardim-sekme').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            var u = btn.dataset.yardimSekme === 'ucretsiz';
            if (pUcretsiz) {
                pUcretsiz.hidden = !u;
            }
            if (pUcretli) {
                pUcretli.hidden = u;
            }
        });
    });

    if (forumLink) {
        forumLink.addEventListener('click', function (e) {
            e.preventDefault();
            fetch('/api/yardim', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tur: 'ucretsiz' })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    var url = (d && d.forumUrl) || forumLink.href;
                    window.open(url, '_blank', 'noopener,noreferrer');
                })
                .catch(function () {
                    window.open(forumLink.href, '_blank', 'noopener,noreferrer');
                });
        });
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var mesaj = document.getElementById('yardim-mesaj');
            var konu = document.getElementById('yardim-konu');
            if (ucretliMesaj) ucretliMesaj.textContent = '';
            fetch('/api/yardim', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tur: 'ucretli',
                    konu: konu ? konu.value : '',
                    mesaj: mesaj ? mesaj.value : ''
                })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    if (ucretliMesaj) {
                        ucretliMesaj.textContent = d.mesaj || '';
                        ucretliMesaj.className = 'yardim-kucuk ' + (d.basarili ? 'yardim-ok' : 'yardim-hata');
                    }
                    if (d.basarili && form) form.reset();
                })
                .catch(function () {
                    if (ucretliMesaj) {
                        ucretliMesaj.textContent = 'Gönderilemedi.';
                        ucretliMesaj.className = 'yardim-kucuk yardim-hata';
                    }
                });
        });
    }
}
