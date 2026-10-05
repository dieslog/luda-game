// Two layout concerns for the fixed top/bottom bars:
//   1. reserve page padding so the bars never cover the board's first/last row;
//   2. the "nearest active cells" strip that slides in under the stats once
//      real cells have scrolled up behind the bar - for each of the 9 columns
//      it shows whichever still-open cell is closest to the viewport.
(function (LG) {
    'use strict';

    var COLS = LG.board.COLS;
    var PAGE_SPACING_BUFFER = 16;
    // Treat a row as "gone behind the bar" this many pixels before its bottom
    // edge actually reaches the bar, so the pinned strip updates a touch ahead
    // of the real row leaving view instead of lagging behind it.
    var EARLY_REVEAL_PX = 10;

    var els = {};
    var lastSignature = null;
    var rafId = null;

    function cache() {
        els.topBar = LG.$('#top_bar');
        els.stats = LG.$('#top_bar_stats');
        els.preview = LG.$('#pinned_row_preview');
        els.previewRow = LG.$('.pinned-row-preview__row');
        els.bottomBar = LG.$('#bottom_bar');
    }

    function adjustSpacing() {
        document.body.style.paddingTop = (els.stats.offsetHeight + PAGE_SPACING_BUFFER) + 'px';
        document.body.style.paddingBottom = (els.bottomBar.offsetHeight + PAGE_SPACING_BUFFER) + 'px';
        // lets the floating combo chip sit just above the bottom bar
        document.documentElement.style.setProperty('--bottom-bar-h', els.bottomBar.offsetHeight + 'px');
        // ...and toasts sit just under the stats strip instead of covering it
        document.documentElement.style.setProperty('--stats-h', els.stats.offsetHeight + 'px');
    }

    function update() {
        var tbody = LG.game.getTbody && LG.game.getTbody();
        if (!tbody || (window.scrollY || window.pageYOffset || 0) <= 0) {
            els.preview.classList.remove('is-visible');
            lastSignature = null;
            return;
        }

        var nearestByColumn = new Array(COLS).fill(null);
        var anyHidden = false;
        // Compare against the *stats* height only (what's actually reserved),
        // plus a generous buffer so the swap happens before a cell slides under.
        var barHeight = els.stats.offsetHeight + 72 + EARLY_REVEAL_PX;

        LG.$$('tr', tbody).forEach(function (row) {
            if (row.getBoundingClientRect().bottom > barHeight) {
                return;
            }
            anyHidden = true;
            Array.prototype.forEach.call(row.children, function (cell) {
                if (!cell.classList.contains('close-box')) {
                    nearestByColumn[cell.cellIndex] = cell.textContent;
                }
            });
        });

        if (!anyHidden || nearestByColumn.every(function (v) { return v === null; })) {
            els.preview.classList.remove('is-visible');
            lastSignature = null;
            return;
        }

        var signature = nearestByColumn.join(',');
        if (signature !== lastSignature) {
            els.previewRow.innerHTML = '';
            var table = LG.el('table');
            var tb = LG.el('tbody');
            var tr = LG.el('tr');
            nearestByColumn.forEach(function (value) {
                var td = LG.el('td');
                if (value === null) {
                    td.classList.add('empty-slot');
                } else {
                    td.textContent = value;
                }
                tr.appendChild(td);
            });
            tb.appendChild(tr);
            table.appendChild(tb);
            els.previewRow.appendChild(table);
            lastSignature = signature;
        }

        els.preview.classList.add('is-visible');
    }

    function refresh() {
        if (rafId !== null) {
            return;
        }
        rafId = requestAnimationFrame(function () {
            rafId = null;
            update();
        });
    }

    function init() {
        cache();
        adjustSpacing();
        window.addEventListener('scroll', refresh, {passive: true});
        window.addEventListener('resize', refresh);
        window.addEventListener('resize', adjustSpacing);
        window.addEventListener('load', adjustSpacing);
        // the stats strip can change height (e.g. wrapping on a narrow screen)
        if (window.ResizeObserver) {
            new ResizeObserver(adjustSpacing).observe(els.stats);
            new ResizeObserver(adjustSpacing).observe(els.bottomBar);
        }
    }

    LG.preview = {
        init: init,
        refresh: refresh,
        adjustSpacing: adjustSpacing
    };
})(window.LG);
