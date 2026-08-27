// Full-screen main menu shown on load and reachable again from the bottom
// bar / after a win. All buttons live in index.html; this wires them up and
// keeps the dynamic bits (Continue enabled?, record, toggle labels) fresh
// every time the menu opens.
(function (LG) {
    'use strict';

    var els = {};

    function cache() {
        els.screen = LG.$('#main_menu');
        els.continueBtn = LG.$('#menu_continue');
        els.newBtn = LG.$('#menu_new');
        els.randomBtn = LG.$('#menu_random');
        els.soundBtn = LG.$('#menu_sound');
        els.colorsBtn = LG.$('#menu_colors');
        els.rulesBtn = LG.$('#menu_rules');
        els.rulesBox = LG.$('#menu_rules_box');
        els.record = LG.$('#menu_record');
    }

    function syncDynamic() {
        var hasSave = LG.storage.hasAuto();
        // No point offering "Продовжити" when there's nothing saved - hide it
        // rather than showing a dead button.
        els.continueBtn.hidden = !hasSave;
        els.continueBtn.disabled = !hasSave;

        var best = LG.storage.getBestRows();
        els.record.textContent = best == null
            ? 'Рекорд: ще не встановлений'
            : 'Рекорд: ' + best + ' ' + plural(best, ['рядок', 'рядки', 'рядків']);

        els.soundBtn.textContent = 'Звук: ' + (LG.audio.isEnabled() ? 'увімкнено' : 'вимкнено');
        els.colorsBtn.textContent = 'Кольори клітинок: ' +
            (LG.storage.getCellColors() ? 'увімкнено' : 'вимкнено');
    }

    function plural(n, forms) {
        var mod10 = n % 10;
        var mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) {
            return forms[0];
        }
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            return forms[1];
        }
        return forms[2];
    }

    function open() {
        syncDynamic();
        els.rulesBox.classList.remove('is-open');
        els.screen.classList.add('is-visible');
    }

    function close() {
        els.screen.classList.remove('is-visible');
    }

    function init() {
        cache();

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
            LG.game.startNew();
            close();
        });

        els.randomBtn.addEventListener('click', function () {
            LG.audio.blip();
            LG.game.startRandom();
            close();
        });

        els.soundBtn.addEventListener('click', function () {
            LG.audio.toggle();
            LG.audio.blip();
            syncDynamic();
        });

        els.colorsBtn.addEventListener('click', function () {
            LG.game.setCellColors(!LG.storage.getCellColors());
            LG.audio.blip();
            syncDynamic();
        });

        els.rulesBtn.addEventListener('click', function () {
            els.rulesBox.classList.toggle('is-open');
        });
    }

    LG.menu = {
        init: init,
        open: open,
        close: close,
        syncDynamic: syncDynamic
    };
})(window.LG);
