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

    // Fisher-Yates, returns a new array. `rng` is optional (defaults to
    // Math.random) so seeded levels (daily challenge) can reuse it.
    LG.shuffle = function (list, rng) {
        var rand = rng || Math.random;
        var copy = list.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(rand() * (i + 1));
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

    // --- formatting ---------------------------------------------------------
    // 83000 -> "01:23", 3725000 -> "1:02:05"
    LG.formatTime = function (ms) {
        var total = Math.max(0, Math.floor((ms || 0) / 1000));
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        var mm = (m < 10 ? '0' : '') + m;
        var ss = (s < 10 ? '0' : '') + s;
        return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
    };

    // Ukrainian plural form: LG.plural(3, ['рядок', 'рядки', 'рядків'])
    LG.plural = function (n, forms) {
        var mod10 = n % 10;
        var mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) {
            return forms[0];
        }
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            return forms[1];
        }
        return forms[2];
    };

    // --- tiny pub/sub --------------------------------------------------
    // The game core emits events (match, error, win, ...) and independent
    // modules (sound, haptics, stats, achievements, HUD) react to them, so
    // game.js never has to know who is listening.
    LG.bus = (function () {
        var handlers = {};
        return {
            on: function (name, fn) {
                (handlers[name] = handlers[name] || []).push(fn);
                return function () {
                    LG.bus.off(name, fn);
                };
            },
            off: function (name, fn) {
                var list = handlers[name];
                if (!list) {
                    return;
                }
                var i = list.indexOf(fn);
                if (i !== -1) {
                    list.splice(i, 1);
                }
            },
            emit: function (name, payload) {
                (handlers[name] || []).slice().forEach(function (fn) {
                    try {
                        fn(payload);
                    } catch (e) {
                        if (window.console) {
                            console.error('[bus:' + name + ']', e);
                        }
                    }
                });
            }
        };
    })();

    // --- lightweight toast ---------------------------------------------
    var toastHost = null;

    function ensureToastHost() {
        if (!toastHost) {
            toastHost = LG.el('div', 'lg-toast-host');
            toastHost.setAttribute('role', 'status');
            toastHost.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastHost);
        }
        return toastHost;
    }

    var lastToastText = '';
    var lastToastAt = 0;

    // type: 'success' | 'warning' | 'award'
    LG.toast = function (message, type, duration) {
        var now = Date.now();
        // de-dupe identical messages fired in quick succession
        if (message === lastToastText && now - lastToastAt < 1200) {
            return;
        }
        lastToastText = message;
        lastToastAt = now;

        var host = ensureToastHost();
        // keep the stack short: drop the oldest when a 4th arrives
        while (host.children.length >= 3) {
            host.removeChild(host.firstChild);
        }
        var node = LG.el('div', 'lg-toast lg-toast--' + (type || 'success'), message);
        host.appendChild(node);

        // enter on next frame so the transition runs
        requestAnimationFrame(function () {
            node.classList.add('is-in');
        });
        // rAF can be throttled while the tab isn't compositing - make sure
        // the toast still becomes visible.
        window.setTimeout(function () {
            node.classList.add('is-in');
        }, 50);

        window.setTimeout(function () {
            node.classList.remove('is-in');
            window.setTimeout(function () {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }, 250);
        }, duration || 2000);
    };

    // --- reusable yes/no confirmation popup -------------------------------
    // Callback-style to match the rest of the codebase.
    LG.confirm = function (message, onConfirm, opts) {
        opts = opts || {};
        var overlay = LG.$('#confirm_modal');
        var textNode = LG.$('#confirm_modal_text');
        var okBtn = LG.$('#confirm_ok_btn');
        var cancelBtn = LG.$('#confirm_cancel_btn');

        textNode.textContent = message;
        okBtn.textContent = opts.okText || 'Так, продовжити';
        cancelBtn.textContent = opts.cancelText || 'Скасувати';
        okBtn.classList.toggle('modal-box__btn--danger', !!opts.danger);
        overlay.classList.add('is-visible');
        okBtn.focus();

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

    LG.isConfirmOpen = function () {
        return LG.$('#confirm_modal').classList.contains('is-visible');
    };
})(window.LG);
