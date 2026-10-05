// The "juice" layer. Listens to game events on the bus and answers with
// sound, vibration, floating score text and toasts - game.js stays free of
// presentation concerns.
(function (LG) {
    'use strict';

    // --- vibration -------------------------------------------------------
    function vibrate(pattern) {
        if (!LG.settings.get('vibration') || !navigator.vibrate) {
            return;
        }
        try {
            navigator.vibrate(pattern);
        } catch (e) { /* unsupported / blocked */ }
    }

    // --- floating text -----------------------------------------------------
    function floatText(text, x, y, cls) {
        var node = LG.el('div', 'floater' + (cls ? ' ' + cls : ''), text);
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        node.setAttribute('aria-hidden', 'true');
        document.body.appendChild(node);
        window.setTimeout(function () {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }, 1100);
    }

    function centre(cell) {
        var r = cell.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    }

    LG.fx = {
        vibrate: vibrate,
        floatText: floatText
    };

    // --- reactions -----------------------------------------------------
    LG.bus.on('select', function () {
        LG.audio.play('select');
        vibrate(6);
    });

    LG.bus.on('deselect', function () {
        LG.audio.play('deselect');
    });

    LG.bus.on('error', function () {
        LG.audio.play('error');
        vibrate([28, 36, 28]);
    });

    LG.bus.on('match', function (e) {
        LG.audio.play('close');
        vibrate(14);

        var a = centre(e.cells[0]);
        var b = centre(e.cells[1]);
        var x = (a.x + b.x) / 2;
        var y = (a.y + b.y) / 2;
        floatText('+' + e.gained, x, y, e.rowsCleared ? 'floater--row' : '');

        if (e.combo >= 2) {
            floatText('Комбо ×' + e.combo, x, y - 34, 'floater--combo');
            window.setTimeout(function () {
                LG.audio.play('combo', e.combo);
            }, 110);
        }
    });

    LG.bus.on('rows:cleared', function (e) {
        LG.audio.play('remove');
        vibrate([16, 34, 16]);
        if (e.count >= 2) {
            LG.toast('Подвійний удар! 💥', 'award', 1600);
        }
    });

    LG.bus.on('rewrite', function () {
        LG.audio.play('rewrite');
        vibrate(18);
    });

    LG.bus.on('undo', function () {
        LG.audio.play('undo');
    });

    LG.bus.on('hint', function () {
        LG.audio.play('hint');
    });

    LG.bus.on('stuck', function () {
        LG.audio.play('stuck');
    });

    LG.bus.on('achievement', function (def) {
        LG.toast(def.icon + ' Досягнення: ' + def.title, 'award', 3400);
        window.setTimeout(function () {
            LG.audio.play('achievement');
        }, 150);
    });

    LG.bus.on('win', function (e) {
        LG.confetti.celebrate(e.newRecord);
        LG.audio.play('win');
        if (e.newRecord) {
            LG.audio.play('record');
        }
        vibrate([40, 60, 40, 60, 120]);
    });

    LG.bus.on('settings:change', function (e) {
        if (e.key === 'vibration' && e.value) {
            vibrate(30);
        }
    });
})(window.LG);
