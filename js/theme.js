/* ============================================================
   theme.js — dark / light theme toggle (persisted).
   The paper pages stay white in both themes (they are the
   document); only the app chrome changes.
   ============================================================ */
window.App = window.App || {};

App.theme = (function () {
    const $ = App.utils.$;

    function apply(theme) {
        const light = theme === 'light';
        document.body.classList.toggle('light', light);
        const darkIcon = $('.theme-icon-dark');
        const lightIcon = $('.theme-icon-light');
        if (darkIcon) darkIcon.classList.toggle('hidden', light);
        if (lightIcon) lightIcon.classList.toggle('hidden', !light);
        App.storage.updateSettings({ theme: light ? 'light' : 'dark' });
    }

    function current() {
        return document.body.classList.contains('light') ? 'light' : 'dark';
    }

    function toggle() {
        apply(current() === 'light' ? 'dark' : 'light');
    }

    function init() {
        const btn = $('#toggle-theme-btn');
        if (btn) btn.addEventListener('click', toggle);
    }

    return { apply: apply, toggle: toggle, init: init, current: current };
})();
