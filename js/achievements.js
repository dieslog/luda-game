// Achievements. Each definition declares *when* it is evaluated ('match' after
// every pair, 'win' when a game is finished) and a test over a small context.
// Unlocks are persisted as { id: timestamp }; match-time unlocks are announced
// over the bus, win-time unlocks are returned so the victory screen can list
// them.
(function (LG) {
    'use strict';

    var DEFS = [
        {id: 'first_win', icon: '🎉', title: 'Перша перемога', desc: 'Закрийте все поле вперше',
            when: 'win', test: function () { return true; }},
        {id: 'no_hints', icon: '🧠', title: 'Власним розумом', desc: 'Виграйте, не використавши жодної підказки',
            when: 'win', test: function (c) { return c.hints === 0; }},
        {id: 'rows_12', icon: '📏', title: 'Ощадливий', desc: 'Завершіть гру не більше ніж за 12 рядків',
            when: 'win', test: function (c) { return c.rows <= 12; }},
        {id: 'rows_8', icon: '📐', title: 'Мінімаліст', desc: 'Завершіть гру не більше ніж за 8 рядків',
            when: 'win', test: function (c) { return c.rows <= 8; }},
        {id: 'rows_6', icon: '💎', title: 'Гросмейстер', desc: 'Завершіть гру не більше ніж за 6 рядків',
            when: 'win', test: function (c) { return c.rows <= 6; }},
        {id: 'fast_10', icon: '⚡', title: 'Швидкий', desc: 'Виграйте швидше ніж за 10 хвилин',
            when: 'win', test: function (c) { return c.timeMs <= 10 * 60000; }},
        {id: 'fast_5', icon: '🚀', title: 'Блискавка', desc: 'Виграйте швидше ніж за 5 хвилин',
            when: 'win', test: function (c) { return c.timeMs <= 5 * 60000; }},
        {id: 'combo_3', icon: '🔥', title: 'Розігрів', desc: 'Зберіть комбо ×3',
            when: 'match', test: function (c) { return c.combo >= 3; }},
        {id: 'combo_5', icon: '🌋', title: 'Вогонь!', desc: 'Зберіть комбо ×5',
            when: 'match', test: function (c) { return c.combo >= 5; }},
        {id: 'double_clear', icon: '💥', title: 'Подвійний удар', desc: 'Закрийте два рядки одним ходом',
            when: 'match', test: function (c) { return c.rowsCleared >= 2; }},
        {id: 'matches_100', icon: '💯', title: 'Сотня пар', desc: 'Закрийте 100 пар за весь час',
            when: 'match', test: function (c) { return c.totalMatches >= 100; }},
        {id: 'matches_500', icon: '🏭', title: 'Конвеєр', desc: 'Закрийте 500 пар за весь час',
            when: 'match', test: function (c) { return c.totalMatches >= 500; }},
        {id: 'random_win', icon: '🎲', title: 'Випадковий шлях', desc: 'Виграйте на згенерованому рівні',
            when: 'win', test: function (c) { return c.mode === 'random'; }},
        {id: 'daily_win', icon: '🗓️', title: 'Щоденник', desc: 'Пройдіть щоденний виклик',
            when: 'win', test: function (c) { return c.mode === 'daily'; }},
        {id: 'streak_3', icon: '📆', title: 'Серія 3', desc: 'Проходьте щоденний виклик 3 дні поспіль',
            when: 'win', test: function (c) { return c.mode === 'daily' && c.streak >= 3; }},
        {id: 'streak_7', icon: '👑', title: 'Тиждень без пропусків', desc: 'Проходьте щоденний виклик 7 днів поспіль',
            when: 'win', test: function (c) { return c.mode === 'daily' && c.streak >= 7; }},
        {id: 'record_breaker', icon: '🏅', title: 'Рекордсмен', desc: 'Побийте власний рекорд рядків',
            when: 'win', test: function (c) { return c.beatRecord; }}
    ];

    var unlocked = LG.storage.readJSON(LG.storage.KEYS.achievements) || {};

    function persist() {
        LG.storage.writeJSON(LG.storage.KEYS.achievements, unlocked);
    }

    function evaluate(when, ctx) {
        var fresh = [];
        DEFS.forEach(function (def) {
            if (def.when !== when || unlocked[def.id]) {
                return;
            }
            var ok = false;
            try {
                ok = def.test(ctx);
            } catch (e) {
                ok = false;
            }
            if (ok) {
                unlocked[def.id] = Date.now();
                fresh.push(def);
            }
        });
        if (fresh.length) {
            persist();
        }
        return fresh;
    }

    // Pair-level unlocks are announced as they happen.
    LG.bus.on('match', function (e) {
        var fresh = evaluate('match', {
            combo: e.combo,
            rowsCleared: e.rowsCleared,
            totalMatches: LG.stats.get().matches
        });
        fresh.forEach(function (def) {
            LG.bus.emit('achievement', def);
        });
    });

    LG.achievements = {
        DEFS: DEFS,

        // ctx: { rows, timeMs, hints, mode, streak, beatRecord }
        // Returns the achievements this win unlocked.
        checkWin: function (ctx) {
            return evaluate('win', ctx);
        },

        isUnlocked: function (id) {
            return !!unlocked[id];
        },
        unlockedAt: function (id) {
            return unlocked[id] || null;
        },
        count: function () {
            return Object.keys(unlocked).length;
        },
        total: function () {
            return DEFS.length;
        },

        reset: function () {
            unlocked = {};
        }
    };
})(window.LG);
