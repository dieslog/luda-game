// The full-screen menu: a main view plus Settings / Statistics / Achievements /
// Rules sub-views that slide in and out. Opens on load, from the bottom bar and
// after a win; opening it pauses the game clock and refreshes the autosave.
(function (LG) {
    'use strict';

    var els = {};
    var currentView = 'main';

    var MODE_LABELS = {classic: 'Класика', random: 'Випадкова', daily: 'Щоденна'};

    function cache() {
        els.screen = LG.$('#main_menu');
        els.views = LG.$$('.view', els.screen);
        els.record = LG.$('#menu_record');
        els.continueBtn = LG.$('#menu_continue');
        els.continueSub = LG.$('#menu_continue_sub');
        els.newBtn = LG.$('#menu_new');
        els.randomBtn = LG.$('#menu_random');
        els.dailyBtn = LG.$('#menu_daily');
        els.dailySub = LG.$('#menu_daily_sub');
        els.dailyDot = LG.$('#menu_daily_dot');
        els.soundBtn = LG.$('#menu_sound');
        els.statsBody = LG.$('#stats_body');
        els.achBody = LG.$('#ach_body');
        els.achCount = LG.$('#ach_count');
        els.bgDigits = LG.$('#menu_bg');
    }

    function rowsText(n) {
        return n + ' ' + LG.plural(n, ['рядок', 'рядки', 'рядків']);
    }

    // --- main view ------------------------------------------------------
    function syncMain() {
        var best = LG.storage.getBestRows();
        els.record.textContent = best == null
            ? 'Рекорд: ще не встановлений'
            : 'Рекорд: ' + rowsText(best);

        // Continue (only when something is saved)
        var save = LG.game.describeSave();
        els.continueBtn.hidden = !save;
        els.continueBtn.disabled = !save;
        if (save) {
            els.continueSub.textContent = (MODE_LABELS[save.mode] || MODE_LABELS.classic) +
                ' · ' + LG.formatTime(save.elapsed) + ' · ' + rowsText(save.totalRows) +
                ' · ★ ' + save.score;
        }

        // Daily challenge status
        var today = LG.rng.dayKey();
        var done = LG.stats.dailyResult(today);
        var streak = LG.stats.currentStreak();
        var parts = [];
        if (done) {
            parts.push('Пройдено · ' + rowsText(done.rows));
        } else {
            parts.push('Однаковий рівень для всіх на сьогодні');
        }
        if (streak > 0) {
            parts.push('🔥 ' + streak);
        }
        els.dailySub.textContent = parts.join(' · ');
        els.dailyDot.hidden = !!done;

        syncSound();
    }

    function syncSound() {
        els.soundBtn.textContent = (LG.audio.isEnabled() ? '🔊' : '🔇') + ' Звук: ' +
            (LG.audio.isEnabled() ? 'увімкнено' : 'вимкнено');
    }

    // --- settings view ----------------------------------------------------
    function syncSettings() {
        LG.$$('[data-setting]', els.screen).forEach(function (btn) {
            var on = !!LG.settings.get(btn.getAttribute('data-setting'));
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        var vol = LG.$('#set_volume');
        vol.value = String(Math.round(LG.settings.get('volume') * 100));
        updateRangeFill(vol);

        var theme = LG.settings.get('theme');
        LG.$$('[data-theme-opt]', els.screen).forEach(function (btn) {
            var active = btn.getAttribute('data-theme-opt') === theme;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function updateRangeFill(range) {
        range.style.setProperty('--fill', range.value + '%');
    }

    // --- statistics view ----------------------------------------------------
    function statCard(label, value, wide) {
        var card = LG.el('div', 'stat-card' + (wide ? ' stat-card--wide' : ''));
        card.appendChild(LG.el('span', 'stat-card__value', String(value)));
        card.appendChild(LG.el('span', 'stat-card__label', label));
        return card;
    }

    function renderStats() {
        var s = LG.stats.get();
        var best = LG.storage.getBestRows();
        var pct = s.started ? Math.round(s.wins / s.started * 100) : 0;
        var body = els.statsBody;
        body.innerHTML = '';

        var grid = LG.el('div', 'stat-grid');
        grid.appendChild(statCard('Рекорд (рядків)', best == null ? '—' : best));
        grid.appendChild(statCard('Найкращий час', s.bestTimeMs == null ? '—' : LG.formatTime(s.bestTimeMs)));
        grid.appendChild(statCard('Перемог', s.wins));
        grid.appendChild(statCard('Ігор розпочато', s.started));
        grid.appendChild(statCard('Відсоток перемог', pct + '%'));
        grid.appendChild(statCard('Найкращий рахунок', s.bestScore));
        grid.appendChild(statCard('Найкраще комбо', s.bestCombo ? '×' + s.bestCombo : '—'));
        grid.appendChild(statCard('Закрито пар', s.matches));
        grid.appendChild(statCard('Дописувань', s.rewrites));
        grid.appendChild(statCard('Підказок', s.hints));
        grid.appendChild(statCard('Скасувань', s.undos));
        grid.appendChild(statCard('Загальний час', LG.formatTime(s.playMs)));
        body.appendChild(grid);

        // per-mode table
        var table = LG.el('div', 'mode-table');
        var head = LG.el('div', 'mode-table__row mode-table__row--head');
        ['Режим', 'Перемог', 'Рядків', 'Час'].forEach(function (t) {
            head.appendChild(LG.el('span', null, t));
        });
        table.appendChild(head);
        LG.stats.MODES.forEach(function (m) {
            var d = s.byMode[m] || {wins: 0, bestRows: null, bestTimeMs: null};
            var row = LG.el('div', 'mode-table__row');
            row.appendChild(LG.el('span', null, MODE_LABELS[m]));
            row.appendChild(LG.el('span', null, d.wins));
            row.appendChild(LG.el('span', null, d.bestRows == null ? '—' : d.bestRows));
            row.appendChild(LG.el('span', null, d.bestTimeMs == null ? '—' : LG.formatTime(d.bestTimeMs)));
            table.appendChild(row);
        });
        body.appendChild(table);

        // daily streak
        var streak = LG.el('div', 'streak-box');
        streak.appendChild(LG.el('span', 'streak-box__flame', '🔥'));
        var txt = LG.el('div', 'streak-box__text');
        txt.appendChild(LG.el('strong', null, 'Серія щоденних викликів: ' + LG.stats.currentStreak()));
        txt.appendChild(LG.el('small', null, 'Найкраща серія: ' + s.streak.best));
        streak.appendChild(txt);
        body.appendChild(streak);
    }

    // --- achievements view ----------------------------------------------------
    function renderAchievements() {
        var body = els.achBody;
        body.innerHTML = '';
        els.achCount.textContent = LG.achievements.count() + ' / ' + LG.achievements.total();

        // unlocked first, then the rest in definition order
        var defs = LG.achievements.DEFS.slice().sort(function (a, b) {
            return (LG.achievements.isUnlocked(b.id) ? 1 : 0) - (LG.achievements.isUnlocked(a.id) ? 1 : 0);
        });
        defs.forEach(function (def) {
            var at = LG.achievements.unlockedAt(def.id);
            var card = LG.el('div', 'ach-card' + (at ? ' is-unlocked' : ''));
            card.appendChild(LG.el('span', 'ach-card__icon', at ? def.icon : '🔒'));
            var txt = LG.el('div', 'ach-card__text');
            txt.appendChild(LG.el('strong', null, def.title));
            txt.appendChild(LG.el('small', null, def.desc));
            if (at) {
                txt.appendChild(LG.el('em', null, new Date(at).toLocaleDateString('uk-UA')));
            }
            card.appendChild(txt);
            body.appendChild(card);
        });
    }

    // --- view switching ----------------------------------------------------
    function showView(name) {
        currentView = name;
        if (name === 'stats') {
            renderStats();
        } else if (name === 'achievements') {
            renderAchievements();
        } else if (name === 'settings') {
            syncSettings();
        } else if (name === 'main') {
            syncMain();
        }
        els.views.forEach(function (v) {
            v.classList.toggle('is-active', v.getAttribute('data-view') === name);
        });
        els.screen.scrollTop = 0;
        var first = LG.$('.view.is-active button:not([hidden]):not([disabled])', els.screen);
        if (first) {
            first.focus({preventScroll: true});
        }
    }

    function open(view) {
        // make sure the autosave reflects the very latest state / elapsed time
        LG.game.saveNow();
        LG.timer.pause('menu');
        showView(view || 'main');
        els.screen.classList.add('is-visible');
        els.screen.setAttribute('aria-hidden', 'false');
    }

    function close() {
        els.screen.classList.remove('is-visible');
        els.screen.setAttribute('aria-hidden', 'true');
        LG.timer.resume('menu');
        if (document.activeElement && els.screen.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }

    function isOpen() {
        return els.screen.classList.contains('is-visible');
    }

    // Esc / back: sub-view -> main, main -> game (if one is running).
    function back() {
        if (currentView !== 'main') {
            showView('main');
            return true;
        }
        if (LG.game.isActive()) {
            close();
            return true;
        }
        return false;
    }

    // Start a game, asking first when an unfinished one would be discarded.
    function begin(mode) {
        function go() {
            LG.game.startNew(mode);
            close();
        }
        if (LG.storage.hasAuto()) {
            LG.confirm('Є незавершена гра. Почати нову? Поточний прогрес буде втрачено.', go,
                {okText: 'Почати нову', cancelText: 'Назад', danger: true});
        } else {
            go();
        }
    }

    // A few faint digits drifting behind the menu.
    function buildBackdrop() {
        for (var i = 0; i < 18; i++) {
            var d = LG.el('span', 'bg-digit', String(1 + Math.floor(Math.random() * 9)));
            d.style.left = Math.round(Math.random() * 96) + '%';
            d.style.fontSize = (22 + Math.round(Math.random() * 40)) + 'px';
            d.style.animationDuration = (14 + Math.random() * 18).toFixed(1) + 's';
            d.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
            els.bgDigits.appendChild(d);
        }
    }

    function init() {
        cache();
        buildBackdrop();

        els.continueBtn.addEventListener('click', function () {
            if (els.continueBtn.disabled) {
                return;
            }
            LG.audio.blip();
            if (LG.game.resume()) {
                close();
            }
        });
        els.newBtn.addEventListener('click', function () {
            LG.audio.blip();
            begin('classic');
        });
        els.randomBtn.addEventListener('click', function () {
            LG.audio.blip();
            begin('random');
        });
        els.dailyBtn.addEventListener('click', function () {
            LG.audio.blip();
            begin('daily');
        });
        els.soundBtn.addEventListener('click', function () {
            LG.audio.toggle();
            LG.audio.blip();
        });

        LG.$('#menu_settings').addEventListener('click', function () {
            LG.audio.blip();
            showView('settings');
        });
        LG.$('#menu_stats').addEventListener('click', function () {
            LG.audio.blip();
            showView('stats');
        });
        LG.$('#menu_achievements').addEventListener('click', function () {
            LG.audio.blip();
            showView('achievements');
        });
        LG.$('#menu_rules').addEventListener('click', function () {
            LG.audio.blip();
            showView('rules');
        });
        LG.$$('.view-back', els.screen).forEach(function (b) {
            b.addEventListener('click', function () {
                LG.audio.blip();
                showView('main');
            });
        });

        // --- settings controls
        LG.$$('[data-setting]', els.screen).forEach(function (btn) {
            btn.addEventListener('click', function () {
                LG.settings.toggle(btn.getAttribute('data-setting'));
                LG.audio.blip();
            });
        });
        var vol = LG.$('#set_volume');
        vol.addEventListener('input', function () {
            updateRangeFill(vol);
            LG.settings.set('volume', Math.round(vol.value) / 100);
        });
        vol.addEventListener('change', function () {
            LG.audio.preview();
        });
        LG.$$('[data-theme-opt]', els.screen).forEach(function (btn) {
            btn.addEventListener('click', function () {
                LG.settings.set('theme', btn.getAttribute('data-theme-opt'));
                LG.audio.blip();
            });
        });
        LG.$('#set_reset').addEventListener('click', function () {
            LG.confirm('Скинути статистику, досягнення та рекорд? Поточна гра і збереження залишаться.', function () {
                LG.storage.resetProgress();
                LG.stats.reset();
                LG.achievements.reset();
                LG.game.refresh();
                syncMain();
                LG.toast('Прогрес скинуто');
            }, {okText: 'Скинути', cancelText: 'Скасувати', danger: true});
        });

        // keep every label in sync with the settings
        LG.bus.on('settings:change', function () {
            syncSound();
            syncSettings();
        });
    }

    LG.menu = {
        init: init,
        open: open,
        close: close,
        isOpen: isOpen,
        back: back,
        showView: showView,
        syncDynamic: syncMain
    };
})(window.LG);
