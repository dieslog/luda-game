// Self-contained confetti burst on a full-screen <canvas>. No dependencies.
// LG.confetti.burst() can be called repeatedly; the canvas and RAF loop are
// created lazily and torn down once every particle has settled.
(function (LG) {
    'use strict';

    var COLORS = ['#f94144', '#f3722c', '#f8961e', '#f9c74f',
        '#90be6d', '#43aa8b', '#577590', '#c77dff'];

    var canvas = null;
    var ctx = null;
    var particles = [];
    var rafId = null;

    function ensureCanvas() {
        if (canvas) {
            return;
        }
        canvas = LG.el('canvas', 'confetti-canvas');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) {
            return;
        }
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function spawn(count) {
        var cx = window.innerWidth / 2;
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            var speed = 6 + Math.random() * 9;
            particles.push({
                x: cx + (Math.random() - 0.5) * 120,
                y: window.innerHeight * 0.32,
                vx: Math.cos(angle) * speed * (0.4 + Math.random()),
                vy: Math.sin(angle) * speed - (4 + Math.random() * 4),
                w: 6 + Math.random() * 6,
                h: 8 + Math.random() * 8,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.3,
                color: COLORS[(Math.random() * COLORS.length) | 0],
                life: 1
            });
        }
    }

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.vy += 0.28;             // gravity
            p.vx *= 0.99;             // drag
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            if (p.y > canvas.height * 0.62) {
                p.life -= 0.02;      // fade once it has fallen far enough
            }
            if (p.life <= 0 || p.y > canvas.height + 40) {
                particles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }

        if (particles.length) {
            rafId = requestAnimationFrame(frame);
        } else {
            rafId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    LG.confetti = {
        burst: function (count) {
            ensureCanvas();
            spawn(count || 140);
            if (rafId == null) {
                rafId = requestAnimationFrame(frame);
            }
        }
    };
})(window.LG);
