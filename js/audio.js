// ============================================================================
// INFINITE FORGE - SOUND & AUDIO SYNTHESIZER ENGINE (Web Audio API)
// ============================================================================

const SoundFX = {
    ctx: null,
    muted: false,

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        const btn = document.getElementById('sound-btn');
        if (btn) {
            btn.innerText = this.muted ? '🔇' : '🔊';
            btn.style.opacity = this.muted ? '0.5' : '1';
        }
        return this.muted;
    },

    // 1. 모루 타격음 (금속 챙~하는 타격감 + 망치 충격음)
    playAnvilHit(isCritical = false) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const baseFreq = isCritical ? 1150 : 880;

        // 메탈릭 클랑 (Triangle Oscillator)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isCritical ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + (isCritical ? 0.22 : 0.14));

        gain.gain.setValueAtTime(isCritical ? 0.28 : 0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.25 : 0.16));

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + (isCritical ? 0.26 : 0.17));

        // 저음 충격 베이스 (Heavy Sine Thud)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(isCritical ? 180 : 130, now);
        subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

        subGain.gain.setValueAtTime(isCritical ? 0.35 : 0.22, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.14);
    },

    // 2. 업그레이드 및 일반 구매 성공음
    playBuySound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [587.33, 880.0]; // D5, A5
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.12, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.16);
        });
    },

    // 3. 무기 완성 차임벨 (성공 코드 화음)
    playCraftComplete() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const chord = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
        chord.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);
            gain.gain.setValueAtTime(0.14, now + idx * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.38);
        });
    },

    // 4. 고티어 전설 컷신 개시 팡파르
    playLegendaryFanfare() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const fanfareNotes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
        fanfareNotes.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + idx * 0.09);
            gain.gain.setValueAtTime(0.2, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.65);
        });
    },

    // 5. 무기 판매 및 분해 찰랑 사운드 (Coin jingle)
    playCoinSound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const pitches = [987.77, 1318.51, 1567.98];
        pitches.forEach((p, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(p, now + idx * 0.04);
            gain.gain.setValueAtTime(0.12, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.13);
        });
    }
};

window.SoundFX = SoundFX;
