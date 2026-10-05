// Deterministic randomness for the daily challenge: the same date string
// always yields the same sequence, so every player gets the same level that
// day. (xmur3 string hash -> mulberry32 generator.)
(function (LG) {
    'use strict';

    function hash(str) {
        var h = 1779033703 ^ str.length;
        for (var i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }

    function mulberry32(seed) {
        var a = seed | 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pad(n) {
        return (n < 10 ? '0' : '') + n;
    }

    LG.rng = {
        hash: hash,
        mulberry32: mulberry32,
        fromString: function (s) {
            return mulberry32(hash(s));
        },
        // Local calendar date as YYYY-MM-DD.
        dayKey: function (date) {
            var d = date || new Date();
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        },
        // Key of the day before `key` (used for streak calculation).
        prevDayKey: function (key) {
            var p = key.split('-');
            var d = new Date(+p[0], +p[1] - 1, +p[2]);
            d.setDate(d.getDate() - 1);
            return LG.rng.dayKey(d);
        }
    };
})(window.LG);
