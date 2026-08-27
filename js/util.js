// Shared namespace + small DOM/UX helpers used across the other modules.
// Kept dependency-free (plain <script>, no bundler) so the game still runs
// straight from the filesystem.
window.LG = window.LG || {};

(function (LG) {
    'use strict';

    // --- tiny DOM helpers ---------------------------------------------------
    LG.$ = function (selector, root) {
        return (root || document).querySelector(selector);
    };
    LG.$$ = function (selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    };
    LG.el = function (tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text != null) {
            node.textContent = text;
        }
        return node;
    };

    // Fisher-Yates, returns a new array.
    LG.shuffle = function (list) {
        var copy = list.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    };

    // Restart a CSS animation that may already be on the element.
    LG.replayAnimation = function (node, className, duration) {
        node.classList.remove(className);
        // force reflow so re-adding the class restarts the animation
        void node.offsetWidth;
        node.classList.add(className);
        if (duration) {
            window.setTimeout(function () {
                node.classList.remove(className);
            }, duration);
        }
    };

    // --- lightweight toast (replaces toastr + jQuery) ---------------------
    var toastHost = null;

    function ensureToastHost() {
        if (!toastHost) {
            toastHost = LG.el('div', 'lg-toast-host');
            document.body.appendChild(toastHost);
        }
        return toastHost;
    }

    var lastToastText = '';
    var lastToastAt = 0;

    LG.toast = function (message, type) {
        var now = Date.now();
        // de-dupe identical messages fired in quick succession
        if (message === lastToastText && now - lastToastAt < 1200) {
            return;
        }
        lastToastText = message;
        lastToastAt = now;

        var host = ensureToastHost();
        var node = LG.el('div', 'lg-toast lg-toast--' + (type || 'success'), message);
        host.appendChild(node);

        // enter on next frame so the transition runs
        requestAnimationFrame(function () {
            node.classList.add('is-in');
        });

        window.setTimeout(function () {
            node.classList.remove('is-in');
            window.setTimeout(function () {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }, 250);
        }, 2000);
    };

    // --- reusable yes/no confirmation popup -------------------------------
    // Resolves nothing; takes an onConfirm callback (kept callback-style to
    // match the rest of the codebase and avoid needing Promises everywhere).
    LG.confirm = function (message, onConfirm, opts) {
        opts = opts || {};
        var overlay = LG.$('#confirm_modal');
        var textNode = LG.$('#confirm_modal_text');
        var okBtn = LG.$('#confirm_ok_btn');
        var cancelBtn = LG.$('#confirm_cancel_btn');

        textNode.textContent = message;
        okBtn.textContent = opts.okText || 'Так, продовжити';
        cancelBtn.textContent = opts.cancelText || 'Скасувати';
        overlay.classList.add('is-visible');

        function cleanup() {
            overlay.classList.remove('is-visible');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        }

        function onOk() {
            cleanup();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        }

        function onCancel() {
            cleanup();
            if (typeof opts.onCancel === 'function') {
                opts.onCancel();
            }
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    };
})(window.LG);
