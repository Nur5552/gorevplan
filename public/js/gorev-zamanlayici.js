/* Son tarih / saat için canlı geri sayım (saniye dahil). */
(function () {
    function normalizeSonTarih(v) {
        if (v == null || v === '') return '';
        if (typeof v === 'string') {
            var s = v.trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s;
            if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T');
            return s.split('T')[0].split(' ')[0];
        }
        if (typeof v === 'object' && v instanceof Date && !isNaN(v.getTime())) {
            var y = v.getFullYear();
            var mo = String(v.getMonth() + 1).padStart(2, '0');
            var da = String(v.getDate()).padStart(2, '0');
            var h = String(v.getHours()).padStart(2, '0');
            var mi = String(v.getMinutes()).padStart(2, '0');
            var se = String(v.getSeconds()).padStart(2, '0');
            if (h === '00' && mi === '00' && se === '00') return y + '-' + mo + '-' + da;
            return y + '-' + mo + '-' + da + 'T' + h + ':' + mi + ':' + se;
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

    function sonTarihHedefMs(ham) {
        if (ham == null || ham === '') return null;
        var norm = normalizeSonTarih(ham);
        if (!norm) return null;
        if (norm.indexOf('T') !== -1) {
            var parcalar = norm.split('T');
            var gun = parcalar[0].split('-');
            var saatParca = (parcalar[1] || '23:59:59').split(':');
            var y = parseInt(gun[0], 10);
            var mo = parseInt(gun[1], 10);
            var da = parseInt(gun[2], 10);
            var h = parseInt(saatParca[0], 10) || 0;
            var mi = parseInt(saatParca[1], 10) || 0;
            var se = parseInt(saatParca[2], 10) || 0;
            var ms = new Date(y, mo - 1, da, h, mi, se, 0).getTime();
            return isNaN(ms) ? null : ms;
        }
        return yerelGunSonuMs(norm);
    }

    function sonTarihGosterimMetni(ham) {
        var ms = sonTarihHedefMs(ham);
        if (ms == null) return '';
        return new Date(ms).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function kalanSureGeriSayimMetni(kalanMs) {
        var sn = Math.max(0, Math.floor(kalanMs / 1000));
        var gun = Math.floor(sn / 86400);
        var saat = Math.floor((sn % 86400) / 3600);
        var dak = Math.floor((sn % 3600) / 60);
        var s = sn % 60;
        var pad = function (n) {
            return n < 10 ? '0' + n : String(n);
        };
        if (gun > 0) {
            return gun + ' gün ' + pad(saat) + ' sa ' + pad(dak) + ' dk ' + pad(s) + ' sn';
        }
        return pad(saat) + ' sa ' + pad(dak) + ' dk ' + pad(s) + ' sn';
    }

    function blokGuncelle(blok) {
        if (!blok || !blok.getAttribute) return;
        var durum = blok.getAttribute('data-durum') || '';
        var ham = blok.getAttribute('data-son-tarih') || '';
        var hedefEl = blok.querySelector('.gorev-son-hedef');
        var sayacEl = blok.querySelector('.gorev-kalan-sure');
        blok.classList.remove('gecikt', 'yakinda');

        if (!ham || durum === 'tamamlandi') {
            blok.setAttribute('hidden', 'hidden');
            if (hedefEl) hedefEl.textContent = '';
            if (sayacEl) sayacEl.textContent = '';
            return;
        }
        blok.removeAttribute('hidden');

        var sonMs = sonTarihHedefMs(ham);
        if (sonMs == null) {
            if (hedefEl) hedefEl.textContent = '';
            if (sayacEl) sayacEl.textContent = '';
            return;
        }

        if (hedefEl) {
            hedefEl.textContent = '📅 Son: ' + sonTarihGosterimMetni(ham);
        }

        if (!sayacEl) return;

        var simdi = Date.now();
        var kalan = sonMs - simdi;
        if (kalan <= 0) {
            sayacEl.textContent = '⏱ Süre doldu (0 sn)';
            blok.classList.add('gecikt');
            sayacEl.setAttribute('title', 'Son tarih geçti.');
            return;
        }

        sayacEl.textContent = '⏱ Kalan: ' + kalanSureGeriSayimMetni(kalan);
        sayacEl.setAttribute(
            'title',
            'Canlı geri sayım — ' + Math.floor(kalan / 1000) + ' saniye kaldı.'
        );
        if (kalan < 24 * 3600000) blok.classList.add('yakinda');
    }

    window.gorevZamanNormalizeSon = normalizeSonTarih;
    window.gorevZamanYerelGunSonuMs = yerelGunSonuMs;
    window.gorevZamanSonMs = sonTarihHedefMs;
    window.gorevZamanSonMetin = sonTarihGosterimMetni;

    function legacySpanGuncelle(el) {
        if (!el || el.closest('.gorev-zaman-blok')) return;
        var durum = el.getAttribute('data-durum') || '';
        var ham = el.getAttribute('data-son-tarih') || '';
        el.classList.remove('gecikt', 'yakinda');
        if (!ham || durum === 'tamamlandi') {
            el.textContent = '';
            el.setAttribute('hidden', 'hidden');
            return;
        }
        el.removeAttribute('hidden');
        var sonMs = sonTarihHedefMs(ham);
        if (sonMs == null) {
            el.textContent = '';
            return;
        }
        var kalan = sonMs - Date.now();
        var hedef = sonTarihGosterimMetni(ham);
        if (kalan <= 0) {
            el.textContent = '📅 ' + hedef + ' · Süre doldu';
            el.classList.add('gecikt');
            return;
        }
        el.textContent = '📅 ' + hedef + ' · ⏱ ' + kalanSureGeriSayimMetni(kalan);
        if (kalan < 24 * 3600000) el.classList.add('yakinda');
    }

    window.gorevZamanlayiciHepsiniGuncelle = function () {
        document.querySelectorAll('.gorev-zaman-blok').forEach(blokGuncelle);
        document.querySelectorAll('.gorev-kalan-sure[data-son-tarih]').forEach(legacySpanGuncelle);
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
