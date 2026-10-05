// The game controller: owns the run-time state, the board's <tbody>, the
// undo history and every player action (select a pair, undo, "дописати",
// "чи є ще?", hint, save/restore, victory).
//
// It talks to the rest of the app through the event bus (LG.bus): it emits
// 'game:start', 'select', 'deselect', 'error', 'match', 'rows:cleared',
// 'rewrite', 'undo', 'hint', 'stuck', 'state' and 'win'; sound, vibration,
// statistics, achievements and the HUD all subscribe from their own modules.
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
        mode: 'classic',   // 'classic' | 'random' | 'daily'
        seed: null,        // date key for daily levels
        level: 0,          // rows removed so far this game
        totalRows: 0,      // rows that have ever existed this game (the score)
        moves: 0,          // pairs currently closed (net of undo)
        hints: 0,
        undos: 0,
        rewrites: 0,
        firstClick: null,  // currently selected cell
        cursor: null,      // keyboard cursor cell
        partners: [],      // cells highlighted by the "assist" setting
        stuck: false,      // no legal pair left
        history: []
    };

    // Undo entries are either:
    //   { type:'match',   cells:[a,b], gained, removedRows:[{tr,anchor}], timeoutIds }
    //   { type:'rewrite', addedCells:[td...], addedRows:[tr...] }

    function cacheDom() {
        dom.field = LG.$('#field_game');
        dom.rewriteBtn = LG.$('.rewrite-btn');
        dom.topBar = LG.$('#top_bar');
        dom.bottomBar = LG.$('#bottom_bar');
    }

    // --- lifecycle -----------------------------------------------------
    // opts: { digits, closed?, level?, totalRows?, mode?, seed?, elapsed?,
    //         score?, moves?, hints?, undos?, rewrites?, resumed? }
    function start(opts) {
        // never render an already-cleared row (guards against stale saves)
        var cleaned = LG.board.dropClearedRows(opts.digits, opts.closed);

        tbody = LG.board.render(dom.field, cleaned.digits, cleaned.closed);

        state.active = true;
        state.mode = opts.mode || 'classic';
        state.seed = opts.seed || null;
        state.firstClick = null;
        state.cursor = null;
        state.partners = [];
        state.history = [];
        state.stuck = false;
        state.level = opts.level || 0;
        state.totalRows = opts.totalRows || Math.ceil(cleaned.digits.length / COLS);
        state.moves = opts.moves || 0;
        state.hints = opts.hints || 0;
        state.undos = opts.undos || 0;
        state.rewrites = opts.rewrites || 0;

        LG.score.reset(opts.score || 0);
        LG.timer.start(opts.elapsed || 0);

        LG.board.colorizeAll(tbody, LG.settings.get('cellColors'));
        dom.rewriteBtn.classList.remove('is-stuck');
        window.scrollTo(0, 0);
        entranceAnimation();
        refreshStats();
        LG.preview.refresh();
        updateStuck(true);
        saveNow();

        LG.bus.emit('game:start', {mode: state.mode, seed: state.seed, resumed: !!opts.resumed});
    }

    function toastForMode(mode) {
        if (mode === 'daily') {
            return 'Щоденний виклик';
        }
        return mode === 'random' ? 'Рівень згенеровано' : 'Нова гра';
    }

    // mode: 'classic' (fixed order) | 'random' | 'daily'
    function startNew(mode) {
        mode = mode || 'classic';
        var seed = mode === 'daily' ? LG.rng.dayKey() : null;
        start({digits: LG.board.digitsFor(mode, seed), mode: mode, seed: seed});
        LG.toast(toastForMode(mode));
    }

    // Start over in whatever mode was played last.
    function restart() {
        startNew(state.mode);
    }

    function fromSnapshot(snap, resumed) {
        start({
            digits: snap.digits,
            closed: snap.closed,
            level: snap.level,
            totalRows: snap.totalRows,
            mode: snap.mode,
            seed: snap.seed,
            elapsed: snap.elapsed,
            score: snap.score,
            moves: snap.moves,
            hints: snap.hints,
            undos: snap.undos,
            rewrites: snap.rewrites,
            resumed: resumed
        });
    }

    // Returns false when there is nothing to resume.
    function resume() {
        var snap = LG.storage.loadAuto();
        if (!snap || !snap.digits || !snap.digits.length) {
            return false;
        }
        fromSnapshot(snap, true);
        LG.toast('Гру відновлено');
        return true;
    }

    // Summary of the autosave for the menu's "Продовжити" button.
    function describeSave() {
        var snap = LG.storage.loadAuto();
        if (!snap || !snap.digits || !snap.digits.length) {
            return null;
        }
        var open = 0;
        for (var i = 0; i < snap.digits.length; i++) {
            if (!(snap.closed && snap.closed[i])) {
                open++;
            }
        }
        return {
            mode: snap.mode || 'classic',
            elapsed: snap.elapsed || 0,
            totalRows: snap.totalRows || Math.ceil(snap.digits.length / COLS),
            score: snap.score || 0,
            open: open
        };
    }

    function isActive() {
        return state.active;
    }

    function getMode() {
        return state.mode;
    }

    // --- entrance animation ----------------------------------------------
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

    // --- scrolling helpers -----------------------------------------------
    // The part of the viewport not covered by the fixed top/bottom bars.
    function visibleBand() {
        return {
            top: dom.topBar.getBoundingClientRect().bottom + 8,
            bottom: dom.bottomBar.getBoundingClientRect().top - 8
        };
    }

    // Smoothly scroll so the given cells are inside the visible band.
    function ensureVisible(cells) {
        var band = visibleBand();
        var rects = cells.map(function (c) {
            return c.getBoundingClientRect();
        });
        var top = Math.min.apply(null, rects.map(function (r) { return r.top; }));
        var bottom = Math.max.apply(null, rects.map(function (r) { return r.bottom; }));
        if (top >= band.top && bottom <= band.bottom) {
            return;
        }
        var target = (bottom - top <= band.bottom - band.top)
            ? (top + bottom) / 2
            : (rects[0].top + rects[0].bottom) / 2;
        window.scrollBy({top: target - (band.top + band.bottom) / 2, behavior: 'smooth'});
    }

    // --- selection -----------------------------------------------------
    function clearPartners() {
        state.partners.forEach(function (c) {
            c.classList.remove('partner-box');
        });
        state.partners = [];
    }

    function showPartners(cell) {
        clearPartners();
        if (!LG.settings.get('assist')) {
            return;
        }
        state.partners = LG.board.partnersOf(cell);
        state.partners.forEach(function (c) {
            c.classList.add('partner-box');
        });
    }

    function select(cell) {
        cell.classList.add('click-box');
        state.firstClick = cell;
        showPartners(cell);
        LG.bus.emit('select', {cell: cell});
    }

    function deselect(silent) {
        if (!state.firstClick) {
            return;
        }
        state.firstClick.classList.remove('click-box');
        state.firstClick = null;
        clearPartners();
        if (!silent) {
            LG.bus.emit('deselect');
        }
    }

    function onFieldClick(e) {
        var cell = e.target;
        if (!state.active || cell.nodeName !== 'TD' || cell.classList.contains('close-box')) {
            return;
        }

        if (cell === state.firstClick) {
            deselect();
            return;
        }

        if (state.firstClick === null) {
            select(cell);
            return;
        }

        var first = state.firstClick;
        if (LG.board.canPair(first, cell) && LG.board.isMatch(first, cell)) {
            closePair(first, cell);
        } else {
            // wrong partner: shake both for feedback, then drop the
            // selection entirely so the player starts a fresh pick.
            LG.replayAnimation(first, 'shake', 400);
            LG.replayAnimation(cell, 'shake', 400);
            deselect(true);
            LG.bus.emit('error', {a: first, b: cell});
        }
    }

    function closePair(a, b) {
        a.classList.add('close-box');
        b.classList.add('close-box');
        a.classList.remove('click-box');
        state.firstClick = null;
        clearPartners();
        state.moves += 1;

        var entry = {type: 'match', cells: [a, b], gained: 0, removedRows: []};
        state.history.push(entry);

        var rowsCleared = removeClearedRows(entry);
        var result = LG.score.registerMatch(rowsCleared);
        entry.gained = result.gained;

        LG.bus.emit('match', {
            cells: [a, b],
            gained: result.gained,
            combo: result.combo,
            multiplier: result.multiplier,
            rowsCleared: rowsCleared
        });
        if (rowsCleared) {
            LG.bus.emit('rows:cleared', {count: rowsCleared});
        }

        refreshStats();
        saveNow();
        if (!checkVictory()) {
            updateStuck();
        }
    }

    // Animate out and schedule removal of every row that just became fully
    // closed, recording enough to fully restore it on undo. Returns how many
    // rows were cleared by this move.
    function removeClearedRows(entry) {
        var rows = LG.$$('tr', tbody);
        var toRemove = rows.filter(function (row) {
            // skip rows already animating out from an earlier, still-pending move
            return !row.classList.contains('remove-box') &&
                !row.querySelector('td:not(.close-box)');
        });
        if (!toRemove.length) {
            return 0;
        }

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

        LG.preview.refresh();
        return toRemove.length;
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
        if (!state.active) {
            return;
        }
        var last = state.history.pop();
        if (!last) {
            LG.toast('Немає що скасовувати', 'warning', 1400);
            return;
        }
        deselect(true);
        state.undos += 1;

        if (last.type === 'rewrite') {
            last.addedRows.slice().reverse().forEach(function (r) {
                r.remove();
            });
            last.addedCells.slice().reverse().forEach(function (c) {
                c.remove();
            });
            state.totalRows -= last.addedRows.length;
            state.rewrites = Math.max(0, state.rewrites - 1);
        } else {
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

            state.moves = Math.max(0, state.moves - 1);
            LG.score.revert(last.gained);
        }

        LG.bus.emit('undo', {type: last.type});
        refreshStats();
        LG.preview.refresh();
        saveNow();
        updateStuck();
    }

    // --- "дописати" ------------------------------------------------
    function rewrite() {
        if (!state.active) {
            return;
        }
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

        deselect(true);
        var colors = LG.settings.get('cellColors');
        var addedCells = [];
        var addedRows = [];
        var lastRow = tbody.querySelector('tr:last-child');
        var pending = LG.el('tr');
        pending.setAttribute('role', 'row');

        for (var i = 0; i < open.length; i++) {
            var td = LG.el('td', null, open[i].textContent);
            td.setAttribute('role', 'gridcell');
            if (lastRow && lastRow.children.length < COLS) {
                lastRow.appendChild(td);
                addedCells.push(td);
            } else {
                pending.appendChild(td);
                if (pending.children.length === COLS || i === open.length - 1) {
                    tbody.appendChild(pending);
                    addedRows.push(pending);
                    pending = LG.el('tr');
                    pending.setAttribute('role', 'row');
                }
            }
        }

        state.history.push({type: 'rewrite', addedCells: addedCells, addedRows: addedRows});
        state.totalRows += addedRows.length;
        state.rewrites += 1;

        addedCells.forEach(function (c) {
            LG.board.colorizeCell(c, colors);
        });
        addedRows.forEach(function (row, idx) {
            Array.prototype.forEach.call(row.children, function (c) {
                LG.board.colorizeCell(c, colors);
            });
            row.style.setProperty('--enter-delay', (idx * 60) + 'ms');
            LG.replayAnimation(row, 'row-enter', 600 + idx * 60);
        });

        LG.bus.emit('rewrite', {addedRows: addedRows.length});
        refreshStats();
        LG.preview.refresh();
        saveNow();
        updateStuck();

        // bring the freshly appended rows into view
        if (addedRows.length) {
            window.setTimeout(function () {
                ensureVisible([addedRows[0].children[0]]);
            }, 120);
        }
    }

    // --- "чи є ще?" / hint ---------------------------------------
    function check() {
        if (!state.active || !LG.board.openCells(tbody).length) {
            return;
        }
        if (LG.board.findMatchingPair(tbody)) {
            LG.toast('Так, ще є ходи');
        } else {
            LG.toast('Ні, більше немає — тисни «Дописати»', 'warning');
        }
    }

    function hint() {
        if (!state.active || !LG.board.openCells(tbody).length) {
            return;
        }
        var pair = LG.board.findMatchingPair(tbody);
        if (!pair) {
            LG.toast('Ні, більше немає — тисни «Дописати»', 'warning');
            return;
        }
        state.hints += 1;
        ensureVisible(pair);
        pair.forEach(function (cell) {
            cell.classList.add('hint-box');
            window.setTimeout(function () {
                cell.classList.remove('hint-box');
            }, HINT_DURATION);
        });
        LG.bus.emit('hint', {pair: pair});
    }

    // --- "stuck" detection ----------------------------------------
    // When no legal pair is left the "Дописати" button starts to pulse (and a
    // one-off toast explains why), nudging the player toward the next step.
    function updateStuck(silent) {
        if (!tbody) {
            return;
        }
        var stuck = LG.board.openCells(tbody).length > 0 && !LG.board.findMatchingPair(tbody);
        if (stuck === state.stuck) {
            return;
        }
        state.stuck = stuck;
        dom.rewriteBtn.classList.toggle('is-stuck', stuck);
        if (stuck && !silent) {
            LG.toast('Ходів більше немає — натисніть «Дописати»', 'warning', 2600);
            LG.bus.emit('stuck');
        }
    }

    // --- persistence ---------------------------------------------
    function currentSnapshot() {
        var snap = LG.board.snapshot(tbody);
        snap.v = 2;
        snap.level = state.level;
        snap.totalRows = state.totalRows;
        snap.mode = state.mode;
        snap.seed = state.seed;
        snap.elapsed = Math.round(LG.timer.get());
        snap.score = LG.score.get();
        snap.moves = state.moves;
        snap.hints = state.hints;
        snap.undos = state.undos;
        snap.rewrites = state.rewrites;
        return snap;
    }

    // Write the autosave (and flush statistics). Called after every move, when
    // the menu opens and when the page is hidden/closed.
    function saveNow() {
        if (!state.active || !tbody) {
            return;
        }
        var snap = currentSnapshot();
        if (snap.digits.length) {
            LG.storage.saveAuto(snap);
        }
        LG.stats.flush();
    }

    function saveCheckpoint() {
        if (!state.active || !tbody) {
            return;
        }
        var snap = currentSnapshot();
        if (!snap.digits.length) {
            return;
        }
        LG.storage.saveCheckpoint(snap);
        LG.toast('Збережено');
    }

    function restoreCheckpoint() {
        if (!LG.storage.hasCheckpoint()) {
            LG.toast('Немає збереженого поля', 'warning');
            return;
        }
        LG.confirm('Відновити збережене поле? Поточний прогрес буде втрачено.', function () {
            fromSnapshot(LG.storage.loadCheckpoint(), true);
            LG.toast('Відновлено');
        });
    }

    // --- stats ---------------------------------------------------
    function refreshStats() {
        LG.bus.emit('state', {
            totalRows: state.totalRows,
            bestRows: LG.storage.getBestRows(),
            activeRows: LG.$$('tr:not(.remove-box)', tbody).length,
            activeCells: LG.board.openCells(tbody).length,
            score: LG.score.get()
        });
    }

    // --- victory ------------------------------------------------
    // Returns true when the board is fully cleared.
    function checkVictory() {
        if (LG.board.openCells(tbody).length) {
            return false;
        }
        state.active = false;
        var timeMs = Math.round(LG.timer.stop());
        LG.storage.clearAuto();

        var previousBest = LG.storage.getBestRows();
        var newRecord = LG.storage.reportFinishedRows(state.totalRows);

        var result = {
            mode: state.mode,
            seed: state.seed,
            rows: state.totalRows,
            timeMs: timeMs,
            score: LG.score.get(),
            moves: state.moves,
            hints: state.hints,
            undos: state.undos,
            rewrites: state.rewrites,
            maxCombo: LG.score.getBestCombo(),
            newRecord: newRecord,
            previousBest: previousBest,
            beatRecord: newRecord && previousBest != null
        };
        result.records = LG.stats.onWin(result);
        result.streak = result.records.streak;
        result.unlocked = LG.achievements.checkWin({
            rows: result.rows,
            timeMs: result.timeMs,
            hints: result.hints,
            mode: result.mode,
            streak: result.streak,
            beatRecord: result.beatRecord
        });

        refreshStats();

        // wait for the last row's removal animation before celebrating
        window.setTimeout(function () {
            LG.bus.emit('win', result);
        }, ROW_REMOVE_DELAY);
        return true;
    }

    // --- keyboard cursor --------------------------------------------
    function setCursor(cell) {
        if (state.cursor) {
            state.cursor.classList.remove('kbd-cursor');
        }
        state.cursor = cell || null;
        if (cell) {
            cell.classList.add('kbd-cursor');
            ensureVisible([cell]);
        }
    }

    function firstOpenInView() {
        var band = visibleBand();
        var open = LG.board.openCells(tbody);
        for (var i = 0; i < open.length; i++) {
            var r = open[i].getBoundingClientRect();
            if (r.top >= band.top && r.bottom <= band.bottom) {
                return open[i];
            }
        }
        return open[0] || null;
    }

    // dir: 'left' | 'right' | 'up' | 'down'
    function moveCursor(dir) {
        if (!state.active) {
            return;
        }
        var c = state.cursor;
        if (!c || !c.isConnected || c.classList.contains('close-box')) {
            setCursor(firstOpenInView());
            return;
        }
        var n = LG.board.neighbour(c, dir);
        if (n) {
            setCursor(n);
        }
    }

    // Same as clicking the cell under the keyboard cursor.
    function activateCursor() {
        var c = state.cursor;
        if (state.active && c && c.isConnected && !c.classList.contains('close-box')) {
            c.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        }
    }

    function clearCursor() {
        setCursor(null);
    }

    // --- settings reactions ------------------------------------------
    LG.bus.on('settings:change', function (e) {
        if (!tbody) {
            return;
        }
        if (e.key === 'cellColors') {
            LG.board.colorizeAll(tbody, e.value);
        } else if (e.key === 'assist') {
            if (e.value && state.firstClick) {
                showPartners(state.firstClick);
            } else {
                clearPartners();
            }
        }
    });

    function getTbody() {
        return tbody;
    }

    function init() {
        cacheDom();
        dom.field.addEventListener('click', onFieldClick);
        // touching/clicking the board hands control back from the keyboard cursor
        dom.field.addEventListener('pointerdown', clearCursor);

        LG.$('.back').addEventListener('click', undo);
        dom.rewriteBtn.addEventListener('click', rewrite);
        LG.$('.check-btn').addEventListener('click', check);
        LG.$('.save-btn').addEventListener('click', saveCheckpoint);
        LG.$('.hint-btn').addEventListener('click', hint);
        LG.$('.restore-btn').addEventListener('click', restoreCheckpoint);
    }

    LG.game = {
        init: init,
        startNew: startNew,
        restart: restart,
        resume: resume,
        describeSave: describeSave,
        isActive: isActive,
        getMode: getMode,
        getTbody: getTbody,

        undo: undo,
        rewrite: rewrite,
        hint: hint,
        check: check,
        saveNow: saveNow,
        // re-publish the HUD numbers (e.g. after the record was reset)
        refresh: function () {
            if (tbody) {
                refreshStats();
            }
        },

        moveCursor: moveCursor,
        activateCursor: activateCursor,
        clearCursor: clearCursor
    };
})(window.LG);
