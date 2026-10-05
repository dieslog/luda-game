// All localStorage access goes through here so keys and shapes live in one
// place. Everything is namespaced under "lg." to avoid clashes.
(function (LG) {
    'use strict';

    var KEYS = {
        autosave: 'lg.autosave',         // JSON snapshot, rewritten after every move
        checkpoint: 'lg.checkpoint',     // JSON snapshot, written by the manual "Зберегти"
        bestRows: 'lg.bestRows',         // number: fewest rows a finished game ever took
        settings: 'lg.settings',         // JSON: user preferences
        stats: 'lg.stats',               // JSON: lifetime statistics
        achievements: 'lg.achievements', // JSON: { id: unlockTimestamp }
        daily: 'lg.daily',               // JSON: { 'YYYY-MM-DD': { rows, timeMs } }
        legacySound: 'lg.sound',         // '1' | '0'   (pre-settings era)
        legacyColors: 'lg.cellColors'    // '1' | '0'   (pre-settings era)
    };

    function readJSON(key) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            /* private mode / quota - just skip persistence */
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) { /* ignore */ }
    }

    function readRaw(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    // A game snapshot is:
    //   { v, digits[], closed[], level, totalRows, mode, seed,
    //     elapsed, score, moves, hints, undos, rewrites }
    LG.storage = {
        KEYS: KEYS,

        readJSON: readJSON,
        writeJSON: writeJSON,
        readRaw: readRaw,

        saveAuto: function (snapshot) {
            writeJSON(KEYS.autosave, snapshot);
        },
        loadAuto: function () {
            return readJSON(KEYS.autosave);
        },
        clearAuto: function () {
            remove(KEYS.autosave);
        },
        hasAuto: function () {
            var s = readJSON(KEYS.autosave);
            return !!(s && s.digits && s.digits.length);
        },

        saveCheckpoint: function (snapshot) {
            writeJSON(KEYS.checkpoint, snapshot);
        },
        loadCheckpoint: function () {
            return readJSON(KEYS.checkpoint);
        },
        hasCheckpoint: function () {
            var s = readJSON(KEYS.checkpoint);
            return !!(s && s.digits && s.digits.length);
        },

        getBestRows: function () {
            var raw = readRaw(KEYS.bestRows);
            var n = raw == null ? NaN : parseInt(raw, 10);
            return isNaN(n) ? null : n;
        },
        // Records a finished game; keeps the smallest value seen. Returns true
        // when this run set a new record.
        reportFinishedRows: function (rows) {
            var best = this.getBestRows();
            if (best == null || rows < best) {
                try {
                    localStorage.setItem(KEYS.bestRows, String(rows));
                } catch (e) { /* ignore */ }
                return true;
            }
            return false;
        },

        // Wipes statistics, achievements and records. Saved games and the
        // settings are left alone.
        resetProgress: function () {
            [KEYS.bestRows, KEYS.stats, KEYS.achievements, KEYS.daily].forEach(remove);
        }
    };
})(window.LG);
