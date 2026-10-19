/* ============================================================
   editor.js — CodeMirror 6 bridge.
   The app is built with classic scripts (double-click friendly),
   but CodeMirror 6 is ESM-only, so this module loads it through
   dynamic import(). The importmap in <head> forces ALL packages
   to share ONE @codemirror/state instance (via ?external on each
   package URL) — otherwise updateListener facets silently never
   fire. If the CDN is unreachable, a styled <textarea> fallback
   keeps the whole studio functional.
   ============================================================ */
window.App = window.App || {};

App.editor = (function () {
    let view = null;          // CodeMirror EditorView
    let fallbackEl = null;    // textarea fallback
    let onChange = null;
    let usingCM = false;
    let initPromise = null;

    /* ---------- LaTeX syntax highlighting ---------- */
    function makeLaTeXLanguage(mods) {
        const StreamLanguage = mods.language.StreamLanguage;
        const Tag = mods.highlight.Tag;

        /* Custom tags → tok-* classes via HighlightStyle (editor.css) */
        const TComment = Tag.define(), TString = Tag.define(), TBracket = Tag.define();
        const TTag = Tag.define(), TKeyword = Tag.define(), TMath = Tag.define();

        const latex = StreamLanguage.define({
            startState: function () { return { math: null, afterCmd: false }; },
            copyState: function (st) { return { math: st.math, afterCmd: st.afterCmd }; },
            /* NOTE: StreamLanguage token() returns STRING token names that are
               resolved through tokenTable below (returning Tag objects directly
               crashes the stream parser). */
            token: function (stream, st) {
                if (stream.eatSpace()) return null;
                const ch = stream.peek();

                if (ch === '%') { stream.skipToEnd(); st.afterCmd = false; return 'latex-comment'; }

                /* inside math regions ($$…$$, $…$, \[…\]) */
                if (st.math) {
                    if (st.math === '$' && ch === '$') { stream.next(); st.math = null; return 'latex-math'; }
                    if (st.math === '[' && stream.match('\\]')) { st.math = null; return 'latex-math'; }
                    stream.next();
                    return 'latex-math';
                }

                if (stream.match('$$')) { st.math = '$'; st.afterCmd = false; return 'latex-math'; }
                if (stream.match('\\[')) { st.math = '['; st.afterCmd = false; return 'latex-math'; }

                if (ch === '\\') {
                    stream.next();
                    const w = stream.match(/^[a-zA-Z]+/);
                    if (w) {
                        st.afterCmd = true;
                        if (w[0] === 'begin' || w[0] === 'end') {
                            if (stream.match('{')) { stream.eatWhile(/[^}]/); stream.match('}'); }
                            return 'latex-tag';
                        }
                        return 'latex-keyword';
                    }
                    if (!stream.eol()) stream.next();   /* escaped symbol: \$ \{ \\ … */
                    st.afterCmd = true;
                    return 'latex-tag';
                }

                if (ch === '$') { stream.next(); st.math = '$'; st.afterCmd = false; return 'latex-math'; }
                if (ch === '{' || ch === '}') { stream.next(); st.afterCmd = false; return 'latex-bracket'; }
                if (ch === '[' || ch === ']') {
                    /* options after a command get string styling; stray brackets
                       must still consume one char or the parser stalls */
                    stream.next();
                    const asOpt = st.afterCmd;
                    st.afterCmd = false;
                    return asOpt ? 'latex-string' : null;
                }

                stream.eatWhile(/[^\\$%{}\[\]]/);
                st.afterCmd = false;
                return null;
            },
            tokenTable: {
                'latex-comment': TComment,
                'latex-string': TString,
                'latex-bracket': TBracket,
                'latex-tag': TTag,
                'latex-keyword': TKeyword,
                'latex-math': TMath
            },
            languageData: { commentTokens: { line: '%' } }
        });

        const highlighter = mods.language.HighlightStyle.define([
            { tag: TComment, class: 'tok-comment' },
            { tag: TString,  class: 'tok-string' },
            { tag: TBracket, class: 'tok-bracket' },
            { tag: TTag,     class: 'tok-tag' },
            { tag: TKeyword, class: 'tok-keyword' },
            { tag: TMath,    class: 'tok-math' }
        ]);

        return { lang: latex, highlighter: highlighter };
    }

    /* ---------- module loading ---------- */
    function loadModules() {
        /* ?external forces esm.sh to leave the shared packages as bare
           imports, which the page importmap then resolves — one shared
           @codemirror/state for everything.
           NOTE: esm.sh's build for @codemirror/commands chokes on a
           comma-separated external list, but commands only depends on
           @codemirror/state — so a single external is enough there. */
        const ext = '?external=@codemirror/state,@lezer/common,@lezer/highlight&target=es2022';
        const extState = '?external=@codemirror/state&target=es2022';
        return Promise.all([
            import('@codemirror/state'),
            import('https://esm.sh/@codemirror/view@6.26.3' + ext),
            import('https://esm.sh/@codemirror/commands@6.3.3' + extState),
            import('https://esm.sh/@codemirror/language@6.10.1' + ext),
            import('@lezer/highlight')
        ]).then(function (res) {
            return { state: res[0], view: res[1], commands: res[2], language: res[3], highlight: res[4] };
        });
    }

    /* ---------- public API ---------- */
    function getValue() {
        if (usingCM && view) return view.state.doc.toString();
        if (fallbackEl) return fallbackEl.value;
        return '';
    }

    function setValue(v) {
        if (usingCM && view) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: String(v == null ? '' : v) } });
        } else if (fallbackEl) {
            fallbackEl.value = String(v == null ? '' : v);
        }
    }

    function focus() {
        if (usingCM && view) view.focus();
        else if (fallbackEl) fallbackEl.focus();
    }

    function insertSnippet(snippet, offset) {
        offset = typeof offset === 'number' ? offset : 0;
        if (usingCM && view) {
            const sel = view.state.selection.main;
            if (!sel.empty && snippet.indexOf('{') !== -1) {
                /* wrap the current selection into the first {…} group */
                const selText = view.state.sliceDoc(sel.from, sel.to);
                const idx = snippet.indexOf('{');
                const text = snippet.slice(0, idx + 1) + selText + snippet.slice(idx + 1);
                view.dispatch({
                    changes: { from: sel.from, to: sel.to, insert: text },
                    selection: { anchor: sel.from + idx + 1 + selText.length },
                    scrollIntoView: true
                });
            } else {
                const back = Math.max(0, snippet.length - offset);
                view.dispatch({
                    changes: { from: sel.from, to: sel.to, insert: snippet },
                    selection: { anchor: sel.from + back },
                    scrollIntoView: true
                });
            }
            view.focus();
        } else if (fallbackEl) {
            const el = fallbackEl;
            const start = el.selectionStart, end = el.selectionEnd;
            let text = snippet, caret = start + snippet.length - Math.max(0, offset);
            if (start !== end && snippet.indexOf('{') !== -1) {
                const selText = el.value.slice(start, end);
                const idx = snippet.indexOf('{');
                text = snippet.slice(0, idx + 1) + selText + snippet.slice(idx + 1);
                caret = start + idx + 1 + selText.length;
            }
            el.value = el.value.slice(0, start) + text + el.value.slice(end);
            el.selectionStart = el.selectionEnd = Math.max(start, caret);
            el.focus();
            if (onChange) onChange();
        }
    }

    function selectRange(from, to) {
        if (usingCM && view) {
            view.dispatch({
                selection: { anchor: from, head: to },
                effects: viewScrollIntoView(from)
            });
        } else if (fallbackEl) {
            fallbackEl.focus();
            fallbackEl.setSelectionRange(from, to);
        }
    }

    let scrollEffect = null;
    function viewScrollIntoView(pos) {
        return scrollEffect ? scrollEffect(pos) : [];
    }

    function undo() {
        if (usingCM && view) { App.editor._commands.undo(view); view.focus(); }
    }
    function redo() {
        if (usingCM && view) { App.editor._commands.redo(view); view.focus(); }
    }

    /* ---------- init ---------- */
    function init(host, cb) {
        onChange = cb;
        if (initPromise) return initPromise;
        initPromise = loadModules()
            .then(function (mods) {
                const { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine,
                        highlightActiveLineGutter } = mods.view;
                const { EditorState } = mods.state;
                const { defaultKeymap, history, historyKeymap, indentWithTab } = mods.commands;
                const { syntaxHighlighting } = mods.language;

                App.editor._commands = mods.commands;
                scrollEffect = mods.view.EditorView.scrollIntoView;

                const { lang, highlighter } = makeLaTeXLanguage(mods);

                const wrapWith = function (cmd) {
                    return function () {
                        if (App.ribbon) App.ribbon.applyTextWrap(cmd);
                        return true;
                    };
                };

                const updateListener = EditorView.updateListener.of(function (u) {
                    if (u.docChanged && onChange) onChange();
                });

                const extensions = [
                    lineNumbers(),
                    highlightActiveLineGutter(),
                    history(),
                    drawSelection(),
                    highlightActiveLine(),
                    EditorView.lineWrapping,
                    syntaxHighlighting(highlighter),
                    lang,
                    keymap.of([
                        { key: 'Mod-b', run: wrapWith('\\textbf') },
                        { key: 'Mod-i', run: wrapWith('\\textit') },
                        { key: 'Mod-u', run: wrapWith('\\underline') },
                        indentWithTab,
                        ...defaultKeymap,
                        ...historyKeymap
                    ]),
                    updateListener
                ];

                view = new EditorView({
                    state: EditorState.create({ doc: '', extensions: extensions }),
                    parent: host
                });
                usingCM = true;
                return true;
            })
            .catch(function (err) {
                console.warn('[editor] CodeMirror CDN unavailable, using textarea fallback:', err);
                usingCM = false;
                fallbackEl = document.createElement('textarea');
                fallbackEl.spellcheck = false;
                fallbackEl.className = 'cm-fallback';
                host.innerHTML = '';
                host.appendChild(fallbackEl);
                fallbackEl.addEventListener('input', function () { if (onChange) onChange(); });
                return false;
            });
        return initPromise;
    }

    return {
        init: init, getValue: getValue, setValue: setValue, focus: focus,
        insertSnippet: insertSnippet, selectRange: selectRange,
        undo: undo, redo: redo,
        get usingCM() { return usingCM; }
    };
})();
