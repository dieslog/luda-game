// The top stats strip and the floating combo chip. Purely presentational:
// it renders whatever the game publishes on the 'state' / 'timer:tick' /
// 'combo' bus events.
(function (LG) {
    'use strict';

    var els = {};

    function cache() {
        els.time = LG.$('.stat-time');
        els.score = LG.$('.stat-score');
        els.rows = LG.$('.count-tr');
        els.record = LG.$('.count-high');
        els.activeRows = LG.$('.total-active-tr');
        els.activeCells = LG.$('.total-active-td');
        els.combo = LG.$('#combo_chip');
        els.comboLabel = LG.$('#combo_chip_label');
        els.comboBar = LG.$('#combo_chip_bar');
    }

    // Write a stat, popping it briefly when the value changes.
    function setStat(node, value, noPop) {
        var str = String(value);
        if (node.textContent !== str) {
            node.textContent = str;
            if (!noPop) {
                LG.replayAnimation(node, 'stat-pop', 320);
            }
        }
    }

    function render(view) {
        setStat(els.rows, view.totalRows);
        setStat(els.record, view.bestRows == null ? '—' : view.bestRows, true);
        setStat(els.activeRows, view.activeRows);
        setStat(els.activeCells, view.activeCells);
        setStat(els.score, view.score);
    }

    function renderCombo(e) {
        if (!e.combo || e.combo < 2) {
            els.combo.classList.remove('is-visible');
            return;
        }
        els.comboLabel.textContent = 'Комбо ×' + e.combo;
        els.combo.classList.add('is-visible');
        LG.replayAnimation(els.combo, 'combo-bump', 360);

        // restart the draining bar
        els.comboBar.style.animation = 'none';
        void els.comboBar.offsetWidth;
        els.comboBar.style.animation = 'combo-drain ' + e.windowMs + 'ms linear forwards';
    }

    LG.hud = {
        init: function () {
            cache();
            LG.bus.on('state', render);
            LG.bus.on('combo', renderCombo);
            LG.bus.on('timer:tick', function (e) {
                els.time.textContent = LG.formatTime(e.elapsed);
            });
        }
    };
})(window.LG);
