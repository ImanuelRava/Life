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
        applyZoom();

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

    /* ---- zoom engine ------------------------------------------------
       Two modes:
       - fit mode  (settings.zoomFit !== false): page is scaled to exactly
         fill the preview pane width; recomputed on pane/window resize.
       - manual mode (settings.zoomFit === false): fixed zoom steps via
         the +/- buttons; value persisted in settings.zoom.
       The last applied value lives in _appliedZoom and is mirrored into
       settings.zoom so scrollToSection() keeps working in both modes.

       MEASUREMENT RULE: page geometry is always measured in an UNZOOMED
       state (wrapper zoom cleared + getBoundingClientRect). Reading
       offsetWidth from inside a zoomed subtree returns the already-scaled
       width on some engines, which turns fit-width into a runaway
       feedback loop while the gutter divider is dragged. */
    const ZOOM_MIN = 0.25, ZOOM_MAX = 3;
    let _appliedZoom = 1;

    /* settings.zoom persistence is debounced: refit() runs on every
       animation frame during a gutter drag and updateSettings() writes
       the whole state to localStorage synchronously — doing that per
       frame stutters the drag. */
    const persistZoom = App.utils.debounce(function () {
        App.storage.updateSettings({ zoom: _appliedZoom });
    }, 300);

    function applyZoomValue(z) {
        const wrapper = $('#pdf-pages-wrapper');
        if (!wrapper) return;
        _appliedZoom = z;
        wrapper.style.zoom = z;
        const label = $('#zoom-level');
        if (label) label.textContent = Math.round(z * 100) + '%';
    }

    function fitZoomValue() {
        const scroller = $('#preview-scroll');
        const wrapper = $('#pdf-pages-wrapper');
        if (!scroller || !wrapper) return 1;
        const page = wrapper.querySelector('.pdf-a4-page');
        if (!page) return 1;
        /* measure in unzoomed space: clear zoom, read visual width, restore */
        const prevZoom = wrapper.style.zoom;
        wrapper.style.zoom = '';
        const pageW = page.getBoundingClientRect().width; /* 210mm ≈ 793.7px */
        wrapper.style.zoom = prevZoom;
        const avail = scroller.clientWidth - 28;         /* breathing gap */
        if (avail <= 40 || !pageW) return 1;
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, avail / pageW));
    }

    function isFitMode() { return App.storage.getSettings().zoomFit !== false; }

    function applyZoom() {
        const s = App.storage.getSettings();
        const z = (s.zoomFit !== false) ? fitZoomValue() : (s.zoom || 1);
        applyZoomValue(z);
        persistZoom();
    }

    function setZoom(z) {
        z = Math.min(2, Math.max(0.4, Math.round(z * 100) / 100));
        App.storage.updateSettings({ zoom: z, zoomFit: false });
        applyZoomValue(z);
    }

    function setFit() {
        App.storage.updateSettings({ zoomFit: true });
        applyZoom();
    }

    function getZoom() { return _appliedZoom || App.storage.getSettings().zoom || 1; }

    /* keep fit-width correct when the window changes size */
    let _resizeTimer = null;
    window.addEventListener('resize', function () {
        if (!isFitMode()) return;
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(applyZoom, 120);
    });

    function scrollToSection(id) {
        const wrapper = $('#pdf-pages-wrapper');
        if (!wrapper) return;
        const target = wrapper.querySelector('[data-sec-id="' + id + '"]');
        if (!target) return;
        const scroller = $('#preview-scroll');
        const pageEl = target.closest('.pdf-a4-page');
        if (scroller && pageEl) {
            /* viewport-space delta scroll — immune to zoom/transform math */
            const top = pageEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
            scroller.scrollTop += top - 24;
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

        /* zoom buttons (in/out step from the currently applied zoom) */
        const zin = $('#zoom-in-btn'), zout = $('#zoom-out-btn'), zfit = $('#zoom-fit-btn');
        if (zin) zin.addEventListener('click', function () { setZoom(getZoom() + 0.1); });
        if (zout) zout.addEventListener('click', function () { setZoom(getZoom() - 0.1); });
        if (zfit) zfit.addEventListener('click', setFit);
        const label = $('#zoom-level');
        if (label) label.textContent = Math.round(getZoom() * 100) + '%';
    }

    return { compile: compile, setZoom: setZoom, setFit: setFit, refit: applyZoom, scrollToSection: scrollToSection, initControls: initControls };
})();
