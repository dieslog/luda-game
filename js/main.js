// Bootstrap: wire the bottom-bar overflow menu and the mid-game toggles,
// boot the sub-modules, and show the main menu on load.
(function (LG) {
    'use strict';

    function initOverflowMenu() {
        var menuBtn = LG.$('#menu_btn');
        var overflow = LG.$('#overflow_menu');

        function closeMenu() {
            overflow.classList.remove('is-open');
            menuBtn.classList.remove('is-open');
        }

        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var willOpen = !overflow.classList.contains('is-open');
            overflow.classList.toggle('is-open', willOpen);
            menuBtn.classList.toggle('is-open', willOpen);
        });

        document.addEventListener('click', function (e) {
            if (overflow.classList.contains('is-open') &&
                !overflow.contains(e.target) && e.target !== menuBtn) {
                closeMenu();
            }
        });

        // close after picking any leaf action
        LG.$$('.overflow-menu__item').forEach(function (item) {
            if (item.id !== 'sound_toggle_btn' && item.id !== 'cell_colors_toggle_btn') {
                item.addEventListener('click', closeMenu);
            }
        });

        LG.$('#open_menu_btn').addEventListener('click', function () {
            closeMenu();
            LG.menu.open();
        });
    }

    function initInGameToggles() {
        var soundLabel = LG.$('#sound_toggle_label');
        var colorsLabel = LG.$('#cell_colors_toggle_label');

        function syncLabels() {
            soundLabel.textContent = 'Звук: ' + (LG.audio.isEnabled() ? 'Увімкнено' : 'Вимкнено');
            colorsLabel.textContent = 'Кольори клітинок: ' +
                (LG.storage.getCellColors() ? 'Увімкнено' : 'Вимкнено');
        }

        LG.$('#sound_toggle_btn').addEventListener('click', function () {
            LG.audio.toggle();
            LG.audio.blip();
            syncLabels();
            LG.menu.syncDynamic();
        });

        LG.$('#cell_colors_toggle_btn').addEventListener('click', function () {
            LG.game.setCellColors(!LG.storage.getCellColors());
            syncLabels();
            LG.menu.syncDynamic();
        });

        syncLabels();
    }

    document.addEventListener('DOMContentLoaded', function () {
        LG.preview.init();
        LG.game.init();
        LG.menu.init();
        initOverflowMenu();
        initInGameToggles();

        LG.menu.open();
    });
})(window.LG);
