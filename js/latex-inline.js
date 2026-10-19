/* ============================================================
   latex-inline.js — inline-level LaTeX → HTML formatting:
   text decorations, math (KaTeX), links, footnotes, citations,
   images, special characters and ligatures.
   ============================================================ */
window.App = window.App || {};

App.inline = (function () {
    const esc = App.utils.esc;

    /* Named colors — matches the ribbon color dots */
    const COLOR_MAP = {
        red: '#d63031', orange: '#e67e22', green: '#27ae60', teal: '#16a085',
        blue: '#2980b9', violet: '#8e44ad', brown: '#6d4c41', gray: '#4b5563',
        grey: '#4b5563', black: '#000000', white: '#ffffff',
        yellow: '#fbbf24', pink: '#e84393', purple: '#8e44ad', cyan: '#22d3ee'
    };

    function colorOf(name) {
        return COLOR_MAP[name] || null;
    }

    /* KaTeX rendering with graceful failure */
    function math(tex, displayMode) {
        if (!tex || !tex.trim()) return '';
        try {
            return katex.renderToString(tex, { throwOnError: false, displayMode: !!displayMode });
        } catch (e) {
            return '<span class="latex-img-missing">' + esc(tex) + '</span>';
        }
    }

    /* Skip whitespace starting at i */
    function skipSpaces(s, i) {
        while (i < s.length && /\s/.test(s[i])) i++;
        return i;
    }

    /* Read a balanced {group} starting at i (s[i] === '{'); skips escaped braces */
    function readGroup(s, i) {
        if (s[i] !== '{') return null;
        let depth = 0, j = i;
        for (; j < s.length; j++) {
            const ch = s[j];
            if (ch === '\\') { j++; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
            }
        }
        return { content: s.slice(i + 1), end: s.length };
    }

    /* Read an [option] starting at i */
    function readOpt(s, i) {
        if (s[i] !== '[') return null;
        const close = s.indexOf(']', i + 1);
        if (close === -1) return null;
        return { content: s.slice(i + 1, close), end: close + 1 };
    }

    /* Group-or-nothing helper: returns {content, end, had} */
    function maybeGroup(s, i) {
        const j = skipSpaces(s, i);
        if (s[j] === '{') {
            const g = readGroup(s, j);
            if (g) return { content: g.content, end: g.end, had: true };
        }
        return { content: '', end: i, had: false };
    }

    function findClosingDollar(s, from) {
        for (let k = from; k < s.length; k++) {
            if (s[k] === '\\') { k++; continue; }
            if (s[k] === '$') return k;
            if (s[k] === '\n' && s[k + 1] === '\n') return -1; // math can't span blank lines
        }
        return -1;
    }

    /* \includegraphics[name] → <img> using doc-stored images, or a dashed box */
    function includegraphics(name, ctx) {
        const key = (name || '').trim();
        const data = ctx && ctx.images ? ctx.images[key] : null;
        if (data) return '<img class="latex-img" src="' + data + '" alt="' + esc(key) + '">';
        return '<span class="latex-img-missing">[image: ' + esc(key) + ']</span>';
    }

    /* Main inline formatter */
    function format(text, ctx) {
        let out = '', i = 0;
        const s = String(text == null ? '' : text);

        while (i < s.length) {
            const ch = s[i];

            /* ---- backslash sequences ---- */
            if (ch === '\\') {
                const nxt = s[i + 1];

                if (nxt === '\\') { out += '<br>'; i += 2; continue; }                 // \\ line break
                if (nxt && '&%$#_{}'.indexOf(nxt) !== -1) { out += esc(nxt); i += 2; continue; }

                if (nxt === '(') {                                                      // \( inline math \)
                    const close = s.indexOf('\\)', i + 2);
                    const tex = close === -1 ? s.slice(i + 2) : s.slice(i + 2, close);
                    out += math(tex, false);
                    i = close === -1 ? s.length : close + 2;
                    continue;
                }
                if (nxt === '[') {                                                      // \[ display math \]
                    const close = s.indexOf('\\]', i + 2);
                    const tex = close === -1 ? s.slice(i + 2) : s.slice(i + 2, close);
                    out += '<span class="latex-displaymath">' + math(tex, true) + '</span>';
                    i = close === -1 ? s.length : close + 2;
                    continue;
                }

                const m = s.slice(i).match(/^\\([a-zA-Z]+)/);
                if (!m) { out += esc('\\'); i++; continue; }

                const cmd = m[1];
                i += m[0].length;

                /* simple, no-argument commands */
                if (cmd === 'noindent' || cmd === 'centering' || cmd === 'par' || cmd === 'label' || cmd === 'item') { continue; }
                if (cmd === 'newline') { out += '<br>'; continue; }
                if (cmd === 'today') {
                    out += esc(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
                    continue;
                }
                if (cmd === 'LaTeX') { out += 'LaTeX'; continue; }
                if (cmd === 'TeX') { out += 'TeX'; continue; }
                if (cmd === 'ldots' || cmd === 'dots') { out += '\u2026'; continue; }
                if (cmd === 'cdots') { out += '\u22EF'; continue; }
                if (cmd === 'hrulefill') { out += '<span class="latex-hrulefill"></span>'; continue; }
                if (cmd === 'bigskip') { out += '<div style="height:1.2em"></div>'; continue; }
                if (cmd === 'medskip') { out += '<div style="height:0.8em"></div>'; continue; }
                if (cmd === 'smallskip') { out += '<div style="height:0.4em"></div>'; continue; }

                /* one-group commands */
                let g;
                switch (cmd) {
                    case 'textbf':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<strong>' + format(g.content, ctx) + '</strong>';
                        continue;
                    case 'textit': case 'emph':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<em>' + format(g.content, ctx) + '</em>';
                        continue;
                    case 'underline':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<u>' + format(g.content, ctx) + '</u>';
                        continue;
                    case 'sout':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<span class="latex-sout">' + format(g.content, ctx) + '</span>';
                        continue;
                    case 'hl':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<span class="latex-hl">' + format(g.content, ctx) + '</span>';
                        continue;
                    case 'texttt':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<code>' + esc(g.content) + '</code>';
                        continue;
                    case 'textsc':
                        g = maybeGroup(s, i); i = g.end;
                        out += '<span style="font-variant:small-caps">' + format(g.content, ctx) + '</span>';
                        continue;
                    case 'textcolor': {
                        g = maybeGroup(s, i); i = g.end;
                        const c = colorOf(g.content.trim()) || g.content.trim();
                        const g2 = maybeGroup(s, i); i = g2.end;
                        out += '<span style="color:' + esc(c) + '">' + format(g2.content, ctx) + '</span>';
                        continue;
                    }
                    case 'href': {
                        g = maybeGroup(s, i); i = g.end;
                        const url = g.content.trim();
                        const g2 = maybeGroup(s, i); i = g2.end;
                        out += '<a class="latex-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + format(g2.content, ctx) + '</a>';
                        continue;
                    }
                    case 'url': {
                        g = maybeGroup(s, i); i = g.end;
                        const url = g.content.trim();
                        out += '<a class="latex-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + '</a>';
                        continue;
                    }
                    case 'footnote': {
                        g = maybeGroup(s, i); i = g.end;
                        if (ctx) { ctx.footnotes.push(format(g.content, ctx)); out += '<sup class="latex-fn-ref">' + ctx.footnotes.length + '</sup>'; }
                        continue;
                    }
                    case 'cite': {
                        g = maybeGroup(s, i); i = g.end;
                        const keys = g.content.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
                        const marks = keys.map(function (k) { return (ctx && ctx.bib && ctx.bib[k]) ? '[' + ctx.bib[k] + ']' : '[?]'; });
                        out += esc(marks.join(','));
                        continue;
                    }
                    case 'ref': case 'eqref': {
                        g = maybeGroup(s, i); i = g.end;
                        out += '<span class="latex-fn-ref">(' + esc(g.content.trim()) + ')</span>';
                        continue;
                    }
                    case 'includegraphics': {
                        const j = skipSpaces(s, i);
                        const opt = readOpt(s, j);
                        let j2 = opt ? opt.end : j;
                        j2 = skipSpaces(s, j2);
                        const gg = readGroup(s, j2);
                        if (gg) { i = gg.end; out += includegraphics(gg.content, ctx); }
                        else out += esc('\\' + cmd);
                        continue;
                    }
                    case 'hspace': {
                        g = maybeGroup(s, i); i = g.end;
                        out += '<span style="display:inline-block;width:' + esc(g.content) + '"></span>';
                        continue;
                    }
                    case 'vspace': {
                        g = maybeGroup(s, i); i = g.end;
                        out += '<div style="height:' + esc(g.content) + '"></div>';
                        continue;
                    }
                    default:
                        out += esc('\\' + cmd);
                        continue;
                }
            }

            /* ---- math ---- */
            if (ch === '$') {
                if (s[i + 1] === '$') {
                    const close = s.indexOf('$$', i + 2);
                    const tex = close === -1 ? s.slice(i + 2) : s.slice(i + 2, close);
                    out += '<span class="latex-displaymath">' + math(tex, true) + '</span>';
                    i = close === -1 ? s.length : close + 2;
                    continue;
                }
                const close = findClosingDollar(s, i + 1);
                if (close > i) {
                    out += math(s.slice(i + 1, close), false);
                    i = close + 1;
                    continue;
                }
                out += esc('$'); i++;
                continue;
            }

            /* ---- specials & ligatures ---- */
            if (ch === '~') { out += '&nbsp;'; i++; continue; }
            if (ch === '`' && s[i + 1] === '`') { out += '\u201C'; i += 2; continue; }
            if (ch === "'" && s[i + 1] === "'") { out += '\u201D'; i += 2; continue; }
            if (ch === '-' && s[i + 1] === '-' && s[i + 2] === '-') { out += '\u2014'; i += 3; continue; }
            if (ch === '-' && s[i + 1] === '-') { out += '\u2013'; i += 2; continue; }

            /* plain run */
            let j = i + 1;
            while (j < s.length) {
                const c = s[j];
                if (c === '\\' || c === '$' || c === '~' || c === '`') break;
                if (c === '-' && s[j + 1] === '-') break;
                if (c === "'" && s[j + 1] === "'") break;
                j++;
            }
            out += esc(s.slice(i, j));
            i = j;
        }
        return out;
    }

    return { format: format, math: math, includegraphics: includegraphics, colorOf: colorOf, readGroup: readGroup, readOpt: readOpt, skipSpaces: skipSpaces, maybeGroup: maybeGroup };
})();
