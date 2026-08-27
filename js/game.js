// The game controller: owns the run-time state, the board's <tbody>, the
// undo history and every player action (select a pair, undo, "дописати",
// "чи є ще?", hint, save/restore, victory).
(function (LG) {
    'use strict';

    var COLS = LG.board.COLS;

    // Row-removal timeline (ms):
    //   0 .............. cleared cells start fading in place (remove-cell kf)
    //   CELL_FADE_MS ... row is hidden, survivors below slide up (FLIP)
    //   +GAP_SLIDE_MS .. slide done
    //   ROW_REMOVE_DELAY  cleared <tr> is detached from the DOM for good
    // ROW_REMOVE_DELAY must be >= CELL_FADE_MS + GAP_SLIDE_MS.
    var CELL_FADE_MS = 620;
    var GAP_SLIDE_MS = 640;
    var ROW_REMOVE_DELAY = 1350;
    var HINT_DURATION = 1800;

    var dom = {};
    var tbody = null;

    var state = {
        active: false,
        level: 0,        // rows removed so far this game
        totalRows: 0,    // rows that have ever existed this game (the score)
        firstClick: null,
        history: [],
        cellColors: LG.storage.getCellColors()
    };

    // Undo entries are either:
    //   { type:'match',   cells:[a,b], removedRows:[{tr,anchor,timeoutId}] }
    //   { type:'rewrite', addedCells:[td...], addedRows:[tr...] }

    function cacheDom() {
        dom.field = LG.$('#field_game');
        dom.statRows = LG.$('.count-tr');       // "Рядків" - totalRows this game
        dom.statRecord = LG.$('.count-high');   // "Рекорд" - fewest rows ever
        dom.statActiveRows = LG.$('.total-active-tr');
        dom.statActiveCells = LG.$('.total-active-td');
        dom.victoryModal = LG.$('#victory_modal');
        dom.victoryText = LG.$('#victory_modal_text');
    }

    // --- lifecycle -----------------------------------------------------
    function start(digits, closed, level, totalRows) {
        // never render an already-cleared row (guards against stale saves)
        var cleaned = LG.board.dropClearedRows(digits, closed);
        digits = cleaned.digits;
        closed = cleaned.closed;

        tbody = LG.board.render(dom.field, digits, closed);

        state.active = true;
        state.firstClick = null;
        state.history = [];
        state.level = level || 0;
        state.totalRows = totalRows || Math.ceil(digits.length / COLS);

        LG.board.colorizeAll(tbody, state.cellColors);
        entranceAnimation();
        refreshStats();
        LG.preview.refresh();
        autosave();
    }

    function startNew() {
        start(LG.board.standardDigits());
        LG.toast('Нова гра');
    }

    function startRandom() {
        start(LG.board.randomDigits());
        LG.toast('Рівень згенеровано');
    }

    // Returns false when there is nothing to resume.
    function resume() {
        var snap = LG.storage.loadAuto();
        if (!snap || !snap.digits || !snap.digits.length) {
            return false;
        }
        start(snap.digits, snap.closed, snap.level || 0, snap.totalRows);
        LG.toast('Гру відновлено');
        return true;
    }

    function isActive() {
        return state.active;
    }

    // --- entrance / misc animations ----------------------------------
    function entranceAnimation() {
        var rows = LG.$$('tr', tbody);
        rows.forEach(function (row, i) {
            row.style.setProperty('--enter-delay', (i * 60) + 'ms');
            row.classList.add('row-enter');
            window.setTimeout(function () {
                row.classList.remove('row-enter');
                row.style.removeProperty('--enter-delay');
            }, 600 + i * 60);
        });
    }

    // --- selecting a pair -------------------------------------------
    function onFieldClick(e) {
        var cell = e.target;
        if (!state.active || cell.nodeName !== 'TD' || cell.classList.contains('close-box')) {
            return;
        }

        if (cell === state.firstClick) {
            cell.classList.remove('click-box');
            state.firstClick = null;
            return;
        }

        if (state.firstClick === null) {
            cell.classList.add('click-box');
            state.firstClick = cell;
            return;
        }

        if (LG.board.canPair(state.firstClick, cell) &&
            LG.board.isMatch(state.firstClick, cell)) {
            closePair(state.firstClick, cell);
        } else {
            // wrong partner: shake both for feedback, then drop the
            // selection entirely so the player starts a fresh pick.
            LG.replayAnimation(state.firstClick, 'shake', 400);
            LG.replayAnimation(cell, 'shake', 400);
            state.firstClick.classList.remove('click-box');
            state.firstClick = null;
        }
    }

    function closePair(a, b) {
        a.classList.add('close-box');
        b.classList.add('close-box');
        a.classList.remove('click-box');
        state.firstClick = null;
        LG.audio.play('close');

        var entry = {type: 'match', cells: [a, b], removedRows: []};
        state.history.push(entry);

        removeClearedRows(entry);
        refreshStats();
        autosave();
        checkVictory();
    }

    // Animate out and schedule removal of every row that just became fully
    // closed, recording enough to fully restore it on undo.
    function removeClearedRows(entry) {
        var rows = LG.$$('tr', tbody);
        var toRemove = rows.filter(function (row) {
            // skip rows already animating out from an earlier, still-pending move
            return !row.classList.contains('remove-box') &&
                !row.querySelector('td:not(.close-box)');
        });
        if (!toRemove.length) {
            return;
        }

        LG.audio.play('remove');

        toRemove.forEach(function (tr) {
            var anchor = tr.nextElementSibling;
            while (anchor && toRemove.indexOf(anchor) !== -1) {
                anchor = anchor.nextElementSibling;
            }
            tr.classList.add('remove-box');
            entry.removedRows.push({tr: tr, anchor: anchor});
            state.level += 1;
        });

        entry.timeoutIds = [
            // once the cells have faded, close the gap with a FLIP slide
            window.setTimeout(function () {
                collapseGap(toRemove);
            }, CELL_FADE_MS),
            // ...and finally detach the now-invisible, zero-space rows
            window.setTimeout(function () {
                toRemove.forEach(function (tr) {
                    tr.remove();
                });
                LG.preview.refresh();
            }, ROW_REMOVE_DELAY)
        ];

        refreshStats();
        LG.preview.refresh();
    }

    // FLIP: after the cleared rows are hidden, every surviving row below jumps
    // (invisibly) into its new position, then transitions from its old one -
    // so the rows glide up into the gap instead of snapping when the cleared
    // <tr> eventually leaves the DOM.
    function collapseGap(removingRows) {
        var survivors = LG.$$('tr', tbody).filter(function (r) {
            // leave rows that are themselves fading out (a near-simultaneous
            // clear) for their own collapseGap to handle
            return removingRows.indexOf(r) === -1 && !r.classList.contains('remove-box');
        });
        var firstTops = survivors.map(function (r) {
            return r.getBoundingClientRect().top;
        });

        removingRows.forEach(function (r) {
            r.style.display = 'none';
        });

        var moved = [];
        survivors.forEach(function (r, i) {
            var delta = firstTops[i] - r.getBoundingClientRect().top;
            if (!delta) {
                return;
            }
            r.style.transition = 'none';
            r.style.transform = 'translateY(' + delta + 'px)';
            moved.push(r);
        });
        if (!moved.length) {
            return;
        }

        // Force a reflow so the offset above is committed as the transition's
        // starting point, then transition back to zero. (A rAF here would be
        // throttled while the tab isn't compositing; this isn't.)
        void tbody.offsetHeight;

        moved.forEach(function (r) {
            r.style.transition = 'transform ' + GAP_SLIDE_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
            r.style.transform = '';
        });
        window.setTimeout(function () {
            moved.forEach(clearRowSlide);
        }, GAP_SLIDE_MS + 40);
    }

    function clearRowSlide(row) {
        row.style.transition = '';
        row.style.transform = '';
    }

    // --- undo -------------------------------------------------------
    function undo() {
        var last = state.history.pop();
        if (!last) {
            return;
        }

        if (last.type === 'rewrite') {
            last.addedRows.slice().reverse().forEach(function (r) {
                r.remove();
            });
            last.addedCells.slice().reverse().forEach(function (c) {
                c.remove();
            });
            state.totalRows -= last.addedRows.length;
            refreshStats();
            LG.preview.refresh();
            autosave();
            return;
        }

        (last.timeoutIds || []).forEach(window.clearTimeout);

        last.removedRows.forEach(function (r) {
            r.tr.classList.remove('remove-box');
            r.tr.style.display = '';          // undo a phase-2 hide
            if (!r.tr.parentNode) {           // undo a phase-3 detach
                if (r.anchor && r.anchor.parentNode === tbody) {
                    tbody.insertBefore(r.tr, r.anchor);
                } else {
                    tbody.appendChild(r.tr);
                }
            }
            LG.replayAnimation(r.tr, 'restore-row', 400);
            state.level = Math.max(0, state.level - 1);
        });

        // neutralise any in-flight FLIP slide on the surviving rows
        LG.$$('tr', tbody).forEach(clearRowSlide);

        last.cells.forEach(function (cell) {
            cell.classList.remove('close-box');
            LG.replayAnimation(cell, 'restore-highlight', 550);
        });

        refreshStats();
        LG.preview.refresh();
        autosave();
    }

    // --- "дописати" ------------------------------------------------
    function rewrite() {
        var open = LG.board.openCells(tbody);
        if (!open.length) {
            LG.toast('Поле вже повністю закрите 🎉');
            return;
        }

        // Background check: if legal moves remain, make the player confirm -
        // "дописати" is meant for a genuine dead end.
        if (LG.board.findMatchingPair(tbody)) {
            LG.confirm(
                'Ще є доступні ходи. Точно дописати числа в нові рядки?',
                doRewrite,
                {okText: 'Так, дописати', cancelText: 'Ще пошукаю'}
            );
            return;
        }
        doRewrite();
    }

    function doRewrite() {
        var open = LG.board.openCells(tbody);
        if (!open.length) {
            return;
        }

        var addedCells = [];
        var addedRows = [];
        var lastRow = tbody.querySelector('tr:last-child');
        var pending = LG.el('tr');

        for (var i = 0; i < open.length; i++) {
            var td = LG.el('td', null, open[i].textContent);
            if (lastRow && lastRow.children.length < COLS) {
                lastRow.appendChild(td);
                addedCells.push(td);
            } else {
                pending.appendChild(td);
                if (pending.children.length === COLS || i === open.length - 1) {
                    tbody.appendChild(pending);
                    addedRows.push(pending);
                    pending = LG.el('tr');
                }
            }
        }

        state.history.push({type: 'rewrite', addedCells: addedCells, addedRows: addedRows});
        state.totalRows += addedRows.length;

        addedCells.forEach(function (c) {
            LG.board.colorizeCell(c, state.cellColors);
        });
        addedRows.forEach(function (row, idx) {
            Array.prototype.forEach.call(row.children, function (c) {
                LG.board.colorizeCell(c, state.cellColors);
            });
            row.style.setProperty('--enter-delay', (idx * 60) + 'ms');
            LG.replayAnimation(row, 'row-enter', 600 + idx * 60);
        });

        refreshStats();
        LG.preview.refresh();
        autosave();
    }

    // --- "чи є ще?" / hint ---------------------------------------
    function check() {
        if (!LG.board.openCells(tbody).length) {
            return;
        }
        if (LG.board.findMatchingPair(tbody)) {
            LG.toast('Так, ще є ходи');
        } else {
            LG.toast('Ні, більше немає — тисни «Дописати»', 'warning');
        }
    }

    function hint() {
        if (!LG.board.openCells(tbody).length) {
            return;
        }
        var pair = LG.board.findMatchingPair(tbody);
        if (!pair) {
            LG.toast('Ні, більше немає — тисни «Дописати»', 'warning');
            return;
        }
        pair.forEach(function (cell) {
            cell.classList.add('hint-box');
            window.setTimeout(function () {
                cell.classList.remove('hint-box');
            }, HINT_DURATION);
        });
    }

    // --- manual checkpoint --------------------------------------
    function currentSnapshot() {
        var snap = LG.board.snapshot(tbody);
        snap.level = state.level;
        snap.totalRows = state.totalRows;
        return snap;
    }

    function saveCheckpoint() {
        if (!LG.board.snapshot(tbody).digits.length) {
            return;
        }
        LG.storage.saveCheckpoint(currentSnapshot());
        LG.toast('Збережено');
    }

    function restoreCheckpoint() {
        if (!LG.storage.hasCheckpoint()) {
            LG.toast('Немає збереженого поля', 'warning');
            return;
        }
        LG.confirm('Відновити збережене поле? Поточний прогрес буде втрачено.', function () {
            var snap = LG.storage.loadCheckpoint();
            start(snap.digits, snap.closed, snap.level || 0, snap.totalRows);
            LG.toast('Відновлено');
        });
    }

    function autosave() {
        if (!state.active) {
            return;
        }
        LG.storage.saveAuto(currentSnapshot());
    }

    // --- stats -----------------------------------------------------
    function setStat(node, value) {
        var str = String(value);
        if (node.textContent !== str) {
            node.textContent = str;
            LG.replayAnimation(node, 'stat-pop', 320);
        }
    }

    function refreshStats() {
        setStat(dom.statRows, state.totalRows);
        var best = LG.storage.getBestRows();
        dom.statRecord.textContent = best == null ? '—' : String(best);
        setStat(dom.statActiveRows, LG.$$('tr', tbody).length);
        setStat(dom.statActiveCells, LG.board.openCells(tbody).length);
    }

    // --- victory ------------------------------------------------
    function checkVictory() {
        if (LG.board.openCells(tbody).length) {
            return;
        }
        state.active = false;
        LG.storage.clearAuto();

        var isRecord = LG.storage.reportFinishedRows(state.totalRows);
        refreshStats();

        window.setTimeout(function () {
            LG.confetti.burst(160);
            LG.audio.victory();
            dom.victoryText.textContent = isRecord
                ? 'Новий рекорд! Ви закрили все поле за ' + state.totalRows + ' рядків.'
                : 'Вітаємо! Ви закрили все поле за ' + state.totalRows + ' рядків.';
            dom.victoryModal.classList.add('is-visible');
        }, ROW_REMOVE_DELAY);
    }

    function setCellColors(on) {
        state.cellColors = on;
        LG.storage.setCellColors(on);
        if (tbody) {
            LG.board.colorizeAll(tbody, on);
        }
    }

    function getTbody() {
        return tbody;
    }

    function init() {
        cacheDom();
        dom.field.addEventListener('click', onFieldClick);

        LG.$('.back').addEventListener('click', undo);
        LG.$('.rewrite-btn').addEventListener('click', rewrite);
        LG.$('.check-btn').addEventListener('click', check);
        LG.$('.save-btn').addEventListener('click', saveCheckpoint);
        LG.$('.hint-btn').addEventListener('click', hint);
        LG.$('.restore-btn').addEventListener('click', restoreCheckpoint);

        LG.$('#victory_ok_btn').addEventListener('click', function () {
            dom.victoryModal.classList.remove('is-visible');
            LG.menu.open();
        });

        // Warn before a reload/close would drop an in-progress game.
        window.addEventListener('beforeunload', function (e) {
            if (state.active) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    LG.game = {
        init: init,
        startNew: startNew,
        startRandom: startRandom,
        resume: resume,
        isActive: isActive,
        setCellColors: setCellColors,
        getTbody: getTbody
    };
})(window.LG);
