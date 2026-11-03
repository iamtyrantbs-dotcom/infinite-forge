// ============================================================================
// INFINITE FORGE - PARTICLES & CANVAS VISUAL FX ENGINE
// ============================================================================

class ParticleEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.particles = [];
        this.floatingTexts = [];
        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loop();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawnSparks(x, y, count = 20, color = '#ff9900') {
        if (!this.ctx) return;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2.5,
                color,
                size: Math.random() * 3.5 + 1.5,
                alpha: 1.0,
                decay: Math.random() * 0.035 + 0.015,
                gravity: 0.3
            });
        }
    }

    spawnCriticalSparks(x, y, color = '#ffcc00') {
        this.spawnSparks(x, y, 45, color);
        // 추가 거대 충격파 원형 파티클
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * 16,
                vy: Math.sin(angle) * 16,
                color: '#fff',
                size: 4,
                alpha: 1.0,
                decay: 0.04,
                gravity: 0.05
            });
        }
    }

    spawnFloatingText(x, y, text, color = '#ffb703', size = '1.3rem') {
        const el = document.createElement('div');
        el.className = 'floating-hit';
        el.innerText = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.color = color;
        el.style.fontSize = size;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    loop() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        requestAnimationFrame(() => this.loop());
    }
}

window.ParticleEngine = ParticleEngine;
