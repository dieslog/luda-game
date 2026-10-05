// The victory popup: result tiles that count up, "new record" badge,
// achievements unlocked by this win, plus Share / Play again / Menu actions.
(function (LG) {
    'use strict';

    var els = {};
    var current = null;

    var MODE_LABELS = {
        classic: 'Класична гра',
        random: 'Випадковий рівень',
        daily: 'Щоденний виклик'
    };

    function cache() {
        els.modal = LG.$('#victory_modal');
        els.icon = LG.$('#victory_icon');
        els.title = LG.$('#victory_title');
        els.sub = LG.$('#victory_sub');
        els.badge = LG.$('#victory_badge');
        els.streak = LG.$('#victory_streak');
        els.ach = LG.$('#victory_ach');
        els.share = LG.$('#victory_share_btn');
        els.again = LG.$('#victory_again_btn');
        els.ok = LG.$('#victory_ok_btn');
        els.tiles = {
            rows: LG.$('#v_rows'),
            time: LG.$('#v_time'),
            score: LG.$('#v_score'),
            moves: LG.$('#v_moves'),
            hints: LG.$('#v_hints')
        };
    }

    // Animate a number from 0 to `to`; always lands on the exact final text.
    function countUp(node, to, format, duration) {
        var fmt = format || String;
        var startAt = performance.now();
        var done = false;

        function finish() {
            done = true;
            node.textContent = fmt(to);
        }

        function step(now) {
            if (done) {
                return;
            }
            var t = Math.min(1, (now - startAt) / duration);
            var eased = 1 - Math.pow(1 - t, 3);
            node.textContent = fmt(Math.round(to * eased));
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                finish();
            }
        }

        node.textContent = fmt(0);
        requestAnimationFrame(step);
        // rAF may be throttled in a background tab - guarantee the end value
        window.setTimeout(finish, duration + 150);
    }

    function setTag(tile, on) {
        tile.parentNode.classList.toggle('is-best', !!on);
    }

    function modeLabel(r) {
        var label = MODE_LABELS[r.mode] || MODE_LABELS.classic;
        return r.mode === 'daily' && r.seed ? label + ' · ' + r.seed : label;
    }

    function shareText(r) {
        var rows = r.rows + ' ' + LG.plural(r.rows, ['рядок', 'рядки', 'рядків']);
        return '🔢 Гра в числа — ' + modeLabel(r) + '\n' +
            '🏆 ' + rows + ' · ⏱ ' + LG.formatTime(r.timeMs) + ' · ★ ' + r.score + '\n' +
            'Спробуєш краще?';
    }

    function fallbackCopy(text) {
        var ta = LG.el('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
        return ok;
    }

    function share() {
        if (!current) {
            return;
        }
        var text = shareText(current);
        var url = /^https?:/.test(location.protocol) ? location.href : '';

        if (navigator.share) {
            navigator.share({title: 'Гра в числа', text: text, url: url || undefined})
                .catch(function () { /* user dismissed */ });
            return;
        }
        var full = url ? text + '\n' + url : text;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(full).then(function () {
                LG.toast('Результат скопійовано 📋');
            }, function () {
                LG.toast(fallbackCopy(full) ? 'Результат скопійовано 📋' : 'Не вдалося скопіювати', 'warning');
            });
        } else {
            LG.toast(fallbackCopy(full) ? 'Результат скопійовано 📋' : 'Не вдалося скопіювати', 'warning');
        }
    }

    function show(r) {
        current = r;

        els.icon.textContent = r.newRecord ? '👑' : '🏆';
        els.title.textContent = r.newRecord ? 'Новий рекорд!' : 'Перемога!';
        els.sub.textContent = modeLabel(r);
        els.badge.hidden = !r.newRecord;
        els.badge.textContent = r.beatRecord
            ? 'Попередній рекорд: ' + r.previousBest + ' ' + LG.plural(r.previousBest, ['рядок', 'рядки', 'рядків'])
            : 'Перший встановлений рекорд';

        if (r.mode === 'daily' && r.streak > 1) {
            els.streak.hidden = false;
            els.streak.textContent = '🔥 Серія: ' + r.streak + ' ' + LG.plural(r.streak, ['день', 'дні', 'днів']) + ' поспіль';
        } else {
            els.streak.hidden = true;
        }

        setTag(els.tiles.rows, r.newRecord);
        setTag(els.tiles.time, r.records && r.records.bestTime);
        setTag(els.tiles.score, r.records && r.records.bestScore);
        setTag(els.tiles.moves, false);
        setTag(els.tiles.hints, r.hints === 0);

        els.modal.scrollTop = 0;
        els.modal.classList.add('is-visible');
        countUp(els.tiles.rows, r.rows, null, 700);
        countUp(els.tiles.time, r.timeMs, LG.formatTime, 900);
        countUp(els.tiles.score, r.score, null, 1000);
        countUp(els.tiles.moves, r.moves, null, 700);
        countUp(els.tiles.hints, r.hints, null, 500);

        els.ach.innerHTML = '';
        var list = r.unlocked || [];
        els.ach.hidden = !list.length;
        list.forEach(function (def, i) {
            var chip = LG.el('div', 'victory__chip');
            chip.style.animationDelay = (0.5 + i * 0.12) + 's';
            chip.appendChild(LG.el('span', 'victory__chip-icon', def.icon));
            var txt = LG.el('span', 'victory__chip-text');
            txt.appendChild(LG.el('strong', null, def.title));
            txt.appendChild(LG.el('small', null, def.desc));
            chip.appendChild(txt);
            els.ach.appendChild(chip);
        });

        els.ok.focus();
    }

    function hide() {
        els.modal.classList.remove('is-visible');
    }

    LG.victory = {
        init: function () {
            cache();
            LG.bus.on('win', show);
            els.share.addEventListener('click', share);
            els.again.addEventListener('click', function () {
                hide();
                LG.game.restart();
            });
            els.ok.addEventListener('click', function () {
                hide();
                LG.menu.open();
            });
        },
        isOpen: function () {
            return els.modal.classList.contains('is-visible');
        },
        close: function () {
            hide();
            LG.menu.open();
        }
    };
})(window.LG);
