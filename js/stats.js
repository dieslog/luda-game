// Lifetime statistics, per-mode bests and the daily-challenge log / streak.
// Counters are updated by bus events; wins are reported explicitly by the
// game so it can use the returned "was this a personal best?" flags.
(function (LG) {
    'use strict';

    var MODES = ['classic', 'random', 'daily'];

    function modeDefaults() {
        return {wins: 0, bestRows: null, bestTimeMs: null};
    }

    function defaults() {
        var by = {};
        MODES.forEach(function (m) {
            by[m] = modeDefaults();
        });
        return {
            started: 0,
            wins: 0,
            matches: 0,
            rewrites: 0,
            hints: 0,
            undos: 0,
            playMs: 0,
            bestScore: 0,
            bestTimeMs: null,
            bestCombo: 0,
            byMode: by,
            streak: {current: 0, best: 0, last: null}
        };
    }

    function merge(base, saved) {
        if (!saved || typeof saved !== 'object') {
            return base;
        }
        Object.keys(base).forEach(function (k) {
            var b = base[k];
            var s = saved[k];
            if (s === undefined || s === null) {
                return;
            }
            if (b && typeof b === 'object' && !Array.isArray(b)) {
                base[k] = merge(b, s);
            } else if (typeof s === typeof b || b === null) {
                base[k] = s;
            }
        });
        return base;
    }

    var data = merge(defaults(), LG.storage.readJSON(LG.storage.KEYS.stats));
    var daily = LG.storage.readJSON(LG.storage.KEYS.daily) || {};
    var dirty = false;

    function flush() {
        if (dirty) {
            LG.storage.writeJSON(LG.storage.KEYS.stats, data);
            LG.storage.writeJSON(LG.storage.KEYS.daily, daily);
            dirty = false;
        }
    }

    function touch() {
        dirty = true;
    }

    // keep the daily log from growing forever
    function pruneDaily() {
        var keys = Object.keys(daily).sort();
        while (keys.length > 120) {
            delete daily[keys.shift()];
        }
    }

    LG.bus.on('timer:tick', function (e) {
        if (e.delta > 0) {
            data.playMs += e.delta;
            touch();
        }
    });
    LG.bus.on('game:start', function (e) {
        if (!e.resumed) {
            data.started += 1;
            touch();
            flush();
        }
    });
    LG.bus.on('match', function (e) {
        data.matches += 1;
        data.bestCombo = Math.max(data.bestCombo, e.combo || 0);
        touch();
    });
    LG.bus.on('rewrite', function () {
        data.rewrites += 1;
        touch();
    });
    LG.bus.on('hint', function () {
        data.hints += 1;
        touch();
    });
    // an undone move no longer counts as a closed pair / rewrite
    LG.bus.on('undo', function (e) {
        data.undos += 1;
        if (e && e.type === 'match') {
            data.matches = Math.max(0, data.matches - 1);
        } else if (e && e.type === 'rewrite') {
            data.rewrites = Math.max(0, data.rewrites - 1);
        }
        touch();
    });

    LG.stats = {
        MODES: MODES,

        get: function () {
            return data;
        },

        flush: flush,

        // result: { mode, seed, rows, timeMs, score }
        // Returns which personal bests this win set.
        onWin: function (result) {
            var m = data.byMode[result.mode] || (data.byMode[result.mode] = modeDefaults());
            var out = {
                bestTime: data.bestTimeMs == null || result.timeMs < data.bestTimeMs,
                bestScore: result.score > data.bestScore,
                modeRows: m.bestRows == null || result.rows < m.bestRows,
                streak: 0
            };

            data.wins += 1;
            m.wins += 1;
            if (out.bestTime) {
                data.bestTimeMs = result.timeMs;
            }
            if (out.bestScore) {
                data.bestScore = result.score;
            }
            if (out.modeRows) {
                m.bestRows = result.rows;
            }
            if (m.bestTimeMs == null || result.timeMs < m.bestTimeMs) {
                m.bestTimeMs = result.timeMs;
            }

            if (result.mode === 'daily' && result.seed) {
                var key = result.seed;
                var prev = daily[key];
                if (!prev || result.rows < prev.rows) {
                    daily[key] = {rows: result.rows, timeMs: result.timeMs};
                }
                pruneDaily();

                var s = data.streak;
                if (s.last !== key) {
                    s.current = (s.last === LG.rng.prevDayKey(key)) ? s.current + 1 : 1;
                    s.last = key;
                    s.best = Math.max(s.best, s.current);
                }
                out.streak = s.current;
            }

            touch();
            flush();
            return out;
        },

        // Result of today's (or any day's) daily challenge, or null.
        dailyResult: function (key) {
            return daily[key] || null;
        },

        // Streak that is still alive today (played today or yesterday).
        currentStreak: function () {
            var s = data.streak;
            var today = LG.rng.dayKey();
            if (s.last === today || s.last === LG.rng.prevDayKey(today)) {
                return s.current;
            }
            return 0;
        },

        reset: function () {
            data = defaults();
            daily = {};
            dirty = false;
        }
    };
})(window.LG);
