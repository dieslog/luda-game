// Points and combos. A pair is worth BASE points; matching again within
// COMBO_WINDOW_MS of the previous match builds a combo that multiplies the
// pair's value (capped at MAX_MULTIPLIER). Clearing a whole row is a bonus.
// The official "record" stays the fewest rows - score is the fun layer.
(function (LG) {
    'use strict';

    var BASE = 10;
    var ROW_BONUS = 50;
    var MAX_MULTIPLIER = 5;
    var COMBO_WINDOW_MS = 6000;

    var score = 0;
    var combo = 0;
    var bestCombo = 0;
    var lastMatchAt = 0;
    var comboTimer = null;

    function endCombo() {
        window.clearTimeout(comboTimer);
        comboTimer = null;
        if (combo !== 0) {
            combo = 0;
            LG.bus.emit('combo', {combo: 0});
        }
    }

    LG.score = {
        COMBO_WINDOW_MS: COMBO_WINDOW_MS,

        reset: function (initialScore) {
            score = initialScore || 0;
            bestCombo = 0;
            lastMatchAt = 0;
            endCombo();
        },

        // Register a matched pair. Returns what it was worth.
        registerMatch: function (rowsCleared) {
            var now = Date.now();
            combo = (combo > 0 && now - lastMatchAt <= COMBO_WINDOW_MS) ? combo + 1 : 1;
            lastMatchAt = now;
            bestCombo = Math.max(bestCombo, combo);

            var multiplier = Math.min(combo, MAX_MULTIPLIER);
            var gained = BASE * multiplier + (rowsCleared || 0) * ROW_BONUS;
            score += gained;

            window.clearTimeout(comboTimer);
            comboTimer = window.setTimeout(endCombo, COMBO_WINDOW_MS);
            LG.bus.emit('combo', {combo: combo, multiplier: multiplier, windowMs: COMBO_WINDOW_MS});

            return {gained: gained, combo: combo, multiplier: multiplier};
        },

        // Undo: take the points back and drop the combo.
        revert: function (gained) {
            score = Math.max(0, score - (gained || 0));
            endCombo();
        },

        breakCombo: endCombo,

        get: function () {
            return score;
        },
        getCombo: function () {
            return combo;
        },
        getBestCombo: function () {
            return bestCombo;
        }
    };
})(window.LG);
