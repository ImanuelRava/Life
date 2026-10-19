/* ============================================================
   ribbon.js — Office-style ribbon: tab switching, snippet
   insertion, color dots, KaTeX-rendered symbol buttons, live
   symbol/command search (Ctrl+K).
   ============================================================ */
window.App = window.App || {};

App.ribbon = (function () {
    const $ = App.utils.$;
    const $$ = App.utils.$$;

    function initTabs() {
        $$('.ribbon-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activateTab(btn.getAttribute('data-target'));
            });
        });
    }

    function activateTab(targetId) {
        $$('.ribbon-tab-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-target') === targetId);
        });
        $$('.ribbon-tab-panel').forEach(function (p) {
            if (p.id === 'tab-search-results') return;   /* handled by search */
            p.classList.toggle('hidden', p.id !== targetId);
        });
        const res = $('#tab-search-results');
        if (res) res.classList.remove('active');
    }

    /* Render KaTeX glyphs into empty .sym-btn buttons */
    function renderSymbolButtons() {
        $$('.sym-btn').forEach(function (btn) {
            if (btn.childNodes.length) return;
            const tex = btn.getAttribute('data-snippet') || '';
            try {
                btn.innerHTML = katex.renderToString(tex, { throwOnError: false });
                const k = btn.querySelector('.katex');
                if (k) k.style.fontSize = '0.95em';
            } catch (e) {
                btn.textContent = tex;
            }
        });
    }

    /* data-snippet buttons (event delegation covers search-result clones) */
    function initSnippetButtons() {
        const bar = $('section.bg-slate-900');
        if (!bar) return;
        bar.addEventListener('click', function (ev) {
            const btn = ev.target.closest('[data-snippet]');
            if (btn) {
                const snippet = btn.getAttribute('data-snippet') || '';
                const offset = parseInt(btn.getAttribute('data-offset') || '0', 10);
                App.editor.insertSnippet(snippet, offset);
                return;
            }
            const dot = ev.target.closest('.ribbon-color-dot');
            if (dot) {
                const color = dot.getAttribute('data-color') || 'red';
                $$('.ribbon-color-dot').forEach(function (d) { d.classList.remove('dot-active'); });
                dot.classList.add('dot-active');
                App.editor.insertSnippet('\\textcolor{' + color + '}{text}', 0);
            }
        });
    }

    /* Ctrl+B / Ctrl+I / Ctrl+U helper (also used by editor keymap) */
    function applyTextWrap(cmd) {
        App.editor.insertSnippet(cmd + '{text}', 0);
    }

    /* ---- live search over every ribbon button ---- */
    function initSearch() {
        const input = $('#ribbon-search');
        const clearBtn = $('#ribbon-search-clear');
        const panel = $('#tab-search-results');
        if (!input || !panel) return;

        function runSearch() {
            const q = input.value.trim().toLowerCase();
            if (!q) { clearSearch(); return; }

            const results = [];
            $$('.ribbon-tab-panel [data-snippet], .ribbon-tab-panel [title]').forEach(function (btn) {
                if (!btn.hasAttribute('data-snippet')) return;
                const hay = ((btn.getAttribute('title') || '') + ' ' +
                             (btn.getAttribute('data-snippet') || '') + ' ' +
                             btn.textContent).toLowerCase();
                if (hay.indexOf(q) !== -1 && results.length < 40) results.push(btn);
            });

            panel.innerHTML = '';
            if (!results.length) {
                panel.innerHTML = '<div class="search-no-results">No symbols or commands match "' +
                    App.utils.esc(input.value) + '"</div>';
            } else {
                results.forEach(function (btn) {
                    const clone = btn.cloneNode(true);
                    clone.classList.remove('hidden');
                    panel.appendChild(clone);
                });
            }
            panel.classList.add('active');
            $$('.ribbon-tab-panel').forEach(function (p) {
                if (p.id !== 'tab-search-results') p.classList.add('hidden');
            });
            if (clearBtn) clearBtn.classList.remove('hidden');
        }

        function clearSearch() {
            input.value = '';
            panel.classList.remove('active');
            panel.innerHTML = '';
            if (clearBtn) clearBtn.classList.add('hidden');
            activateTab('tab-home');
        }

        input.addEventListener('input', runSearch);
        if (clearBtn) clearBtn.addEventListener('click', clearSearch);
        input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') { clearSearch(); input.blur(); }
        });
        focusSearch = function () { input.focus(); input.select(); };
    }

    let focusSearch = function () {};

    function init() {
        initTabs();
        renderSymbolButtons();
        initSnippetButtons();
        initSearch();
        if (window.lucide) window.lucide.createIcons();
    }

    return { init: init, activateTab: activateTab, applyTextWrap: applyTextWrap, focusSearch: function () { focusSearch(); } };
})();
