/* ============================================================
   preview.js — compile pipeline (source → parse → paginate),
   zoom controls, layout settings application, compile badge.
   ============================================================ */
window.App = window.App || {};

App.preview = (function () {
    const $ = App.utils.$;

    function compile() {
        const t0 = performance.now();
        const doc = App.storage.getActive();
        const settings = App.storage.getSettings();
        if (!doc) return;

        let html = '', sections = [];
        try {
            const res = App.parser.parse(App.editor.getValue(), doc);
            html = res.html;
            sections = res.sections;
        } catch (err) {
            console.error('[preview] parse error:', err);
            html = '<p><strong>Parse error:</strong> ' + App.utils.esc(String(err && err.message || err)) + '</p>';
        }

        const wrapper = $('#pdf-pages-wrapper');
        const pages = App.pagination.paginate(html, settings, settings.pageNumbers);
        wrapper.innerHTML = '';
        wrapper.appendChild(pages);
        wrapper.style.zoom = settings.zoom || 1;

        /* page count badge */
        const count = wrapper.querySelectorAll('.pdf-a4-page').length;
        const pc = $('#page-count');
        if (pc) pc.textContent = count + (count === 1 ? ' page' : ' pages');

        /* outline */
        if (App.sidebar) App.sidebar.renderOutline(sections);

        /* compile time badge */
        const dt = Math.max(0, Math.round(performance.now() - t0));
        const badge = $('#compile-time-badge');
        if (badge) badge.textContent = dt + 'ms';
    }

    function setZoom(z) {
        z = Math.min(2, Math.max(0.4, Math.round(z * 100) / 100));
        App.storage.updateSettings({ zoom: z });
        const wrapper = $('#pdf-pages-wrapper');
        if (wrapper) wrapper.style.zoom = z;
        const label = $('#zoom-level');
        if (label) label.textContent = Math.round(z * 100) + '%';
    }

    function getZoom() { return App.storage.getSettings().zoom || 1; }

    function scrollToSection(id) {
        const wrapper = $('#pdf-pages-wrapper');
        if (!wrapper) return;
        const target = wrapper.querySelector('[data-sec-id="' + id + '"]');
        if (!target) return;
        const scroller = $('#preview-scroll');
        const pageEl = target.closest('.pdf-a4-page');
        if (scroller && pageEl) {
            scroller.scrollTop = pageEl.offsetTop * (App.storage.getSettings().zoom || 1) - 24;
        }
    }

    /* reflect stored layout settings into the ribbon controls */
    function initControls() {
        const s = App.storage.getSettings();

        const margins = $('#layout-margins');
        if (margins) {
            margins.value = s.margins;
            margins.addEventListener('change', function () {
                App.storage.updateSettings({ margins: margins.value });
                compile();
            });
        }
        const cols = $('#layout-columns');
        if (cols) {
            cols.value = s.columns;
            cols.addEventListener('change', function () {
                App.storage.updateSettings({ columns: cols.value });
                compile();
            });
        }
        const fs = $('#layout-fontsize');
        if (fs) {
            fs.value = s.fontSize;
            fs.addEventListener('change', function () {
                App.storage.updateSettings({ fontSize: fs.value });
                compile();
            });
        }
        const sp = $('#layout-spacing');
        if (sp) {
            sp.value = s.spacing;
            sp.addEventListener('change', function () {
                App.storage.updateSettings({ spacing: sp.value });
                compile();
            });
        }
        const pn = $('#layout-page-numbers');
        if (pn) {
            pn.checked = s.pageNumbers;
            pn.addEventListener('change', function () {
                App.storage.updateSettings({ pageNumbers: pn.checked });
                compile();
            });
        }

        /* zoom buttons */
        const zin = $('#zoom-in-btn'), zout = $('#zoom-out-btn'), zfit = $('#zoom-fit-btn');
        if (zin) zin.addEventListener('click', function () { setZoom(getZoom() + 0.1); });
        if (zout) zout.addEventListener('click', function () { setZoom(getZoom() - 0.1); });
        if (zfit) zfit.addEventListener('click', function () { setZoom(1); });
        const label = $('#zoom-level');
        if (label) label.textContent = Math.round(getZoom() * 100) + '%';
    }

    return { compile: compile, setZoom: setZoom, scrollToSection: scrollToSection, initControls: initControls };
})();
