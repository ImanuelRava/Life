/* ============================================================
   images.js — Insert Image flow. Images are read as data URLs
   and stored INSIDE the document (localStorage), so they work
   in the preview AND in PDF export without external files.
   ============================================================ */
window.App = window.App || {};

App.images = (function () {
    const $ = App.utils.$;

    function onFileSelected(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            const key = App.storage.addImage(reader.result, file.name);
            if (!key) { App.utils.toast('Could not store image'); return; }
            App.editor.insertSnippet('\\includegraphics[width=0.7\\textwidth]{' + key + '}', 0);
            App.utils.toast('Image inserted as "' + key + '"');
        };
        reader.readAsDataURL(file);
    }

    function init() {
        const btn = $('#insert-image-btn');
        const input = $('#image-file-input');
        if (!btn || !input) return;
        btn.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) onFileSelected(input.files[0]);
            input.value = '';
        });
    }

    return { init: init };
})();
