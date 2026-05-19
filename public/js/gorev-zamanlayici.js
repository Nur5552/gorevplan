/* Son tarih (gün) için kalan süre: yerel zaman diliminde o gün 23:59:59’a kadar. */
(function () {
    function normalizeSonTarih(v) {
        if (v == null || v === '') return '';
        if (typeof v === 'string') return v.split('T')[0].split(' ')[0];
        if (typeof v === 'object' && v instanceof Date && !isNaN(v.getTime())) {
            var y = v.getFullYear();
            var mo = String(v.getMonth() + 1).padStart(2, '0');
            var da = String(v.getDate()).padStart(2, '0');
            return y + '-' + mo + '-' + da;
        }
        return String(v).split('T')[0].split(' ')[0];
    }

    function yerelGunSonuMs(isoGun) {
        var p = String(isoGun).split('-');
        if (p.length !== 3) return null;
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        var d = parseInt(p[2], 10);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    }

    window.gorevZamanNormalizeSon = normalizeSonTarih;
    window.gorevZamanYerelGunSonuMs = yerelGunSonuMs;

    /** kalanMs: milisaniye; canlı geri sayım metni (gün / sa / dk / sn). */
    function kalanSureGeriSayimMetni(kalanMs) {
        var sn = Math.max(0, Math.floor(kalanMs / 1000));
        var gun = Math.floor(sn / 86400);
        var saat = Math.floor((sn % 86400) / 3600);
        var dak = Math.floor((sn % 3600) / 60);
        var s = sn % 60;
        if (gun > 0) {
            return gun + ' gün ' + saat + ' sa ' + dak + ' dk ' + s + ' sn';
        }
        if (saat > 0) {
            return saat + ' sa ' + dak + ' dk ' + s + ' sn';
        }
        if (dak > 0) {
            return dak + ' dk ' + s + ' sn';
        }
        return s + ' sn';
    }

    function spanGuncelle(el) {
        if (!el || !el.getAttribute) return;
        var durum = el.getAttribute('data-durum') || '';
        var sonIso = normalizeSonTarih(el.getAttribute('data-son-tarih'));
        el.classList.remove('gecikt', 'yakinda');
        if (!sonIso || durum === 'tamamlandi') {
            el.textContent = '';
            el.removeAttribute('title');
            el.setAttribute('hidden', 'hidden');
            return;
        }
        el.removeAttribute('hidden');
        var sonMs = yerelGunSonuMs(sonIso);
        if (sonMs == null) {
            el.textContent = '';
            el.removeAttribute('title');
            return;
        }
        var simdi = Date.now();
        var kalan = sonMs - simdi;
        if (kalan <= 0) {
            el.textContent = 'Süre doldu';
            el.classList.add('gecikt');
            el.setAttribute('title', 'Son gün geçti; görev henüz bitirilmemiş görünüyor.');
            return;
        }
        el.textContent = '⏱ ' + kalanSureGeriSayimMetni(kalan) + ' kaldı';
        el.setAttribute('title', 'Son güne göre canlı geri sayım (o gün 23:59’a kadar).');
        if (kalan < 24 * 3600000) el.classList.add('yakinda');
    }

    window.gorevZamanlayiciHepsiniGuncelle = function () {
        document.querySelectorAll('.gorev-kalan-sure').forEach(spanGuncelle);
    };

    window.gorevZamanlayiciBaslat = function () {
        if (window._gorevZamanlayiciId) {
            clearInterval(window._gorevZamanlayiciId);
            window._gorevZamanlayiciId = null;
        }
        window.gorevZamanlayiciHepsiniGuncelle();
        window._gorevZamanlayiciId = setInterval(window.gorevZamanlayiciHepsiniGuncelle, 1000);
    };

    window.gorevZamanlayiciDurdur = function () {
        if (window._gorevZamanlayiciId) {
            clearInterval(window._gorevZamanlayiciId);
            window._gorevZamanlayiciId = null;
        }
    };
})();
