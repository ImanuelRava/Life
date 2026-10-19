/* ============================================================
   modals.js — help/shortcuts modal + Templates popover.
   ============================================================ */
window.App = window.App || {};

App.modals = (function () {
    const $ = App.utils.$;
    const $$ = App.utils.$$;
    const esc = App.utils.esc;

    const SHORTCUTS = [
        ['Undo', 'Ctrl+Z'],
        ['Redo', 'Ctrl+Y'],
        ['Bold', 'Ctrl+B'],
        ['Italic', 'Ctrl+I'],
        ['Underline', 'Ctrl+U'],
        ['Recompile', 'Ctrl+Enter'],
        ['Export PDF (print dialog)', 'Ctrl+P'],
        ['Find & Replace', 'Ctrl+F'],
        ['Search symbols & commands', 'Ctrl+K'],
        ['Keyboard shortcuts', 'Ctrl+/'],
        ['Copy LaTeX source', 'Ctrl+Shift+C'],
        ['Save now (autosave is on)', 'Ctrl+S']
    ];

    function fillHelp() {
        const grid = $('#help-shortcut-grid');
        if (!grid) return;
        grid.innerHTML = SHORTCUTS.map(function (pair) {
            return '<span class="sc-desc">' + esc(pair[0]) + '</span><kbd>' + esc(pair[1]) + '</kbd>';
        }).join('');
    }

    function openHelp() {
        const modal = $('#help-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeHelp() {
        const modal = $('#help-modal');
        if (modal) modal.classList.add('hidden');
    }

    function closeFind() {
        if (App.findreplace) App.findreplace.close();
    }

    /* ---- Templates popover ---- */
    let templatesBuilt = false;

    function buildTemplates() {
        const pop = $('#templates-popover');
        if (!pop || templatesBuilt) return;
        pop.innerHTML = App.TEMPLATES.map(function (t, i) {
            return '<div class="menu-item" data-template="' + i + '">' +
                '<i data-lucide="' + t.icon + '"></i>' +
                '<div><div class="mi-title">' + esc(t.title) + '</div>' +
                '<div class="mi-desc">' + esc(t.desc) + '</div></div></div>';
        }).join('');
        pop.addEventListener('click', function (ev) {
            const item = ev.target.closest('[data-template]');
            if (!item) return;
            applyTemplate(parseInt(item.getAttribute('data-template'), 10));
            closeTemplates();
        });
        templatesBuilt = true;
        if (window.lucide) window.lucide.createIcons();
    }

    function applyTemplate(idx) {
        const t = App.TEMPLATES[idx];
        if (!t) return;
        App.editor.setValue(t.source);
        App.storage.saveActive(t.source);
        App.preview.compile();
        App.utils.toast('Template applied: ' + t.title);
    }

    function openTemplates(anchorBtn) {
        buildTemplates();
        const pop = $('#templates-popover');
        if (!pop) return;
        const rect = anchorBtn.getBoundingClientRect();
        pop.style.top = (rect.bottom + window.scrollY + 6) + 'px';
        const left = Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 240);
        pop.style.left = Math.max(8, left) + 'px';
        pop.classList.add('open');
    }

    function closeTemplates() {
        const pop = $('#templates-popover');
        if (pop) pop.classList.remove('open');
    }

    function templatesOpen() {
        const pop = $('#templates-popover');
        return !!(pop && pop.classList.contains('open'));
    }

    function init() {
        const helpBtn = $('#open-help-btn');
        if (helpBtn) helpBtn.addEventListener('click', openHelp);
        const helpClose = $('#help-close-btn');
        if (helpClose) helpClose.addEventListener('click', closeHelp);
        const helpBackdrop = $('[data-close-help]');
        if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelp);

        const tplBtn = $('#templates-btn');
        if (tplBtn) {
            tplBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (templatesOpen()) closeTemplates();
                else openTemplates(tplBtn);
            });
        }
        document.addEventListener('click', function (ev) {
            if (templatesOpen() && !ev.target.closest('#templates-popover')) closeTemplates();
        });

        fillHelp();
    }

    return { init: init, openHelp: openHelp, closeHelp: closeHelp, closeFind: closeFind, closeTemplates: closeTemplates };
})();
