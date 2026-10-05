// Bootstrap: boot the modules, wire the bottom-bar overflow menu, keyboard
// shortcuts, pause/save on tab hide, and register the service worker.
(function (LG) {
    'use strict';

    // --- bottom-bar overflow menu -----------------------------------------
    function initOverflowMenu() {
        var menuBtn = LG.$('#menu_btn');
        var overflow = LG.$('#overflow_menu');

        function closeMenu() {
            overflow.classList.remove('is-open');
            menuBtn.classList.remove('is-open');
            menuBtn.setAttribute('aria-expanded', 'false');
        }

        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var willOpen = !overflow.classList.contains('is-open');
            overflow.classList.toggle('is-open', willOpen);
            menuBtn.classList.toggle('is-open', willOpen);
            menuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        document.addEventListener('click', function (e) {
            if (overflow.classList.contains('is-open') &&
                !overflow.contains(e.target) && e.target !== menuBtn) {
                closeMenu();
            }
        });

        // close after picking any one-off action (toggles stay open so the
        // label can be seen changing)
        LG.$$('.overflow-menu__item').forEach(function (item) {
            if (!item.hasAttribute('data-keep-open')) {
                item.addEventListener('click', closeMenu);
            }
        });

        LG.$('#open_menu_btn').addEventListener('click', function () {
            LG.menu.open();
        });
        LG.$('#open_settings_btn').addEventListener('click', function () {
            LG.menu.open('settings');
        });
    }

    // --- in-game toggles (sound / colours / theme) ------------------------
    function initInGameToggles() {
        var soundLabel = LG.$('#sound_toggle_label');
        var colorsLabel = LG.$('#cell_colors_toggle_label');
        var themeLabel = LG.$('#theme_toggle_label');
        var THEME_NAMES = {auto: 'Авто', light: 'Світла', dark: 'Темна'};

        function syncLabels() {
            soundLabel.textContent = 'Звук: ' + (LG.audio.isEnabled() ? 'Увімкнено' : 'Вимкнено');
            colorsLabel.textContent = 'Кольори клітинок: ' +
                (LG.settings.get('cellColors') ? 'Увімкнено' : 'Вимкнено');
            themeLabel.textContent = 'Тема: ' + THEME_NAMES[LG.settings.get('theme')];
        }

        LG.$('#sound_toggle_btn').addEventListener('click', function () {
            LG.audio.toggle();
            LG.audio.blip();
        });
        LG.$('#cell_colors_toggle_btn').addEventListener('click', function () {
            LG.settings.toggle('cellColors');
        });
        LG.$('#theme_toggle_btn').addEventListener('click', function () {
            LG.settings.cycleTheme();
        });

        LG.bus.on('settings:change', syncLabels);
        syncLabels();
    }

    // --- keyboard ---------------------------------------------------------
    // Arrows move a cursor over the open cells, Enter/Space picks the cell,
    // Z/Ctrl+Z undo, H hint, R "дописати", C "є ще?", M or Esc the menu.
    // (Keys are matched by physical position so they work on any layout.)
    function initKeyboard() {
        var ARROWS = {ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'};

        document.addEventListener('keydown', function (e) {
            if (e.altKey) {
                return;
            }
            var tag = e.target && e.target.tagName;

            // popups first
            if (LG.isConfirmOpen()) {
                if (e.key === 'Escape') {
                    LG.$('#confirm_cancel_btn').click();
                }
                return;
            }
            if (LG.victory.isOpen()) {
                if (e.key === 'Escape') {
                    LG.victory.close();
                }
                return;
            }
            if (LG.menu.isOpen()) {
                if (e.key === 'Escape' && LG.menu.back()) {
                    e.preventDefault();
                }
                return;
            }

            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                e.preventDefault();
                LG.game.undo();
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                return;
            }

            if (ARROWS[e.key]) {
                e.preventDefault();
                LG.game.moveCursor(ARROWS[e.key]);
                return;
            }

            var onButton = tag === 'BUTTON';
            switch (e.code) {
                case 'Enter':
                case 'Space':
                    if (!onButton) {
                        e.preventDefault();
                        LG.game.activateCursor();
                    }
                    break;
                case 'KeyZ':
                case 'Backspace':
                    LG.game.undo();
                    break;
                case 'KeyH':
                    LG.game.hint();
                    break;
                case 'KeyR':
                    LG.game.rewrite();
                    break;
                case 'KeyC':
                    LG.game.check();
                    break;
                case 'KeyM':
                case 'Escape':
                    LG.menu.open();
                    break;
                default:
                    break;
            }
        });
    }

    // --- persistence / lifecycle ----------------------------------------------
    // Pause the clock and flush the save whenever the page is hidden, so a
    // killed mobile tab loses nothing.
    function initLifecycle() {
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                LG.timer.pause('hidden');
                LG.game.saveNow();
            } else {
                LG.timer.resume('hidden');
            }
        });
        window.addEventListener('pagehide', function () {
            LG.game.saveNow();
        });
    }

    // --- PWA ------------------------------------------------------------------
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }
        var secure = location.protocol === 'https:' ||
            location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!secure) {
            return;
        }
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js').catch(function () { /* optional */ });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        LG.hud.init();
        LG.preview.init();
        LG.game.init();
        LG.victory.init();
        LG.menu.init();
        initOverflowMenu();
        initInGameToggles();
        initKeyboard();
        initLifecycle();
        registerServiceWorker();

        LG.menu.open();
    });
})(window.LG);
