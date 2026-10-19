/* ============================================================
   main.js — bootstrap: storage seed, editor init, compile
   pipeline wiring, header buttons, keyboard shortcuts, autosave,
   gutter drag.
   ============================================================ */
window.App = window.App || {};

(function () {
    const $ = App.utils.$;
    const $$ = App.utils.$$;
    const toast = App.utils.toast;
    const debounce = App.utils.debounce;

    let started = false;

    /* ---------- autosave & auto-compile ---------- */
    const autosave = debounce(function () {
        App.storage.saveActive(App.editor.getValue());
        const badge = $('#autosave-badge');
        if (badge) {
            badge.style.opacity = '1';
            setTimeout(function () { badge.style.opacity = '0'; }, 1200);
        }
    }, 700);

    const autoCompile = debounce(function () {
        if (App.storage.getSettings().autoCompile) App.preview.compile();
    }, 500);

    function onEditorChange() {
        autosave();
        autoCompile();
    }

    /* ---------- document switching ---------- */
    function switchDoc(id, forceReload) {
        const doc = App.storage.setActive(id);
        if (!doc) return;
        App.editor.setValue(doc.source);
        const nameEl = $('#project-name-display');
        if (nameEl) nameEl.textContent = doc.name;
        if (App.sidebar) App.sidebar.refresh();
        App.preview.compile();
        if (forceReload) App.utils.toast('Switched to ' + doc.name);
    }

    /* ---------- recompile button ---------- */
    function recompile() {
        const icon = $('#recompile-icon');
        if (icon) icon.classList.add('animate-spin');
        App.preview.compile();
        setTimeout(function () { if (icon) icon.classList.remove('animate-spin'); }, 350);
    }

    /* ---------- gutter divider drag ---------- */
    function initGutter() {
        const divider = $('#gutter-divider');
        const pane = $('#editor-pane');
        const main = document.querySelector('main');
        if (!divider || !pane || !main) return;

        let dragging = false;
        divider.addEventListener('mousedown', function (ev) {
            dragging = true;
            divider.classList.add('dragging');
            ev.preventDefault();
        });
        window.addEventListener('mousemove', function (ev) {
            if (!dragging) return;
            const rect = main.getBoundingClientRect();
            const pct = Math.min(85, Math.max(15, ((ev.clientX - rect.left) / rect.width) * 100));
            pane.style.width = pct + '%';
        });
        window.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            divider.classList.remove('dragging');
            const rect = main.getBoundingClientRect();
            const pct = Math.min(85, Math.max(15, (pane.getBoundingClientRect().width / rect.width) * 100));
            App.storage.updateSettings({ editorWidthPct: pct });
        });
    }

    /* ---------- global keyboard shortcuts ---------- */
    function initShortcuts() {
        document.addEventListener('keydown', function (ev) {
            const mod = ev.ctrlKey || ev.metaKey;
            if (!mod) {
                if (ev.key === 'Escape') {
                    if (App.findreplace && App.findreplace.isOpen()) App.findreplace.close();
                    if (App.modals) App.modals.closeHelp();
                }
                return;
            }
            const key = ev.key.toLowerCase();

            if (key === 'enter') { ev.preventDefault(); recompile(); return; }
            if (key === 'f') { ev.preventDefault(); App.findreplace.open(); return; }
            if (key === 'k') { ev.preventDefault(); App.ribbon.focusSearch(); return; }
            if (key === '/') { ev.preventDefault(); App.modals.openHelp(); return; }
            if (key === 'p') { ev.preventDefault(); App.exporter.exportPDF(); return; }
            if (key === 's') { ev.preventDefault(); autosave.cancel ? autosave.cancel() : null; App.storage.saveActive(App.editor.getValue()); toast('Saved'); return; }
            if (ev.shiftKey && key === 'c') { ev.preventDefault(); App.exporter.copySource(); return; }
        });
    }

    /* ---------- header buttons ---------- */
    function initHeaderButtons() {
        const recompileBtn = $('#recompile-btn');
        if (recompileBtn) recompileBtn.addEventListener('click', recompile);

        const autoToggle = $('#auto-compile-toggle');
        if (autoToggle) {
            autoToggle.checked = App.storage.getSettings().autoCompile;
            autoToggle.addEventListener('change', function () {
                App.storage.updateSettings({ autoCompile: autoToggle.checked });
            });
        }

        const undoBtn = $('#undo-btn');
        if (undoBtn) undoBtn.addEventListener('click', function () { App.editor.undo(); });
        const redoBtn = $('#redo-btn');
        if (redoBtn) redoBtn.addEventListener('click', function () { App.editor.redo(); });
    }

    /* ---------- boot ---------- */
    function boot() {
        if (started) return;
        started = true;

        const state = App.storage.load();

        App.theme.apply(state.settings.theme);
        App.ribbon.init();
        App.sidebar.init();
        App.modals.init();
        App.findreplace.init();
        App.theme.init();
        App.images.init();
        App.exporter.init();
        App.preview.initControls();
        initHeaderButtons();
        initGutter();
        initShortcuts();

        const host = $('#cm-host');
        App.editor.init(host, onEditorChange).then(function () {
            const doc = App.storage.getActive();
            App.editor.setValue(doc.source);
            const nameEl = $('#project-name-display');
            if (nameEl) nameEl.textContent = doc.name;

            /* restore editor width */
            const pane = $('#editor-pane');
            if (pane && state.settings.editorWidthPct) pane.style.width = state.settings.editorWidthPct + '%';

            App.preview.compile();

            /* re-measure once webfonts arrive (Latin Modern changes metrics) */
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function () { App.preview.compile(); });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* exposed for sidebar / modals */
    App.main = { switchDoc: switchDoc, recompile: recompile };
})();
