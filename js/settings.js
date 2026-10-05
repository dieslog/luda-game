// User preferences: one persisted object, change notifications over the bus,
// and the theme (light / dark / follow the system) applied to <html>.
(function (LG) {
    'use strict';

    var DEFAULTS = {
        sound: true,
        volume: 0.6,        // 0..1 master volume for every sound
        vibration: true,
        cellColors: true,
        assist: false,      // highlight possible partners of the selected cell
        theme: 'auto'       // 'auto' | 'light' | 'dark'
    };

    var values = load();

    function load() {
        var saved = LG.storage.readJSON(LG.storage.KEYS.settings);
        var out = {};
        var k;
        for (k in DEFAULTS) {
            out[k] = DEFAULTS[k];
        }
        if (saved) {
            for (k in DEFAULTS) {
                if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) {
                    out[k] = saved[k];
                }
            }
        } else {
            // migrate the pre-settings individual keys
            var legacySound = LG.storage.readRaw(LG.storage.KEYS.legacySound);
            var legacyColors = LG.storage.readRaw(LG.storage.KEYS.legacyColors);
            if (legacySound === '0') {
                out.sound = false;
            }
            if (legacyColors === '0') {
                out.cellColors = false;
            }
        }
        return out;
    }

    function persist() {
        LG.storage.writeJSON(LG.storage.KEYS.settings, values);
    }

    var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function resolveTheme() {
        if (values.theme === 'light' || values.theme === 'dark') {
            return values.theme;
        }
        return darkQuery && darkQuery.matches ? 'dark' : 'light';
    }

    function applyTheme() {
        var theme = resolveTheme();
        document.documentElement.setAttribute('data-theme', theme);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#12161b' : '#f3f5f7');
        }
    }

    if (darkQuery) {
        var onSystemChange = function () {
            if (values.theme === 'auto') {
                applyTheme();
            }
        };
        if (darkQuery.addEventListener) {
            darkQuery.addEventListener('change', onSystemChange);
        } else if (darkQuery.addListener) {
            darkQuery.addListener(onSystemChange);
        }
    }

    LG.settings = {
        DEFAULTS: DEFAULTS,

        get: function (key) {
            return values[key];
        },

        set: function (key, value) {
            if (!(key in DEFAULTS) || values[key] === value) {
                return;
            }
            values[key] = value;
            persist();
            if (key === 'theme') {
                applyTheme();
            }
            LG.bus.emit('settings:change', {key: key, value: value});
        },

        toggle: function (key) {
            this.set(key, !values[key]);
            return values[key];
        },

        cycleTheme: function () {
            var order = ['auto', 'light', 'dark'];
            var next = order[(order.indexOf(values.theme) + 1) % order.length];
            this.set('theme', next);
            return next;
        },

        applyTheme: applyTheme
    };

    applyTheme();
})(window.LG);
