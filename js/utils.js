/* ============================================================
   utils.js — DOM helpers, escaping, debounce, toast banner
   ============================================================ */
window.App = window.App || {};

App.utils = (function () {
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function debounce(fn, ms) {
        let t = null;
        return function () {
            const args = arguments, self = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    }

    let toastTimer = null;
    function toast(msg, ms) {
        const el = $('#toast-banner');
        if (!el) return;
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.style.opacity = '0'; }, ms || 1800);
    }

    return { $: $, $$: $$, esc: esc, debounce: debounce, toast: toast };
})();
