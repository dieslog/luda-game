// Sound engine. Two bundled mp3 clips (close / remove) plus a palette of small
// synthesised sounds (Web Audio) so no extra assets are needed. Honours the
// "sound" and "volume" settings. Nothing here knows about game rules - the
// feedback module decides *when* each sound plays.
(function (LG) {
    'use strict';

    var audioCtx = null;

    var CLIPS = {
        close: './audio/close.mp3',
        remove: './audio/remove.mp3'
    };

    function enabled() {
        return LG.settings.get('sound');
    }

    // 0.6 (the default) is the "reference" loudness the original mix used.
    function gainScale() {
        return LG.settings.get('volume') / 0.6;
    }

    function getCtx() {
        if (audioCtx == null) {
            var Ctor = window.AudioContext || window.webkitAudioContext;
            audioCtx = Ctor ? new Ctor() : false;
        }
        // browsers start the context suspended until a user gesture
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx || null;
    }

    function playClip(name) {
        var src = CLIPS[name];
        if (!src) {
            return;
        }
        var a = new Audio(src);
        a.volume = Math.min(1, 0.2 * gainScale());
        var p = a.play();
        if (p && p.catch) {
            p.catch(function () { /* autoplay blocked - ignore */ });
        }
    }

    // One note on the shared context. `slideTo` glides the pitch.
    function tone(freq, startAt, duration, peak, type, slideTo) {
        var ctx = getCtx();
        if (!ctx) {
            return;
        }
        var t = ctx.currentTime + startAt;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
        }
        var level = Math.max(0.0002, peak * gainScale());
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(level, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.03);
    }

    // The synthesised palette. Each entry gets an optional numeric argument.
    var SYNTH = {
        tap: function () {
            tone(660, 0, 0.1, 0.05, 'triangle');
        },
        select: function () {
            tone(620, 0, 0.07, 0.045, 'sine');
        },
        deselect: function () {
            tone(430, 0, 0.07, 0.035, 'sine');
        },
        error: function () {
            tone(210, 0, 0.12, 0.06, 'triangle', 150);
            tone(170, 0.1, 0.16, 0.06, 'triangle', 120);
        },
        rewrite: function () {
            tone(260, 0, 0.3, 0.05, 'triangle', 760);
            tone(520, 0.12, 0.25, 0.03, 'sine', 1100);
        },
        undo: function () {
            tone(560, 0, 0.16, 0.045, 'triangle', 330);
        },
        hint: function () {
            tone(880, 0, 0.14, 0.05, 'sine');
            tone(1175, 0.1, 0.22, 0.05, 'sine');
        },
        // rising chime; `n` is the combo count (2..)
        combo: function (n) {
            var step = Math.min(n || 2, 8) - 2;
            var f = 523.25 * Math.pow(1.122, step);   // ~2 semitones per level
            tone(f, 0, 0.22, 0.06, 'triangle');
            tone(f * 1.5, 0.07, 0.26, 0.045, 'sine');
            tone(f * 2, 0.14, 0.3, 0.03, 'sine');
        },
        achievement: function () {
            [784, 988, 1175, 1568].forEach(function (f, i) {
                tone(f, i * 0.09, 0.4, 0.06, 'triangle');
            });
        },
        stuck: function () {
            tone(330, 0, 0.18, 0.04, 'sine');
            tone(247, 0.16, 0.26, 0.04, 'sine');
        },
        // Rising arpeggio then a sustained, bell-like chord.
        win: function () {
            var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
            notes.forEach(function (f, i) {
                tone(f, i * 0.09, 0.5, 0.075, 'triangle');
            });
            [523.25, 659.25, 783.99, 1046.5].forEach(function (f) {
                tone(f, 0.62, 1.4, 0.05, 'sine');
                tone(f * 2, 0.62, 1.0, 0.015, 'sine');
            });
        },
        record: function () {
            [1046.5, 1318.5, 1567.98, 2093].forEach(function (f, i) {
                tone(f, 1.1 + i * 0.08, 0.5, 0.04, 'sine');
            });
        }
    };

    LG.audio = {
        isEnabled: enabled,

        setEnabled: function (on) {
            LG.settings.set('sound', !!on);
        },

        toggle: function () {
            return LG.settings.toggle('sound');
        },

        // name: 'close' | 'remove' (mp3) or any SYNTH key; arg is forwarded.
        play: function (name, arg) {
            if (!enabled()) {
                return;
            }
            if (CLIPS[name]) {
                playClip(name);
            } else if (SYNTH[name]) {
                SYNTH[name](arg);
            }
        },

        // Soft click for menu / UI taps.
        blip: function () {
            this.play('tap');
        },

        // Short sample so the volume slider gives audible feedback.
        preview: function () {
            this.play('select');
        }
    };
})(window.LG);
