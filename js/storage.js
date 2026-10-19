/* ============================================================
   storage.js — multi-document state, settings, images
   (localStorage-backed; seeds itself with the minimal starter)
   ============================================================ */
window.App = window.App || {};

App.storage = (function () {
    const LS_KEY = 'latex-studio-state-v1';

    let state = null;

    function defaultSettings() {
        return {
            theme: 'dark',
            zoom: 1,
            zoomFit: true,         // true = auto fit page width (recomputed on resize)
            autoCompile: true,
            margins: 'default',     // default | narrow | moderate | wide
            columns: '1',           // 1 | 2
            fontSize: '11pt',       // 10pt | 11pt | 12pt
            spacing: '1.5',         // 1.0 | 1.15 | 1.5 | 2.0
            pageNumbers: true,
            editorWidthPct: 50
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            state = raw ? JSON.parse(raw) : null;
        } catch (e) { state = null; }

        if (!state || !Array.isArray(state.docs) || state.docs.length === 0) {
            const seed = App.SAMPLE_DOC();
            state = { docs: [seed], activeId: seed.id, settings: defaultSettings() };
            persist();
        }
        state.settings = Object.assign(defaultSettings(), state.settings || {});
        if (!getActive()) state.activeId = state.docs[0].id;
        return state;
    }

    function persist() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
        catch (e) { console.warn('[storage] persist failed:', e); }
    }

    function getSettings() { return state.settings; }

    function updateSettings(patch) {
        Object.assign(state.settings, patch);
        persist();
        return state.settings;
    }

    function listDocs() { return state.docs; }

    function getActive() {
        return state.docs.find(function (d) { return d.id === state.activeId; }) || null;
    }

    function setActive(id) {
        if (state.docs.find(function (d) { return d.id === id; })) {
            state.activeId = id;
            persist();
        }
        return getActive();
    }

    function createDoc(name, source) {
        const doc = {
            id: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            name: name || 'Untitled.tex',
            source: source || App.SAMPLE_DOC().source,
            images: {},
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        state.docs.push(doc);
        state.activeId = doc.id;
        persist();
        return doc;
    }

    function saveActive(source) {
        const doc = getActive();
        if (!doc) return null;
        if (typeof source === 'string') doc.source = source;
        doc.updatedAt = Date.now();
        persist();
        return doc;
    }

    function renameActive(name) {
        const doc = getActive();
        if (doc && name) { doc.name = name; persist(); }
        return doc;
    }

    function deleteDoc(id) {
        const idx = state.docs.findIndex(function (d) { return d.id === id; });
        if (idx === -1) return false;
        state.docs.splice(idx, 1);
        if (state.docs.length === 0) {
            const seed = App.SAMPLE_DOC();
            state.docs.push(seed);
        }
        if (state.activeId === id) state.activeId = state.docs[0].id;
        persist();
        return true;
    }

    /* ---- images: per-document { key: dataURL } ---- */
    function addImage(dataURL, suggestedName) {
        const doc = getActive();
        if (!doc) return null;
        if (!doc.images) doc.images = {};
        let base = (suggestedName || 'figure').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]/g, '') || 'figure';
        let key = base, n = 1;
        while (doc.images[key]) key = base + '-' + (++n);
        doc.images[key] = dataURL;
        persist();
        return key;
    }

    function getImage(key) {
        const doc = getActive();
        return (doc && doc.images && doc.images[key]) || null;
    }

    return {
        load: load, persist: persist,
        getSettings: getSettings, updateSettings: updateSettings,
        listDocs: listDocs, getActive: getActive, setActive: setActive,
        createDoc: createDoc, saveActive: saveActive, renameActive: renameActive,
        deleteDoc: deleteDoc,
        addImage: addImage, getImage: getImage
    };
})();
