/* ============================================================
   sample-doc.js — the minimal starter document (default content)
   ============================================================ */
window.App = window.App || {};

App.SAMPLE_DOC = function () {
    return {
        id: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: 'Article_Notes.tex',
        source: [
            '\\documentclass{article}',
            '\\usepackage{amsmath}',
            '\\usepackage{amsthm}',
            '\\title{Article Notes}',
            '\\author{Author Name}',
            '\\date{\\today}',
            '',
            '\\begin{document}',
            '',
            '\\maketitle',
            '',
            '\\begin{abstract}',
            'This starter document shows the basic building blocks of the studio:',
            'a title block, an abstract, a table of contents, numbered sections,',
            'and a numbered equation. Replace the text with your own notes.',
            '\\end{abstract}',
            '',
            '\\tableofcontents',
            '',
            '\\section{Introduction}',
            '',
            'Write your opening paragraph here. Inline math such as $a^2 + b^2 = c^2$',
            'is rendered with KaTeX. Paragraphs are separated by a blank line, just',
            'like in real LaTeX.',
            '',
            '\\section{Main Result}',
            '',
            'The Pythagorean identity is',
            '\\begin{equation}',
            '  a^2 + b^2 = c^2',
            '\\end{equation}',
            '',
            '\\end{document}'
        ].join('\n'),
        images: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
};
