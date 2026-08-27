// Sound manager. Short effects (close / remove a row) stay as the bundled
// mp3s; the victory fanfare is synthesised with the Web Audio API so no
// extra asset is needed. Respects the persisted on/off setting.
(function (LG) {
    'use strict';

    var enabled = LG.storage.getSound();
    var audioCtx = null;

    var CLIPS = {
        close: './audio/close.mp3',
        remove: './audio/remove.mp3'
    };

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
        a.volume = 0.2;
        a.play().catch(function () { /* autoplay blocked - ignore */ });
    }

    // One plucked note on the shared context.
    function tone(freq, startAt, duration, gainPeak, type) {
        var ctx = getCtx();
        if (!ctx) {
            return;
        }
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration + 0.02);
    }

    LG.audio = {
        isEnabled: function () {
            return enabled;
        },
        setEnabled: function (on) {
            enabled = !!on;
            LG.storage.setSound(enabled);
        },
        toggle: function () {
            this.setEnabled(!enabled);
            return enabled;
        },

        play: function (name) {
            if (enabled) {
                playClip(name);
            }
        },

        // Soft click for menu / UI taps.
        blip: function () {
            if (enabled) {
                tone(660, 0, 0.12, 0.05, 'triangle');
            }
        },

        // Rising major arpeggio, played when the whole board is cleared.
        victory: function () {
            if (!enabled) {
                return;
            }
            var notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
            for (var i = 0; i < notes.length; i++) {
                tone(notes[i], i * 0.11, 0.5, 0.09, 'triangle');
            }
            tone(1567.98, 0.44, 0.6, 0.05, 'sine'); // sparkle on top
        }
    };
})(window.LG);
