// Everything about the playfield itself: which numbers make up a level, how
// they expand into single-digit cells, rendering the <table>, the
// neighbour-walking used for matching, and reading the board back into a
// serialisable snapshot.
(function (LG) {
    'use strict';

    var COLS = 9;

    // The classic set: 1..19 with 10 left out (18 numbers). Written out
    // digit by digit this is 9 one-digit + 9 two-digit numbers = 27 cells,
    // i.e. exactly three rows - the game's starting position.
    var STANDARD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];

    function digitsFromNumbers(numbers) {
        var out = [];
        for (var i = 0; i < numbers.length; i++) {
            var n = numbers[i];
            if (n < 10) {
                out.push(n);
            } else {
                out.push(Math.floor(n / 10));
                out.push(n % 10);
            }
        }
        return out;
    }

    // --- value grouping for the optional cell background colours ----------
    var VALUE_COLOR_GROUPS = {
        1: 'value-g1', 9: 'value-g1',
        2: 'value-g2', 8: 'value-g2',
        3: 'value-g3', 7: 'value-g3',
        4: 'value-g4', 6: 'value-g4',
        5: 'value-g5'
    };

    function stripColorClasses(cell) {
        cell.classList.remove('value-g1', 'value-g2', 'value-g3', 'value-g4', 'value-g5');
    }

    // --- neighbour walking ----------------------------------------------
    // Each of these returns the nearest still-open cell in one direction,
    // skipping closed cells, with left/right wrapping across row ends.
    function prevCell(cell) {
        if (cell.previousElementSibling) {
            var c = cell.previousElementSibling;
            return c.classList.contains('close-box') ? prevCell(c) : c;
        }
        var prevRow = cell.parentElement.previousElementSibling;
        if (!prevRow) {
            return false;
        }
        var last = prevRow.children[COLS - 1];
        return last.classList.contains('close-box') ? prevCell(last) : last;
    }

    function nextCell(cell) {
        if (cell.nextElementSibling) {
            var c = cell.nextElementSibling;
            return c.classList.contains('close-box') ? nextCell(c) : c;
        }
        var nextRow = cell.parentElement.nextElementSibling;
        if (!nextRow) {
            return false;
        }
        var first = nextRow.children[0];
        return first.classList.contains('close-box') ? nextCell(first) : first;
    }

    function downCell(cell) {
        var idx = cell.cellIndex;
        var row = cell.parentElement.nextElementSibling;
        if (!row || !row.children[idx]) {
            return false;
        }
        var c = row.children[idx];
        return c.classList.contains('close-box') ? downCell(c) : c;
    }

    function upCell(cell) {
        var idx = cell.cellIndex;
        var row = cell.parentElement.previousElementSibling;
        if (!row || !row.children[idx]) {
            return false;
        }
        var c = row.children[idx];
        return c.classList.contains('close-box') ? upCell(c) : c;
    }

    var DIRECTIONS = [prevCell, nextCell, downCell, upCell];

    function isMatch(a, b) {
        if (!a || !b) {
            return false;
        }
        var av = parseInt(a.textContent, 10);
        var bv = parseInt(b.textContent, 10);
        return av === bv || av + bv === 10;
    }

    // Is `target` a legal partner for `origin` right now?
    function canPair(origin, target) {
        for (var d = 0; d < DIRECTIONS.length; d++) {
            if (DIRECTIONS[d](origin) === target && isMatch(origin, target)) {
                return true;
            }
        }
        return false;
    }

    // First available legal pair anywhere on the board, or null.
    function findMatchingPair(tbody) {
        var open = LG.$$('td:not(.close-box)', tbody);
        for (var i = 0; i < open.length; i++) {
            for (var d = 0; d < DIRECTIONS.length; d++) {
                var n = DIRECTIONS[d](open[i]);
                if (n && isMatch(open[i], n)) {
                    return [open[i], n];
                }
            }
        }
        return null;
    }

    // --- rendering -----------------------------------------------------
    // digits: number[]; closed: optional boolean[] parallel to digits.
    // Returns the freshly built <tbody>.
    function render(container, digits, closed) {
        container.innerHTML = '';
        var table = LG.el('table');
        var tbody = LG.el('tbody');

        var row = null;
        for (var i = 0; i < digits.length; i++) {
            if (i % COLS === 0) {
                row = LG.el('tr');
                tbody.appendChild(row);
            }
            var td = LG.el('td', null, String(digits[i]));
            if (closed && closed[i]) {
                td.classList.add('close-box');
            }
            row.appendChild(td);
        }

        table.appendChild(tbody);
        container.appendChild(table);
        return tbody;
    }

    function colorizeCell(cell, enabled) {
        stripColorClasses(cell);
        if (!enabled) {
            return;
        }
        var cls = VALUE_COLOR_GROUPS[parseInt(cell.textContent, 10)];
        if (cls) {
            cell.classList.add(cls);
        }
    }

    function colorizeAll(tbody, enabled) {
        LG.$$('td', tbody).forEach(function (c) {
            colorizeCell(c, enabled);
        });
    }

    // --- snapshot <-> DOM -------------------------------------------------
    function snapshot(tbody) {
        var cells = LG.$$('td', tbody);
        return {
            digits: cells.map(function (c) {
                return parseInt(c.textContent, 10);
            }),
            closed: cells.map(function (c) {
                return c.classList.contains('close-box');
            })
        };
    }

    function openCells(tbody) {
        return LG.$$('td:not(.close-box)', tbody);
    }

    LG.board = {
        COLS: COLS,
        STANDARD_NUMBERS: STANDARD_NUMBERS,

        standardDigits: function () {
            return digitsFromNumbers(STANDARD_NUMBERS);
        },
        randomDigits: function () {
            return digitsFromNumbers(LG.shuffle(STANDARD_NUMBERS));
        },

        render: render,
        colorizeCell: colorizeCell,
        colorizeAll: colorizeAll,
        snapshot: snapshot,
        openCells: openCells,

        isMatch: isMatch,
        canPair: canPair,
        findMatchingPair: findMatchingPair
    };
})(window.LG);
