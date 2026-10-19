/* ============================================================
   findreplace.js — Find & Replace over the LaTeX source
   (Ctrl+F). Counts matches, jumps between them, replaces
   one or all, with optional case sensitivity.
   ============================================================ */
window.App = window.App || {};

App.findreplace = (function () {
    const $ = App.utils.$;

    let matches = [];
    let pointer = -1;

    function isOpen() {
        const modal = $('#find-modal');
        return modal && !modal.classList.contains('hidden');
    }

    function open() {
        const modal = $('#find-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const input = $('#find-input');
        if (input) { input.focus(); input.select(); }
        recount();
    }

    function close() {
        const modal = $('#find-modal');
        if (modal) modal.classList.add('hidden');
    }

    function options() {
        const caseToggle = $('#find-case-toggle');
        return { caseSensitive: !!(caseToggle && caseToggle.checked) };
    }

    function computeMatches() {
        const q = $('#find-input') ? $('#find-input').value : '';
        const text = App.editor.getValue();
        matches = [];
        pointer = -1;
        if (!q) return matches;
        const opt = options();
        const hay = opt.caseSensitive ? text : text.toLowerCase();
        const needle = opt.caseSensitive ? q : q.toLowerCase();
        let idx = 0;
        for (;;) {
            const found = hay.indexOf(needle, idx);
            if (found === -1) break;
            matches.push({ from: found, to: found + needle.length });
            idx = found + needle.length;
        }
        return matches;
    }

    function recount() {
        computeMatches();
        const counter = $('#find-count');
        if (counter) counter.textContent = matches.length + (matches.length === 1 ? ' match' : ' matches');
    }

    function jump(dir) {
        if (!matches.length) { recount(); if (!matches.length) return; }
        pointer = (pointer + dir + matches.length) % matches.length;
        const m = matches[pointer];
        App.editor.selectRange(m.from, m.to);
        const counter = $('#find-count');
        if (counter) counter.textContent = (pointer + 1) + ' / ' + matches.length;
    }

    function replaceOne() {
        const rep = $('#replace-input') ? $('#replace-input').value : '';
        if (!matches.length) { recount(); return; }
        if (pointer < 0) pointer = 0;
        const m = matches[Math.min(pointer, matches.length - 1)];
        const text = App.editor.getValue();
        App.editor.setValue(text.slice(0, m.from) + rep + text.slice(m.to));
        recount();
    }

    function replaceAll() {
        const rep = $('#replace-input') ? $('#replace-input').value : '';
        recount();
        if (!matches.length) return;
        const text = App.editor.getValue();
        /* replace from the end so indices stay valid */
        let out = text;
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            out = out.slice(0, m.from) + rep + out.slice(m.to);
        }
        App.editor.setValue(out);
        App.utils.toast('Replaced ' + matches.length + ' occurrence' + (matches.length === 1 ? '' : 's'));
        recount();
    }

    function init() {
        const openBtn = $('#open-find-btn');
        if (openBtn) openBtn.addEventListener('click', open);

        const closeBtn = $('#find-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', close);
        const backdrop = $('[data-close-find]');
        if (backdrop) backdrop.addEventListener('click', close);

        const input = $('#find-input');
        if (input) {
            input.addEventListener('input', function () { recount(); pointer = -1; });
            input.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') { ev.preventDefault(); jump(ev.shiftKey ? -1 : 1); }
            });
        }
        const caseToggle = $('#find-case-toggle');
        if (caseToggle) caseToggle.addEventListener('change', function () { recount(); pointer = -1; });

        const next = $('#find-next-btn'), prev = $('#find-prev-btn');
        if (next) next.addEventListener('click', function () { jump(1); });
        if (prev) prev.addEventListener('click', function () { jump(-1); });

        const r1 = $('#replace-one-btn'), rAll = $('#replace-all-btn');
        if (r1) r1.addEventListener('click', replaceOne);
        if (rAll) rAll.addEventListener('click', replaceAll);
    }

    return { init: init, open: open, close: close, isOpen: isOpen };
})();
