/* ============================================================
   export.js — .tex download, source copy, .tex import, and
   PDF export through a hidden print iframe (the main window
   is intentionally blanked for printing — see base.css).
   ============================================================ */
window.App = window.App || {};

App.exporter = (function () {
    const $ = App.utils.$;

    /* Condensed print stylesheet for the export iframe: A4 pages with
       page-break-after so each preview page maps to one PDF page. */
    const PRINT_CSS = [
        '@page { size: A4; margin: 0; }',
        'html, body { margin: 0; padding: 0; background: #fff; }',
        '@font-face { font-family:"Latin Modern"; font-style:normal; font-weight:400; font-display:swap;',
        '  src:url("https://cdn.jsdelivr.net/npm/latex.css@1.14.0/fonts/LM-regular.woff2") format("woff2"); }',
        '@font-face { font-family:"Latin Modern"; font-style:italic; font-weight:400; font-display:swap;',
        '  src:url("https://cdn.jsdelivr.net/npm/latex.css@1.14.0/fonts/LM-italic.woff2") format("woff2"); }',
        '@font-face { font-family:"Latin Modern"; font-style:normal; font-weight:700; font-display:swap;',
        '  src:url("https://cdn.jsdelivr.net/npm/latex.css@1.14.0/fonts/LM-bold.woff2") format("woff2"); }',
        '.pdf-a4-page { width:210mm; min-height:297mm; padding:28mm 24mm; box-sizing:border-box;',
        '  position:relative; background:#fff; color:#000; page-break-after:always;',
        '  word-wrap:break-word; overflow-wrap:break-word; }',
        '.pdf-a4-page:last-child { page-break-after:auto; }',
        '.latex-document { font-family:"Latin Modern",Georgia,serif; font-size:11pt; line-height:1.5;',
        '  color:#000; text-align:justify; hyphens:auto; -webkit-hyphens:auto; }',
        '.latex-document p { margin:0 0 0.6em 0; text-indent:1.2em; }',
        '.latex-document p:first-child, .latex-document p:first-of-type { text-indent:0; }',
        '.latex-document p.latex-paragraph { text-indent:0; font-weight:700; margin:1em 0 0.4em 0; }',
        '.latex-document .latex-title-block { text-align:center; margin:0 0 2em 0; }',
        '.latex-document .latex-title-block h1 { font-size:1.6em; font-weight:700; line-height:1.2; margin:0 0 0.4em 0; text-align:center; }',
        '.latex-document .latex-author, .latex-document .latex-date { text-align:center; text-indent:0; margin:0.15em 0; }',
        '.latex-document h2 { font-size:1.3em; font-weight:700; line-height:1.3; margin:1.4em 0 0.6em 0; }',
        '.latex-document h3 { font-size:1.1em; font-weight:700; margin:1.2em 0 0.5em 0; }',
        '.latex-document h4 { font-size:1em; font-weight:700; margin:1em 0 0.4em 0; }',
        '.latex-document ul.latex-itemize, .latex-document ol.latex-enumerate { margin:0.4em 0 0.7em 0; padding-left:2em; }',
        '.latex-document .latex-itemize li p, .latex-document .latex-enumerate li p { margin:0 0 0.15em 0; }',
        '.latex-document table.latex-tabular { border-collapse:collapse; margin:0.8em auto; }',
        '.latex-document table.latex-tabular td, .latex-document table.latex-tabular th { padding:0.35em 0.8em; text-align:center; border:none; }',
        '.latex-document table.latex-tabular td.align-l, .latex-document table.latex-tabular th.align-l { text-align:left; }',
        '.latex-document table.latex-tabular td.align-r, .latex-document table.latex-tabular th.align-r { text-align:right; }',
        '.latex-document table.latex-tabular tr.hline td { border-top:0.8px solid #000; padding:0; height:0; line-height:0; }',
        '.latex-document table.latex-tabular tr.toprule td { border-top:1.5px solid #000; }',
        '.latex-document table.latex-tabular tr.midrule td { border-top:1px solid #000; }',
        '.latex-document table.latex-tabular tr.bottomrule td { border-bottom:1.5px solid #000; }',
        '.latex-document td.cline-top, .latex-document th.cline-top { border-top:0.8px solid #000; }',
        '.latex-document td.bar-left, .latex-document th.bar-left { border-left:0.8px solid #000; }',
        '.latex-document td.bar-right, .latex-document th.bar-right { border-right:0.8px solid #000; }',
        '.latex-document .latex-table-caption { text-align:center; font-size:0.9em; margin:0.3em 0 1em 0; text-indent:0; }',
        '.latex-document .latex-table-caption-label { font-weight:700; }',
        '.latex-document .latex-abstract { margin:1.5em auto; text-align:justify; }',
        '.latex-document .latex-abstract-title { font-size:0.9em; font-weight:700; text-align:center; margin-bottom:0.5em; text-indent:0; }',
        '.latex-document .latex-abstract-body { font-size:0.92em; line-height:1.4; text-indent:1.2em; font-style:italic; }',
        '.latex-document .latex-displaymath { display:flex; justify-content:center; align-items:center; margin:0.8em 0; overflow:hidden; padding:4px 0; }',
        '.latex-document .latex-displaymath .katex-display { margin:0; }',
        '.latex-document .katex { font-size:1.05em; }',
        '.latex-env { margin:0.8em 0; break-inside:avoid; }',
        '.latex-env-name { font-weight:700; font-style:normal; }',
        '.latex-env-opt { font-weight:400; font-style:normal; }',
        '.latex-theorem, .latex-lemma, .latex-corollary, .latex-proposition { font-style:italic; }',
        '.latex-theorem .latex-env-name, .latex-lemma .latex-env-name, .latex-corollary .latex-env-name, .latex-proposition .latex-env-name { font-style:normal; }',
        '.latex-definition, .latex-example, .latex-note, .latex-remark, .latex-axiom { font-style:normal; }',
        '.latex-proof { font-style:normal; }',
        '.latex-proof .latex-env-name { font-style:italic; }',
        '.latex-proof .latex-qed { margin-left:0.3em; }',
        '.latex-env .katex { font-style:normal; }',
        '.latex-page-number { position:absolute; bottom:8mm; left:0; right:0; text-align:center; font-size:10pt; text-indent:0; }',
        '.latex-document .sec-num { }',
        '.latex-document .latex-toc { margin:1.2em 0 1.6em 0; break-inside:avoid; }',
        '.latex-document .latex-toc-title { text-align:center; font-weight:700; font-size:1.15em; margin-bottom:0.9em; text-indent:0; }',
        '.latex-document .latex-toc-row { display:flex; align-items:baseline; margin:0.28em 0; text-indent:0; }',
        '.latex-document .latex-toc-row.lvl2 { padding-left:1.6em; }',
        '.latex-document .latex-toc-row.lvl3 { padding-left:3.2em; font-size:0.95em; }',
        '.latex-document .latex-toc-label { white-space:nowrap; }',
        '.latex-document .latex-toc-label .toc-num { margin-right:0.6em; }',
        '.latex-document .latex-toc-dots { flex:1; border-bottom:1px dotted #444; margin:0 0.45em; transform:translateY(-3px); min-width:1.5em; }',
        '.latex-document .latex-toc-page { min-width:1.2em; text-align:right; }',
        '.latex-document .latex-equation { display:flex; align-items:center; margin:0.8em 0; text-indent:0; }',
        '.latex-document .latex-equation .latex-eq-math { flex:1; display:flex; justify-content:center; overflow:hidden; padding:4px 0; }',
        '.latex-document .latex-equation .latex-eq-num { padding-left:0.8em; white-space:nowrap; }',
        '.latex-document .latex-fn-ref { font-size:0.72em; vertical-align:super; line-height:0; }',
        '.latex-document .latex-footnotes { margin-top:1.4em; padding-top:0.45em; border-top:0.8px solid #000; font-size:0.82em; line-height:1.35; text-indent:0; }',
        '.latex-document .latex-footnotes .fn-item { margin:0.12em 0; text-indent:0; text-align:left; }',
        '.latex-document .latex-footnotes .fn-num { font-size:0.8em; vertical-align:super; margin-right:0.2em; }',
        '.latex-document .latex-figure { margin:1em auto; text-align:center; text-indent:0; break-inside:avoid; }',
        '.latex-document .latex-img { max-width:100%; height:auto; display:block; margin:0 auto; }',
        '.latex-document a.latex-link { color:#1a0dab; text-decoration:underline; }',
        '.latex-document .latex-verbatim { font-size:0.85em; background:#f6f8fa; border:0.8px solid #d0d7de;',
        '  border-radius:4px; padding:0.7em 1em; margin:0.8em 0; white-space:pre-wrap; word-break:break-word; text-align:left; text-indent:0; }',
        '.latex-document .latex-quote { margin:0.8em 2.5em; text-indent:0; }',
        '.latex-document .latex-center { text-align:center; text-indent:0; }',
        '.latex-document .latex-center p { text-indent:0; }',
        '.latex-document .latex-flushleft { text-align:left; text-indent:0; }',
        '.latex-document .latex-flushright { text-align:right; text-indent:0; }',
        '.latex-document .latex-sout { text-decoration:line-through; }',
        '.latex-document .latex-hl { background:#fef08a; padding:0 2px; }',
        '.latex-document .latex-hrulefill { display:inline-block; width:100%; border-top:0.8px solid #000; height:0; }',
        '.latex-document .latex-bibitem { margin:0.3em 0; padding-left:2em; text-indent:-2em; text-align:left; }',
        '.latex-document .latex-bibitem-marker { margin-right:0.5em; }',
        '.page-break { display:none; }'
    ].join('\n');

    function downloadTex() {
        const doc = App.storage.getActive();
        if (!doc) return;
        const blob = new Blob([App.editor.getValue()], { type: 'application/x-tex' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = doc.name || 'document.tex';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
        App.utils.toast('Source downloaded');
    }

    function copySource() {
        const text = App.editor.getValue();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
                function () { App.utils.toast('LaTeX source copied'); },
                function () { App.utils.toast('Copy failed — clipboard blocked'); }
            );
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); App.utils.toast('LaTeX source copied'); }
            catch (e) { App.utils.toast('Copy failed'); }
            ta.remove();
        }
    }

    function importTex() {
        const input = $('#tex-file-input');
        if (input) input.click();
    }

    function onTexFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            const doc = App.storage.createDoc(file.name, String(reader.result));
            if (App.main) App.main.switchDoc(doc.id, true);
            App.utils.toast('Imported ' + file.name);
        };
        reader.readAsText(file);
    }

    /* Export PDF via hidden iframe (main window print is blanked by design) */
    function exportPDF() {
        const wrapper = $('#pdf-pages-wrapper');
        if (!wrapper || !wrapper.children.length) {
            App.utils.toast('Nothing to export — compile first');
            return;
        }
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';
        document.body.appendChild(iframe);

        const pagesHtml = wrapper.innerHTML;
        const docHtml = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">' +
            '<style>' + PRINT_CSS + '</style>' +
            '</head><body>' + pagesHtml + '</body></html>';

        const idoc = iframe.contentDocument;
        idoc.open();
        idoc.write(docHtml);
        idoc.close();

        const print = function () {
            setTimeout(function () {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    console.error('[export] print failed:', e);
                }
                setTimeout(function () { iframe.remove(); }, 2000);
            }, 600); /* let webfonts & KaTeX CSS settle */
        };
        if (iframe.contentWindow && iframe.contentWindow.document.fonts &&
            iframe.contentWindow.document.fonts.ready) {
            iframe.contentWindow.document.fonts.ready.then(print);
        } else {
            print();
        }
    }

    function init() {
        const texBtn = $('#download-tex-btn');
        if (texBtn) texBtn.addEventListener('click', downloadTex);
        const pdfBtn = $('#download-pdf-btn');
        if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);
        const copyBtn = $('#header-copy-btn');
        if (copyBtn) copyBtn.addEventListener('click', copySource);
        const importBtn = $('#header-import-btn');
        if (importBtn) importBtn.addEventListener('click', importTex);
        const texInput = $('#tex-file-input');
        if (texInput) {
            texInput.addEventListener('change', function () {
                if (texInput.files && texInput.files[0]) onTexFile(texInput.files[0]);
                texInput.value = '';
            });
        }
    }

    return { init: init, downloadTex: downloadTex, copySource: copySource, exportPDF: exportPDF, importTex: importTex };
})();
