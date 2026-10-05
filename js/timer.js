// Game clock. Counts only while a game is active AND nothing has paused it:
// the menu being open, the tab being hidden, ... each pause reason is tracked
// separately so they can overlap safely. Emits 'timer:tick' once a second.
(function (LG) {
    'use strict';

    var elapsed = 0;       // ms accumulated so far
    var lastTs = null;     // performance.now() when the clock last started running
    var intervalId = null;
    var active = false;
    var reasons = {};

    function paused() {
        for (var k in reasons) {
            if (reasons[k]) {
                return true;
            }
        }
        return false;
    }

    // Fold the running time since the last checkpoint into `elapsed`.
    function accumulate() {
        if (lastTs !== null) {
            var now = performance.now();
            var delta = now - lastTs;
            elapsed += delta;
            lastTs = now;
            return delta;
        }
        return 0;
    }

    function tick() {
        var delta = accumulate();
        LG.bus.emit('timer:tick', {elapsed: elapsed, delta: delta});
    }

    // Start or stop the underlying interval to match active/paused state.
    function reconcile() {
        var shouldRun = active && !paused();
        if (shouldRun && lastTs === null) {
            lastTs = performance.now();
            intervalId = window.setInterval(tick, 1000);
        } else if (!shouldRun && lastTs !== null) {
            accumulate();
            lastTs = null;
            window.clearInterval(intervalId);
            intervalId = null;
        }
    }

    LG.timer = {
        // Begin timing a game, optionally continuing from `initialMs`.
        start: function (initialMs) {
            elapsed = initialMs || 0;
            active = true;
            lastTs = null;
            window.clearInterval(intervalId);
            intervalId = null;
            reconcile();
            LG.bus.emit('timer:tick', {elapsed: elapsed, delta: 0});
        },

        // Game finished/abandoned: freeze and return the final time.
        stop: function () {
            accumulate();
            active = false;
            reconcile();
            return elapsed;
        },

        pause: function (reason) {
            reasons[reason] = true;
            reconcile();
        },

        resume: function (reason) {
            reasons[reason] = false;
            reconcile();
        },

        get: function () {
            accumulate();
            return elapsed;
        },

        isRunning: function () {
            return lastTs !== null;
        }
    };
})(window.LG);
