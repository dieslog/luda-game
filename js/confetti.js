// Self-contained confetti on a full-screen <canvas>. No dependencies.
// burst() fires one cloud from a point; celebrate() chains several bursts
// (centre, then side cannons) for the victory moment. The canvas and RAF loop
// are created lazily and torn down once every particle has settled.
(function (LG) {
    'use strict';

    var COLORS = ['#f94144', '#f3722c', '#f8961e', '#f9c74f',
        '#90be6d', '#43aa8b', '#577590', '#c77dff'];
    var GOLD = ['#ffd166', '#ffb703', '#fb8500', '#fff3b0', '#ffe066'];

    var canvas = null;
    var ctx = null;
    var particles = [];
    var rafId = null;

    function ensureCanvas() {
        if (canvas) {
            return;
        }
        canvas = LG.el('canvas', 'confetti-canvas');
        canvas.setAttribute('aria-hidden', 'true');
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

    // opts: { x, y (0..1 of the viewport), count, spread (radians),
    //         angle (radians, centre direction), power, palette }
    function spawn(opts) {
        var w = window.innerWidth;
        var h = window.innerHeight;
        var palette = opts.palette || COLORS;
        var count = opts.count || 120;
        var spread = opts.spread == null ? Math.PI * 2 : opts.spread;
        var angle = opts.angle == null ? -Math.PI / 2 : opts.angle;
        var power = opts.power || 1;

        for (var i = 0; i < count; i++) {
            var a = angle + (Math.random() - 0.5) * spread;
            var speed = (6 + Math.random() * 10) * power;
            particles.push({
                x: (opts.x == null ? 0.5 : opts.x) * w + (Math.random() - 0.5) * 40,
                y: (opts.y == null ? 0.35 : opts.y) * h,
                vx: Math.cos(a) * speed * (0.5 + Math.random() * 0.8),
                vy: Math.sin(a) * speed * (0.5 + Math.random() * 0.8),
                w: 6 + Math.random() * 6,
                h: 8 + Math.random() * 8,
                round: Math.random() < 0.3,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.35,
                wobble: Math.random() * Math.PI * 2,
                color: palette[(Math.random() * palette.length) | 0],
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
            p.wobble += 0.12;
            p.x += p.vx + Math.sin(p.wobble) * 0.6;
            p.y += p.vy;
            p.rot += p.vr;
            if (p.y > canvas.height * 0.62) {
                p.life -= 0.018;      // fade once it has fallen far enough
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
            if (p.round) {
                ctx.beginPath();
                ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            }
            ctx.restore();
        }

        if (particles.length) {
            rafId = requestAnimationFrame(frame);
        } else {
            rafId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function start() {
        if (rafId == null) {
            rafId = requestAnimationFrame(frame);
        }
    }

    LG.confetti = {
        burst: function (opts) {
            ensureCanvas();
            spawn(typeof opts === 'number' ? {count: opts} : (opts || {}));
            start();
        },

        // Big multi-stage celebration. `record` makes it golden and longer.
        celebrate: function (record) {
            var palette = record ? GOLD.concat(COLORS) : COLORS;
            this.burst({count: record ? 190 : 150, palette: palette});
            window.setTimeout(function () {
                LG.confetti.burst({x: 0.04, y: 0.78, angle: -Math.PI / 3, spread: 0.9,
                    count: 70, power: 1.25, palette: palette});
                LG.confetti.burst({x: 0.96, y: 0.78, angle: -Math.PI * 2 / 3, spread: 0.9,
                    count: 70, power: 1.25, palette: palette});
            }, 320);
            if (record) {
                window.setTimeout(function () {
                    LG.confetti.burst({count: 140, y: 0.25, palette: GOLD});
                }, 900);
            }
        }
    };
})(window.LG);
