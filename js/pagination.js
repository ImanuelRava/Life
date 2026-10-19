/* ============================================================
   pagination.js — distributes the rendered block flow into
   A4 pages (.pdf-a4-page), honoring explicit .page-break
   markers and page-layout settings, then fills TOC page
   numbers measured from the real pages.
   ============================================================ */
window.App = window.App || {};

App.pagination = (function () {
    const MM2PX = 96 / 25.4;

    /* Page Layout tab presets: CSS padding strings for .pdf-a4-page */
    const MARGINS = {
        default:  '28mm 24mm',
        narrow:   '18mm 16mm',
        moderate: '22mm 20mm',
        wide:     '34mm 30mm'
    };

    function padOf(layout) {
        return MARGINS[layout.margins] || MARGINS.default;
    }

    function padParts(pad) {
        const p = pad.split(/\s+/);
        return { y: parseFloat(p[0]) || 0, x: parseFloat(p[1] || p[0]) || 0 };
    }

    function applyContentStyles(el, layout) {
        el.style.fontSize = layout.fontSize || '11pt';
        el.style.lineHeight = layout.spacing || '1.5';
        if (String(layout.columns) === '2') {
            el.style.columnCount = '2';
            el.style.columnGap = '8mm';
        } else {
            el.style.columnCount = '1';
        }
    }

    function makePage(pad) {
        const page = document.createElement('div');
        page.className = 'pdf-a4-page';
        page.style.padding = pad;
        return page;
    }

    function makeContent(layout) {
        const c = document.createElement('div');
        c.className = 'latex-document';
        applyContentStyles(c, layout);
        return c;
    }

    /* Fill every TOC page-number cell from the real page positions */
    function fillTocPageNumbers(rootEl) {
        const pages = Array.prototype.slice.call(rootEl.querySelectorAll('.pdf-a4-page'));
        const refs = rootEl.querySelectorAll('[data-sec-ref]');
        Array.prototype.forEach.call(refs, function (span) {
            const target = rootEl.querySelector('[data-sec-id="' + span.getAttribute('data-sec-ref') + '"]');
            if (!target) { span.textContent = ''; return; }
            const pageEl = target.closest ? target.closest('.pdf-a4-page') : null;
            if (!pageEl) { span.textContent = ''; return; }
            const idx = pages.indexOf(pageEl);
            span.textContent = idx >= 0 ? String(idx + 1) : '';
        });
    }

    /* html: rendered flow HTML; layout: App.storage settings; pageNumbers: bool */
    function paginate(html, layout, pageNumbers) {
        const pad = padOf(layout);
        const parts = padParts(pad);
        const usableY = (297 - parts.y * 2) * MM2PX;   /* page inner height in px */

        /* hidden measuring host sized exactly like a real page */
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;top:0;left:-10000px;visibility:hidden;z-index:-1;width:auto;';
        document.body.appendChild(host);

        const proto = makePage(pad);
        host.appendChild(proto);
        const flow = makeContent(layout);
        proto.appendChild(flow);
        flow.innerHTML = html;

        /* queue of top-level element blocks (skip whitespace text nodes) */
        const queue = [];
        Array.prototype.forEach.call(flow.childNodes, function (n) {
            if (n.nodeType === 1) queue.push(n);
        });
        flow.innerHTML = '';

        const built = [];
        let curPage = makePage(pad);
        let curContent = makeContent(layout);
        curContent.style.height = usableY + 'px';
        curContent.style.overflow = 'hidden';
        curPage.appendChild(curContent);

        function closePage() {
            if (curContent.childNodes.length) {
                built.push(curPage);
            }
            curPage = makePage(pad);
            curContent = makeContent(layout);
            curContent.style.height = usableY + 'px';
            curContent.style.overflow = 'hidden';
            curPage.appendChild(curContent);
        }

        while (queue.length) {
            const block = queue.shift();

            /* explicit page break marker → close current page */
            if (block.classList && block.classList.contains('page-break')) {
                closePage();
                continue;
            }

            curContent.appendChild(block);
            const overflows = curContent.scrollHeight > usableY + 1;
            if (overflows && curContent.children.length > 1) {
                /* move overflowing block to the next page */
                curContent.removeChild(block);
                queue.unshift(block);
                closePage();
            }
            /* single oversized block: keep it (clipped) */
        }
        closePage();
        host.parentNode.removeChild(host);

        /* assemble final pages */
        const frag = document.createDocumentFragment();
        built.forEach(function (page, idx) {
            const content = page.querySelector('.latex-document');
            if (content) {
                content.style.height = 'auto';
                content.style.minHeight = usableY + 'px';
                content.style.overflow = 'visible';
            }
            if (pageNumbers !== false) {
                const num = document.createElement('div');
                num.className = 'latex-page-number';
                num.textContent = String(idx + 1);
                page.appendChild(num);
            }
            frag.appendChild(page);
        });

        const container = document.createElement('div');
        container.appendChild(frag);
        fillTocPageNumbers(container);
        return container;
    }

    return { paginate: paginate, MARGINS: MARGINS };
})();
