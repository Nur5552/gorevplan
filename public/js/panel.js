/* panel: gorev listesi + muzik - /panel sayfasi */

var MUZIK = {
    spotifyEmbed: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ',
    youtubeEmbed: 'https://www.youtube.com/embed/jfKfPfyJRdk'
};

var tumGorevler = [];
var aktifFiltre = 'hepsi';

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
        var bitis = sonMsFn(sonIso);
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
    filtreButonlariAyarla();
    muzikKur();
    yardimModalKur();
    kutlamaKapatKur();
    hatirlaticiKur();
});

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
            document.getElementById('kullanici-adi').textContent = 'Hoş geldin, ' + k.ad + '!';
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
        var sonNorm =
            gorev.son_tarih && typeof window.gorevZamanNormalizeSon === 'function'
                ? window.gorevZamanNormalizeSon(gorev.son_tarih)
                : '';
        var kalanHtml =
            sonNorm && d !== 'tamamlandi'
                ? '<span class="gorev-kalan-sure" data-son-tarih="' +
                  escAttr(sonNorm) +
                  '" data-durum="' +
                  escAttr(d) +
                  '" aria-live="polite"></span>'
                : '';
        return (
            '<div class="gorev-karti ' + esc(d) + '">' +
            '<div class="gorev-icerik"><h3>' + esc(gorev.gorev_adi) + '</h3>' +
            (gorev.aciklama ? '<p>' + esc(gorev.aciklama) + '</p>' : '') +
            '<div class="gorev-meta">' +
            (gorev.son_tarih ? '<span class="tarih">📅 ' + esc(tarihFormat(gorev.son_tarih)) + '</span>' : '') +
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
        })
        .catch(function () {
            window.location.href = '/giris.html';
        });
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
        })
        .catch(function () {});
}

function odulSatiriniGuncelle(o) {
    var pEl = document.getElementById('odul-puan');
    var sEl = document.getElementById('odul-seviye');
    var iEl = document.getElementById('odul-ilerleme');
    if (!pEl || !sEl || !iEl) return;
    if (typeof o.puan === 'number') pEl.textContent = String(o.puan);
    if (o.seviyeEtiket) sEl.textContent = o.seviyeEtiket;
    var sn = o.sonraki || (o.sonrakiEsik ? { hedef: o.sonrakiEsik.hedef, kalan: o.sonrakiEsik.kalan } : null);
    if (sn && sn.hedef != null) {
        iEl.textContent = 'Sonraki seviye için ' + sn.kalan + ' puan kaldı (hedef ' + sn.hedef + ').';
    } else if (sn && sn.hedef == null) {
        iEl.textContent = 'Tüm seviyeleri açtın — böyle devam!';
    } else {
        iEl.textContent = 'Her tamamlanan görev +' + (o.tamamlamaPuani || 15) + ' puan.';
    }
}

function konfetiPatlat() {
    var root = document.getElementById('confetti-root');
    if (!root) return;
    root.innerHTML = '';
    var renkler = ['#667eea', '#764ba2', '#f6d365', '#fda085', '#43e97b', '#38f9d7', '#ff6b6b'];
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
