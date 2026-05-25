/* global tema kontrolu */
(function () {
    var THEME_KEY = 'tema';

    function sistemTemasiKoyuMu() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function temaAl() {
        var kayitli = localStorage.getItem(THEME_KEY);
        if (kayitli === 'dark' || kayitli === 'light') return kayitli;
        return sistemTemasiKoyuMu() ? 'dark' : 'light';
    }

    function temaUygula(tema) {
        var secilen = tema === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', secilen);
        localStorage.setItem(THEME_KEY, secilen);
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            btn.textContent = secilen === 'dark' ? 'Aydinlik Mod' : 'Karanlik Mod';
            btn.setAttribute('aria-pressed', secilen === 'dark' ? 'true' : 'false');
        });
    }

    function temaDegistir() {
        temaUygula(temaAl() === 'dark' ? 'light' : 'dark');
    }

    function temaButonlariniHazirla() {
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            btn.addEventListener('click', temaDegistir);
        });
        temaUygula(temaAl());
    }

    window.temaUygula = temaUygula;
    window.temaButonlariniHazirla = temaButonlariniHazirla;
    temaUygula(temaAl());
})();
