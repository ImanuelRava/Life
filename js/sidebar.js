/* ============================================================
   sidebar.js — documents list (switch / create / delete) and
   the document outline (click → scroll preview to section).
   ============================================================ */
window.App = window.App || {};

App.sidebar = (function () {
    const $ = App.utils.$;
    const $$ = App.utils.$$;
    const esc = App.utils.esc;

    function renderDocs() {
        const list = $('#doc-list');
        if (!list) return;
        const docs = App.storage.listDocs();
        const active = App.storage.getActive();
        list.innerHTML = '';
        docs.forEach(function (doc) {
            const row = document.createElement('div');
            row.className = 'doc-item flex items-center justify-between pl-3 pr-1.5 py-1.5' +
                (active && doc.id === active.id ? ' active' : '');
            row.innerHTML =
                '<span class="doc-name text-xs truncate">' + esc(doc.name) + '</span>' +
                '<button class="doc-del p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400 opacity-0 hover:opacity-100 transition" title="Delete document">' +
                '<i data-lucide="trash-2" class="w-3 h-3"></i></button>';
            row.addEventListener('click', function () {
                if (App.main) App.main.switchDoc(doc.id);
            });
            row.querySelector('.doc-del').addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (docs.length <= 1 || confirm('Delete "' + doc.name + '"?')) {
                    App.storage.deleteDoc(doc.id);
                    if (App.main) App.main.switchDoc(App.storage.getActive().id, true);
                    App.utils.toast('Document deleted');
                }
            });
            list.appendChild(row);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    function renderOutline(sections) {
        const list = $('#outline-list');
        if (!list) return;
        list.innerHTML = '';
        if (!sections || !sections.length) {
            list.innerHTML = '<div class="px-3 py-2 text-[11px] text-slate-500 italic">No sections yet</div>';
            return;
        }
        sections.forEach(function (sec) {
            const item = document.createElement('div');
            item.className = 'outline-item ' + (sec.level === 1 ? 'h1' : sec.level === 2 ? 'h2' : 'h3');
            item.textContent = (sec.number ? sec.number + ' ' : '') + sec.title;
            item.title = item.textContent;
            item.addEventListener('click', function () {
                $$('.outline-item').forEach(function (o) { o.classList.remove('active'); });
                item.classList.add('active');
                if (App.preview) App.preview.scrollToSection(sec.id);
            });
            list.appendChild(item);
        });
    }

    function init() {
        const newBtn = $('#new-doc-btn');
        if (newBtn) {
            newBtn.addEventListener('click', function () {
                const doc = App.storage.createDoc('Untitled.tex', App.SAMPLE_DOC().source);
                if (App.main) App.main.switchDoc(doc.id, true);
                App.utils.toast('New document created');
            });
        }
        renderDocs();
    }

    function refresh() { renderDocs(); }

    return { init: init, refresh: refresh, renderOutline: renderOutline, renderDocs: renderDocs };
})();
