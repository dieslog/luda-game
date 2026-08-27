// All localStorage access goes through here so keys and shapes live in one
// place. Everything is namespaced under "lg." to avoid clashes and to make
// the old (incompatible) keys easy to ignore.
(function (LG) {
    'use strict';

    var KEYS = {
        autosave: 'lg.autosave',     // JSON snapshot, rewritten after every move
        checkpoint: 'lg.checkpoint', // JSON snapshot, written by the manual "Зберегти"
        bestRows: 'lg.bestRows',     // number: fewest rows a finished game ever took
        sound: 'lg.sound',           // '1' | '0'
        cellColors: 'lg.cellColors'  // '1' | '0'
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

    // A snapshot is: { digits: number[], closed: boolean[], level, totalRows }
    LG.storage = {
        KEYS: KEYS,

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
            return !!readJSON(KEYS.autosave);
        },

        saveCheckpoint: function (snapshot) {
            writeJSON(KEYS.checkpoint, snapshot);
        },
        loadCheckpoint: function () {
            return readJSON(KEYS.checkpoint);
        },
        hasCheckpoint: function () {
            return !!readJSON(KEYS.checkpoint);
        },

        getBestRows: function () {
            var raw = localStorage.getItem(KEYS.bestRows);
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

        getSound: function () {
            return localStorage.getItem(KEYS.sound) !== '0';
        },
        setSound: function (on) {
            try {
                localStorage.setItem(KEYS.sound, on ? '1' : '0');
            } catch (e) { /* ignore */ }
        },

        getCellColors: function () {
            return localStorage.getItem(KEYS.cellColors) !== '0';
        },
        setCellColors: function (on) {
            try {
                localStorage.setItem(KEYS.cellColors, on ? '1' : '0');
            } catch (e) { /* ignore */ }
        }
    };
})(window.LG);
