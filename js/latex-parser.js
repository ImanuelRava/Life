/* ============================================================
   latex-parser.js — block-level LaTeX → HTML:
   preamble (\title/\author/\date), sections with auto-numbering,
   environments (lists, tabular/booktabs, amsthm, figure, table,
   equation, align, bibliography), \maketitle, TOC, page breaks.
   ============================================================ */
window.App = window.App || {};

App.parser = (function () {
    const esc = App.utils.esc;
    const inline = App.inline;

    /* amsthm-style registry: italic body = theorem-like, upright = definition-like */
    const THEOREM_ENVS = {
        theorem:     { title: 'Theorem',     italic: true },
        lemma:       { title: 'Lemma',       italic: true },
        corollary:   { title: 'Corollary',   italic: true },
        proposition: { title: 'Proposition', italic: true },
        definition:  { title: 'Definition',  italic: false },
        example:     { title: 'Example',     italic: false },
        remark:      { title: 'Remark',      italic: false },
        note:        { title: 'Note',        italic: false },
        axiom:       { title: 'Axiom',       italic: false }
    };

    /* Math-only environments passed straight to KaTeX */
    const MATH_PASSTHROUGH = ['pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
        'matrix', 'cases', 'aligned', 'gathered', 'split', 'array', 'smallmatrix'];

    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function stripComments(src) {
        return src.replace(/(^|[^\\])%[^\n]*/g, '$1');
    }

    function extractArg(text, cmd) {
        const re = new RegExp('\\\\' + cmd + '\\b\\s*');
        const m = re.exec(text);
        if (!m) return '';
        const at = m.index + m[0].length;
        if (text[at] === '{') {
            const g = inline.readGroup(text, at);
            if (g) return g.content;
        }
        return '';
    }

    /* Extract \begin{name}[opt]{arg}...\end{name} starting at i (position of '\') */
    function extractEnv(s, i, name) {
        const openTag = '\\begin{' + name + '}';
        let j = i + openTag.length;
        let opt = null, arg = null;
        j = inline.skipSpaces(s, j);
        if (s[j] === '[') { const o = inline.readOpt(s, j); if (o) { opt = o.content; j = o.end; } }
        j = inline.skipSpaces(s, j);
        if (s[j] === '{') { const g = inline.readGroup(s, j); if (g) { arg = g.content; j = g.end; } }

        const endTag = '\\end{' + name + '}';
        let depth = 1, k = j;
        while (k < s.length) {
            const e = s.indexOf(endTag, k);
            if (e === -1) break;
            const b = s.indexOf(openTag, k);
            if (b !== -1 && b < e) { depth++; k = b + openTag.length; }
            else {
                depth--;
                if (depth === 0) return { name: name, opt: opt, arg: arg, content: s.slice(j, e), end: e + endTag.length };
                k = e + endTag.length;
            }
        }
        return { name: name, opt: opt, arg: arg, content: s.slice(j), end: s.length };
    }

    /* Find where the current paragraph must stop */
    function findBlockBoundary(s, from) {
        const rest = s.slice(from);
        const pats = [
            /\n\s*\n/,
            /\n\\begin\{/,
            /\n\\(?:section|subsection|subsubsection|paragraph|maketitle|tableofcontents|newpage|noindent|centering|bigskip|medskip|smallskip)\b/,
            /\n\$\$/,
            /\n\\\[/,
            /\n\\(?:item|bibitem)\b/
        ];
        let min = rest.length;
        for (let p = 0; p < pats.length; p++) {
            const m = pats[p].exec(rest);
            if (m && m.index < min) min = m.index;
        }
        return from + min;
    }

    /* ============================ headings ============================ */

    function renderHeading(cmd, starred, rawTitle, ctx) {
        const titleHtml = inline.format(rawTitle.trim(), ctx);
        if (cmd === 'paragraph') {
            return '<p class="latex-paragraph">' + titleHtml + '</p>';
        }
        const plain = rawTitle.trim()
            .replace(/\\[a-zA-Z]+\s*/g, '')
            .replace(/[{}$]/g, '')
            .trim();

        if (starred) {
            const tag = cmd === 'section' ? 'h2' : cmd === 'subsection' ? 'h3' : 'h4';
            return '<' + tag + '>' + titleHtml + '</' + tag + '>';
        }

        let id, number, level, tag;
        if (cmd === 'section') {
            ctx.sec.n++; ctx.sec.s = 0; ctx.sec.ss = 0;
            id = 'sec-' + ctx.sec.n; number = ctx.sec.n + '.'; level = 1; tag = 'h2';
        } else if (cmd === 'subsection') {
            ctx.sec.s++; ctx.sec.ss = 0;
            id = 'sec-' + ctx.sec.n + '-' + ctx.sec.s; number = ctx.sec.n + '.' + ctx.sec.s + '.'; level = 2; tag = 'h3';
        } else {
            ctx.sec.ss++;
            id = 'sec-' + ctx.sec.n + '-' + ctx.sec.s + '-' + ctx.sec.ss;
            number = ctx.sec.n + '.' + ctx.sec.s + '.' + ctx.sec.ss + '.'; level = 3; tag = 'h4';
        }
        ctx.sections.push({ id: id, number: number, title: plain, level: level });
        return '<' + tag + ' data-sec-id="' + id + '"><span class="sec-num">' + esc(number) + '</span> ' + titleHtml + '</' + tag + '>';
    }

    /* ============================ standalone commands ============================ */

    function renderStandalone(cmd, meta, ctx) {
        switch (cmd) {
            case 'maketitle': return titleBlock(meta, ctx);
            case 'tableofcontents':
                return '<div class="latex-toc"><div class="latex-toc-title">Table of Contents</div><div data-toc-rows></div></div>';
            case 'newpage': return '<div class="page-break"></div>';
            case 'bigskip': return '<div style="height:1.2em"></div>';
            case 'medskip': return '<div style="height:0.8em"></div>';
            case 'smallskip': return '<div style="height:0.4em"></div>';
            default: return '';
        }
    }

    function titleBlock(meta, ctx) {
        if (!meta.title) return '';
        let h = '<div class="latex-title-block"><h1>' + inline.format(meta.title, ctx) + '</h1>';
        if (meta.author) h += '<div class="latex-author">' + inline.format(meta.author, ctx) + '</div>';
        if (meta.date) h += '<div class="latex-date">' + inline.format(meta.date, ctx) + '</div>';
        return h + '</div>';
    }

    /* ============================ environments ============================ */

    function renderEnv(env, ctx, meta) {
        const name = env.name;
        const content = env.content;

        switch (name) {
            case 'document':
                return parseBlocks(content, ctx, meta);

            case 'abstract':
                return '<div class="latex-abstract"><div class="latex-abstract-title">Abstract</div><div class="latex-abstract-body">' +
                    parseBlocks(content, ctx, meta) + '</div></div>';

            case 'quote': case 'quotation':
                return '<div class="latex-quote">' + parseBlocks(content, ctx, meta) + '</div>';

            case 'center':
                return '<div class="latex-center">' + parseBlocks(content, ctx, meta) + '</div>';

            case 'flushleft':
                return '<div class="latex-flushleft">' + parseBlocks(content, ctx, meta) + '</div>';

            case 'flushright':
                return '<div class="latex-flushright">' + parseBlocks(content, ctx, meta) + '</div>';

            case 'verbatim': case 'lstlisting':
                return '<div class="latex-verbatim">' + esc(content.replace(/^\n/, '')) + '</div>';

            case 'itemize': case 'enumerate': {
                const items = parseItems(content);
                const tag = name === 'itemize' ? 'ul' : 'ol';
                const cls = name === 'itemize' ? 'latex-itemize' : 'latex-enumerate';
                const lis = items.map(function (it) {
                    return '<li>' + parseBlocks(it, ctx, meta) + '</li>';
                }).join('');
                return '<' + tag + ' class="' + cls + '">' + lis + '</' + tag + '>';
            }

            case 'equation': {
                ctx.eqCount++;
                return '<div class="latex-equation"><div class="latex-eq-math">' + inline.math(content, true) +
                    '</div><div class="latex-eq-num">(' + ctx.eqCount + ')</div></div>';
            }

            case 'equation*': case 'displaymath':
                return '<div class="latex-displaymath">' + inline.math(content, true) + '</div>';

            case 'align': case 'align*': case 'gather': case 'gather*':
            case 'multline': case 'multline*': case 'eqnarray': case 'eqnarray*': {
                const inner = '\\begin{aligned}' + content + '\\end{aligned}';
                return '<div class="latex-displaymath">' + inline.math(inner, true) + '</div>';
            }

            case 'proof':
                return '<div class="latex-env latex-proof"><span class="latex-env-name">Proof.</span> ' +
                    parseBlocks(content, ctx, meta) + ' <span class="latex-qed">\u25A1</span></div>';

            case 'figure': case 'figure*':
                return renderFigure(env, ctx);

            case 'table': case 'table*':
                return renderTable(env, ctx, meta);

            case 'tabular': case 'tabular*': case 'longtable':
                return renderTabular(content, ctx);

            case 'thebibliography':
                return renderBibliography(content, ctx);

            default: {
                if (THEOREM_ENVS[name] || ctx.newtheorems[name]) return renderTheoremEnv(env, ctx, meta);
                if (MATH_PASSTHROUGH.indexOf(name) !== -1) {
                    return '<div class="latex-displaymath">' + inline.math('\\begin{' + name + '}' + content + '\\end{' + name + '}', true) + '</div>';
                }
                /* unknown environment: render its content */
                return parseBlocks(content, ctx, meta);
            }
        }
    }

    function parseItems(content) {
        const parts = content.split(/(?:^|\n)\s*\\item\b/);
        const items = parts.slice(1).map(function (p) { return p.trim(); }).filter(Boolean);
        return items.length ? items : [content.trim()];
    }

    function renderTheoremEnv(env, ctx, meta) {
        const def = THEOREM_ENVS[env.name] || ctx.newtheorems[env.name] || { title: env.name };
        ctx.envCount[env.name] = (ctx.envCount[env.name] || 0) + 1;
        let head = '<span class="latex-env-name">' + esc(def.title) + ' ' + ctx.envCount[env.name] + '</span>';
        if (env.opt) head += ' <span class="latex-env-opt">(' + inline.format(env.opt, ctx) + ')</span>';
        head += '.';
        return '<div class="latex-env latex-' + esc(env.name) + '">' + head + ' ' +
            parseBlocks(env.content, ctx, meta) + '</div>';
    }

    function renderFigure(env, ctx) {
        const s = env.content;
        let imgHtml = '';
        const im = /\\includegraphics\b/.exec(s);
        if (im) {
            let j = inline.skipSpaces(s, im.index + im[0].length);
            const opt = inline.readOpt(s, j);
            if (opt) j = opt.end;
            j = inline.skipSpaces(s, j);
            const g = inline.readGroup(s, j);
            if (g) imgHtml = inline.includegraphics(g.content, ctx);
        }
        let caption = '';
        const cm = /\\caption\b/.exec(s);
        if (cm) {
            const g = inline.readGroup(s, inline.skipSpaces(s, cm.index + cm[0].length));
            if (g) caption = g.content;
        }
        ctx.figCount++;
        let h = '<div class="latex-figure">' + imgHtml;
        if (caption) {
            h += '<div class="latex-table-caption"><span class="latex-table-caption-label">Figure ' + ctx.figCount + ':</span> ' +
                inline.format(caption, ctx) + '</div>';
        }
        return h + '</div>';
    }

    function renderTable(env, ctx, meta) {
        const s = env.content;
        let caption = '';
        const cm = /\\caption\b/.exec(s);
        if (cm) {
            const g = inline.readGroup(s, inline.skipSpaces(s, cm.index + cm[0].length));
            if (g) caption = g.content;
        }
        const tm = /\\begin\{(tabular\*?|longtable)\}/.exec(s);
        let tableHtml = '';
        if (tm) {
            const sub = extractEnv(s, tm.index, tm[1]);
            tableHtml = renderTabular(sub.content, ctx);
        } else {
            tableHtml = parseBlocks(s, ctx, meta);
        }
        ctx.tabCount++;
        let h = '<div style="text-align:center">' + tableHtml;
        if (caption) {
            h += '<div class="latex-table-caption"><span class="latex-table-caption-label">Table ' + ctx.tabCount + ':</span> ' +
                inline.format(caption, ctx) + '</div>';
        }
        return h + '</div>';
    }

    /* ---- tabular with colspec, \hline, \cline, booktabs rules ---- */
    function renderTabular(content, ctx) {
        const cm = content.match(/^\s*\{([^}]*)\}/);
        const spec = cm ? cm[1] : '';
        const body = cm ? content.slice(cm[0].length) : content;

        /* column spec: l | c | r with bars */
        const cols = [];
        let pendingBar = false;
        for (let i = 0; i < spec.length; i++) {
            const ch = spec[i];
            if (ch === '|') { pendingBar = true; continue; }
            if (ch === 'l' || ch === 'c' || ch === 'r') {
                cols.push({ align: ch, barLeft: pendingBar, barRight: false });
                pendingBar = false;
            }
        }
        if (pendingBar && cols.length) cols[cols.length - 1].barRight = true;
        if (!cols.length) cols.push({ align: 'c', barLeft: false, barRight: false });

        const nCols = cols.length;
        const ruleRow = function (cls) {
            return '<tr class="hline ' + cls + '"><td colspan="' + nCols + '"></td></tr>';
        };

        let html = '<table class="latex-tabular"><tbody>';
        const rows = body.split(/\\\\/);

        rows.forEach(function (raw) {
            let chunk = raw;
            let pendingCline = null;

            /* leading rules on this chunk */
            for (;;) {
                chunk = chunk.replace(/^\s+/, '');
                let m = chunk.match(/^\\(hline|toprule|midrule|bottomrule)\b/);
                if (m) {
                    html += ruleRow(m[1]);
                    chunk = chunk.slice(m[0].length);
                    continue;
                }
                m = chunk.match(/^\\cline\{(\d+)-(\d+)\}/);
                if (m) {
                    pendingCline = [parseInt(m[1], 10), parseInt(m[2], 10)];
                    chunk = chunk.slice(m[0].length);
                    continue;
                }
                break;
            }
            chunk = chunk.replace(/^\n/, '');
            if (!chunk.trim()) return;

            /* protect escaped & then split cells */
            const protectedChunk = chunk.replace(/\\&/g, '\u0001');
            const cells = protectedChunk.split('&');

            let tds = '';
            for (let c = 0; c < nCols; c++) {
                const cellRaw = c < cells.length ? cells[c] : '';
                const col = cols[c];
                const cls = [];
                if (col.align === 'l') cls.push('align-l');
                if (col.align === 'r') cls.push('align-r');
                if (col.barLeft) cls.push('bar-left');
                if (col.barRight) cls.push('bar-right');
                if (pendingCline && c >= pendingCline[0] - 1 && c <= pendingCline[1] - 1) cls.push('cline-top');
                const cellHtml = inline.format(cellRaw.replace(/\u0001/g, '\\&').trim(), ctx);
                tds += '<td class="' + cls.join(' ') + '">' + cellHtml + '</td>';
            }
            html += '<tr>' + tds + '</tr>';
        });

        return html + '</tbody></table>';
    }

    /* ---- thebibliography / \bibitem ---- */
    function renderBibliography(content, ctx) {
        const items = [];
        const re = /\\bibitem\b/g;
        let m;
        const positions = [];
        while ((m = re.exec(content)) !== null) positions.push(m.index);
        for (let p = 0; p < positions.length; p++) {
            const start = positions[p];
            const end = p + 1 < positions.length ? positions[p + 1] : content.length;
            let seg = content.slice(start, end);
            seg = seg.replace(/^\\bibitem\b/, '');
            seg = seg.replace(/^\s*\[[^\]]*\]/, ''); // optional [label]
            seg = seg.replace(/^\s*/, '');
            let key = 'bib-' + (p + 1);
            if (seg[0] === '{') {
                const g = inline.readGroup(seg, 0);
                if (g) { key = g.content.trim(); seg = seg.slice(g.end); }
            }
            ctx.bib[key] = p + 1;
            items.push(inline.format(seg, ctx));
        }
        let h = '<h2>References</h2>';
        items.forEach(function (txt, i) {
            h += '<div class="latex-bibitem"><span class="latex-bibitem-marker">[' + (i + 1) + ']</span> ' + txt + '</div>';
        });
        return h;
    }

    /* ============================ TOC fill ============================ */

    function fillToc(html, sections) {
        if (html.indexOf('data-toc-rows') === -1) return html;
        const numbered = sections.filter(function (s) { return s.number; });
        const rows = numbered.map(function (s) {
            const lvl = s.level === 2 ? ' lvl2' : s.level === 3 ? ' lvl3' : '';
            return '<div class="latex-toc-row' + lvl + '"><span class="latex-toc-label"><span class="toc-num">' +
                esc(s.number) + '</span>' + esc(s.title) + '</span><span class="latex-toc-dots"></span>' +
                '<span class="latex-toc-page" data-sec-ref="' + s.id + '"></span></div>';
        }).join('');
        const fill = rows || '<div class="latex-toc-row"><span class="latex-toc-label">(no numbered sections)</span></div>';
        return html.replace('<div data-toc-rows></div>', fill);
    }

    /* ============================ main entry ============================ */

    function parse(source, doc) {
        const ctx = {
            footnotes: [],
            bib: {},
            images: (doc && doc.images) || {},
            sections: [],
            newtheorems: {},
            envCount: {},
            eqCount: 0,
            figCount: 0,
            tabCount: 0,
            sec: { n: 0, s: 0, ss: 0 }
        };

        let src = String(source || '').replace(/\r\n?/g, '\n');
        src = stripComments(src);

        const beginIdx = src.indexOf('\\begin{document}');
        const endIdx = beginIdx >= 0 ? src.lastIndexOf('\\end{document}') : -1;
        const preamble = beginIdx >= 0 ? src.slice(0, beginIdx) : '';
        const body = beginIdx >= 0
            ? src.slice(beginIdx + '\\begin{document}'.length, endIdx >= 0 ? endIdx : src.length)
            : src;

        /* \newtheorem{foo}{Foo} support */
        const ntre = /\\newtheorem\s*\{([a-zA-Z*]+)\}\s*\{([^}]*)\}/g;
        let nm;
        while ((nm = ntre.exec(preamble)) !== null) {
            ctx.newtheorems[nm[1]] = { title: nm[2], italic: true };
        }

        const meta = {
            title: extractArg(preamble, 'title'),
            author: extractArg(preamble, 'author'),
            date: extractArg(preamble, 'date')
        };

        let html = parseBlocks(body, ctx, meta);
        html = fillToc(html, ctx.sections);

        if (ctx.footnotes.length) {
            html += '<div class="latex-footnotes">' + ctx.footnotes.map(function (t, i) {
                return '<div class="fn-item"><span class="fn-num">' + (i + 1) + '</span> ' + t + '</div>';
            }).join('') + '</div>';
        }

        return { html: html, sections: ctx.sections };
    }

    function parseBlocks(text, ctx, meta) {
        let out = '', i = 0;
        const s = String(text == null ? '' : text);

        while (i < s.length) {
            /* blank lines */
            const blank = /^\s*\n/.exec(s.slice(i));
            if (blank) { i += blank[0].length; continue; }

            const rest = s.slice(i);

            /* $$ display math block */
            if (rest.indexOf('$$') === 0) {
                const close = s.indexOf('$$', i + 2);
                const tex = close === -1 ? s.slice(i + 2) : s.slice(i + 2, close);
                out += '<div class="latex-displaymath">' + inline.math(tex, true) + '</div>';
                i = close === -1 ? s.length : close + 2;
                continue;
            }
            /* \[ display math block */
            if (rest.indexOf('\\[') === 0) {
                const close = s.indexOf('\\]', i + 2);
                const tex = close === -1 ? s.slice(i + 2) : s.slice(i + 2, close);
                out += '<div class="latex-displaymath">' + inline.math(tex, true) + '</div>';
                i = close === -1 ? s.length : close + 2;
                continue;
            }

            /* \begin{...} environment */
            let m = rest.match(/^\\begin\{([a-zA-Z*]+)\}/);
            if (m) {
                const env = extractEnv(s, i, m[1]);
                out += renderEnv(env, ctx, meta);
                i = env.end;
                continue;
            }

            /* sectioning */
            m = rest.match(/^\\(section|subsection|subsubsection|paragraph)(\*?)\s*(?=\{)/);
            if (m) {
                const g = inline.readGroup(s, inline.skipSpaces(s, i + m[0].length));
                if (g) {
                    out += renderHeading(m[1], m[2] === '*', g.content, ctx);
                    i = g.end;
                    continue;
                }
            }

            /* standalone commands */
            m = rest.match(/^\\(maketitle|tableofcontents|newpage|noindent|centering|par|bigskip|medskip|smallskip)\b/);
            if (m) {
                out += renderStandalone(m[1], meta, ctx);
                i += m[0].length;
                continue;
            }

            /* paragraph */
            const next = findBlockBoundary(s, i);
            const chunk = s.slice(i, next).trim();
            i = next;
            if (chunk) out += '<p>' + inline.format(chunk, ctx) + '</p>';
        }
        return out;
    }

    return { parse: parse };
})();
