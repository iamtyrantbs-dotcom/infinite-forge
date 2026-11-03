// ==========================================
// INFINITE FORGE ENGINE
// ==========================================

const gameState = {
    gold: 0,
    ore: 20,
    flame: 0,
    hammerClicks: 0,
    forgeProgress: 0,
    currentWeaponIndex: 0,
    currentEnhancement: 0,
    activeRune: null,
    autoHammer: false,
    
    // Upgrades
    upgrades: {
        hammerPower: 0,
        anvilQuality: 0,
        bellowsSpeed: 0,
        oreMagnet: 0
    },

    // Dungeons
    dungeons: {
        goblinCave: 0,
        dragonLair: 0,
        abyssalRift: 0
    },

    // Stats
    totalWeaponsForged: 0,
    bestWeaponTier: 0
};

// ---------------- WEAPON ROSTER ----------------
const WEAPONS = [
    { id: 'w1', name: 'Rusty Dagger', icon: '🗡️', basePower: 10, rarityRate: '1/1', tier: 'Common', color: '#aaaaaa' },
    { id: 'w2', name: 'Iron Broadsword', icon: '⚔️', basePower: 35, rarityRate: '1/5', tier: 'Uncommon', color: '#4ade80' },
    { id: 'w3', name: 'Obsidian Cleaver', icon: '🪓', basePower: 120, rarityRate: '1/25', tier: 'Rare', color: '#38bdf8' },
    { id: 'w4', name: 'Sunforged Halberd', icon: '🔱', basePower: 450, rarityRate: '1/150', tier: 'Epic', color: '#a855f7' },
    { id: 'w5', name: 'Dragonbone Katana', icon: '⚡', basePower: 1800, rarityRate: '1/1,000', tier: 'Legendary', color: '#f59e0b', cutscene: true },
    { id: 'w6', name: 'Astral Voidblade', icon: '🌌', basePower: 7500, rarityRate: '1/10,000', tier: 'Mythic', color: '#ec4899', cutscene: true },
    { id: 'w7', name: 'Ragnarok Sovereign', icon: '🌋', basePower: 35000, rarityRate: '1/100,000', tier: 'Godly', color: '#ef4444', cutscene: true }
];

// ---------------- RUNES POOL (RNG) ----------------
const RUNES = [
    { id: 'r1', name: 'Fiery Spark', prefix: 'Blazing', boost: 1.5, weight: 60, color: '#ff7700', desc: '+50% Attack Power' },
    { id: 'r2', name: 'Ether Flow', prefix: 'Flowing', boost: 2.2, weight: 25, color: '#00e5ff', desc: '+120% Attack Power & +1 Ore/s' },
    { id: 'r3', name: 'Void Strike', prefix: 'Abyssal', boost: 4.5, weight: 10, color: '#a855f7', desc: '+350% Attack Power' },
    { id: 'r4', name: 'Primordial Genesis', prefix: 'God-Slayer', boost: 12.0, weight: 4.5, color: '#ffcc00', desc: '+1100% Attack Power & Gold Doubler', cutscene: true },
    { id: 'r5', name: 'Singularity Core', prefix: 'Infinite', boost: 50.0, weight: 0.5, color: '#ff0055', desc: '+4900% Attack Power', cutscene: true }
];

// ---------------- UPGRADES DATA ----------------
const UPGRADES_DEF = [
    { id: 'hammerPower', title: 'Heavy Hammer', desc: '+1 Hammering Progress per strike', baseCost: 15, costMul: 1.35, val: 1 },
    { id: 'anvilQuality', title: 'Mithril Anvil', desc: '+15% Weapon Gold Salvage Value', baseCost: 50, costMul: 1.4, val: 0.15 },
    { id: 'bellowsSpeed', title: 'Infernal Bellows', desc: 'Auto-hammers every 0.8s', baseCost: 120, costMul: 1.5, val: 1 },
    { id: 'oreMagnet', title: 'Ether Siphon', desc: '+5% chance to extract Ether Ore on hammer', baseCost: 200, costMul: 1.6, val: 0.05 }
];

// ---------------- DUNGEONS DATA ----------------
const DUNGEONS_DEF = [
    { id: 'goblinCave', name: 'Goblin Cavern', reqPower: 20, goldPerSec: 5, orePerSec: 0.2, cost: 50 },
    { id: 'dragonLair', name: 'Dragon Peak', reqPower: 500, goldPerSec: 65, orePerSec: 1.5, cost: 800 },
    { id: 'abyssalRift', name: 'Abyssal Rift', reqPower: 5000, goldPerSec: 850, orePerSec: 8.0, cost: 10000 }
];

// ---------------- AUDIO SYNTH (Procedural Sound FX) ----------------
const SoundFX = {
    ctx: null,
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
    },
    playAnvilHit() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Metallic Clang (High Sin + Triangle)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    },
    playSuccessChord() {
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const now = this.ctx.currentTime + (i * 0.08);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        });
    }
};

// ---------------- CANVAS SPARKS & PARTICLES ----------------
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class SparkParticle {
    constructor(x, y, color = '#ff8800') {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 12 - 2;
        this.alpha = 1;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.decay = Math.random() * 0.03 + 0.015;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.25; // gravity
        this.alpha -= this.decay;
    }
    draw(context) {
        context.save();
        context.globalAlpha = Math.max(0, this.alpha);
        context.fillStyle = this.color;
        context.shadowColor = this.color;
        context.shadowBlur = 10;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
}

function spawnSparks(x, y, count = 20, color = '#ff8800') {
    for (let i = 0; i < count; i++) {
        particles.push(new SparkParticle(x, y, color));
    }
}

function updateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.alpha <= 0) particles.splice(i, 1);
    }
    requestAnimationFrame(updateParticles);
}
updateParticles();

// ---------------- CORE GAMEPLAY LOGIC ----------------
function getGlobalFlameMultiplier() {
    return 1 + (gameState.flame * 0.1);
}

function getHammerProgressPower() {
    return 10 + (gameState.upgrades.hammerPower * 5);
}

function getCurrentWeapon() {
    return WEAPONS[gameState.currentWeaponIndex];
}

function calculateWeaponPower() {
    const baseW = getCurrentWeapon();
    const runeBoost = gameState.activeRune ? gameState.activeRune.boost : 1.0;
    const flameMult = getGlobalFlameMultiplier();
    return Math.floor(baseW.basePower * runeBoost * flameMult * (1 + gameState.currentEnhancement * 0.25));
}

function calculateSalvageGold() {
    const power = calculateWeaponPower();
    const qualBonus = 1 + (gameState.upgrades.anvilQuality * 0.15);
    return Math.floor(power * 2.5 * qualBonus);
}

function strikeAnvil(e) {
    SoundFX.init();
    SoundFX.playAnvilHit();

    gameState.hammerClicks++;
    const progressGain = getHammerProgressPower();
    gameState.forgeProgress += progressGain;

    // Sparks visual
    const rect = document.getElementById('anvil-btn').getBoundingClientRect();
    const clickX = e ? e.clientX : rect.left + rect.width / 2;
    const clickY = e ? e.clientY : rect.top + rect.height / 2;
    spawnSparks(clickX, clickY, 18, '#ff9900');

    // Float hit number
    createHitNumber(clickX, clickY, `+${progressGain}%`);

    // Ore Magnet check
    const oreChance = gameState.upgrades.oreMagnet * 0.05;
    if (Math.random() < oreChance) {
        gameState.ore += 1;
        createHitNumber(clickX, clickY - 30, '+1 💎', '#00e5ff');
    }

    // Complete weapon crafting
    if (gameState.forgeProgress >= 100) {
        completeWeaponCrafting();
    }

    updateUI();
}

function completeWeaponCrafting() {
    gameState.forgeProgress = 0;
    gameState.totalWeaponsForged++;
    SoundFX.playSuccessChord();

    // Roll for next weapon tier chance (RNG)
    const roll = Math.random();
    let newIndex = 0;
    if (roll < 0.0001 && WEAPONS.length > 6) newIndex = 6; // Godly
    else if (roll < 0.001 && WEAPONS.length > 5) newIndex = 5; // Mythic
    else if (roll < 0.01 && WEAPONS.length > 4) newIndex = 4; // Legendary
    else if (roll < 0.06 && WEAPONS.length > 3) newIndex = 3; // Epic
    else if (roll < 0.25 && WEAPONS.length > 2) newIndex = 2; // Rare
    else if (roll < 0.60 && WEAPONS.length > 1) newIndex = 1; // Uncommon
    else newIndex = 0; // Common

    gameState.currentWeaponIndex = newIndex;
    gameState.currentEnhancement = Math.floor(Math.random() * 5); // +0 to +4 random quality

    const w = getCurrentWeapon();
    if (newIndex > gameState.bestWeaponTier) {
        gameState.bestWeaponTier = newIndex;
    }

    // Trigger Cutscene for high tiers
    if (w.cutscene || newIndex >= 4) {
        triggerWeaponCutscene(w);
    }
}

function triggerWeaponCutscene(weapon) {
    const overlay = document.getElementById('cutscene-overlay');
    const titleEl = document.getElementById('cs-weapon-name');
    const rarityEl = document.getElementById('cs-weapon-rarity');
    const symEl = document.getElementById('cs-weapon-symbol');
    const glowEl = document.getElementById('cs-glow');

    titleEl.innerText = `${weapon.name} +${gameState.currentEnhancement}`;
    titleEl.style.color = weapon.color;
    rarityEl.innerText = `Rarity Rate: ${weapon.rarityRate}`;
    symEl.innerText = weapon.icon;
    glowEl.style.background = weapon.color;

    overlay.classList.remove('hidden');
    spawnSparks(window.innerWidth / 2, window.innerHeight / 2, 60, weapon.color);

    overlay.onclick = () => {
        overlay.classList.add('hidden');
    };
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 4500);
}

function salvageWeapon() {
    const goldEarned = calculateSalvageGold();
    gameState.gold += goldEarned;

    // Reset current weapon back to standard
    gameState.currentWeaponIndex = 0;
    gameState.currentEnhancement = 0;
    gameState.activeRune = null;
    gameState.forgeProgress = 0;

    SoundFX.playSuccessChord();
    updateUI();
}

function rollRune() {
    const cost = 50;
    if (gameState.ore < cost) return;
    gameState.ore -= cost;

    // Weighted random selection
    const totalWeight = RUNES.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = RUNES[0];

    for (const rune of RUNES) {
        if (rand < rune.weight) {
            selected = rune;
            break;
        }
        rand -= rune.weight;
    }

    gameState.activeRune = selected;
    SoundFX.playSuccessChord();
    spawnSparks(window.innerWidth / 2, window.innerHeight / 2, 35, selected.color);

    if (selected.cutscene) {
        triggerRuneCutscene(selected);
    }

    updateUI();
}

function triggerRuneCutscene(rune) {
    const overlay = document.getElementById('cutscene-overlay');
    const titleEl = document.getElementById('cs-weapon-name');
    const rarityEl = document.getElementById('cs-weapon-rarity');
    const symEl = document.getElementById('cs-weapon-symbol');
    const glowEl = document.getElementById('cs-glow');

    titleEl.innerText = `${rune.prefix} Inscription`;
    titleEl.style.color = rune.color;
    rarityEl.innerText = `${rune.desc}`;
    symEl.innerText = '🔮';
    glowEl.style.background = rune.color;

    overlay.classList.remove('hidden');
    overlay.onclick = () => overlay.classList.add('hidden');
    setTimeout(() => overlay.classList.add('hidden'), 4000);
}

function createHitNumber(x, y, text, color = '#ffb703') {
    const div = document.createElement('div');
    div.className = 'floating-hit';
    div.innerText = text;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.color = color;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 600);
}

// ---------------- UI & RENDERING ----------------
function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return Math.floor(num).toLocaleString();
}

function updateUI() {
    // Header Currencies
    document.getElementById('disp-gold').innerText = formatNumber(gameState.gold);
    document.getElementById('disp-ore').innerText = formatNumber(gameState.ore);
    document.getElementById('disp-flame').innerText = formatNumber(gameState.flame);

    // Weapon Card
    const w = getCurrentWeapon();
    const pwr = calculateWeaponPower();
    const runePrefix = gameState.activeRune ? `${gameState.activeRune.prefix} ` : '';
    const enhanceStr = gameState.currentEnhancement > 0 ? ` +${gameState.currentEnhancement}` : '';

    const nameEl = document.getElementById('weapon-name');
    nameEl.innerText = `${runePrefix}${w.name}${enhanceStr}`;
    nameEl.style.color = gameState.activeRune ? gameState.activeRune.color : w.color;

    document.getElementById('weapon-icon').innerText = w.icon;
    document.getElementById('weapon-tier-badge').innerText = w.tier;
    document.getElementById('weapon-tier-badge').style.borderColor = w.color;
    document.getElementById('weapon-power').innerText = formatNumber(pwr);
    document.getElementById('weapon-rarity-rate').innerText = w.rarityRate;
    document.getElementById('weapon-multiplier').innerText = `x${getGlobalFlameMultiplier().toFixed(2)} Mult`;

    // Progress
    const pct = Math.min(100, Math.floor(gameState.forgeProgress));
    document.getElementById('forge-pct').innerText = `${pct}%`;
    document.getElementById('forge-bar').style.width = `${pct}%`;

    // Salvage Button
    document.getElementById('salvage-gold-preview').innerText = formatNumber(calculateSalvageGold());

    // Rune Card
    if (gameState.activeRune) {
        document.getElementById('active-rune-name').innerText = gameState.activeRune.name;
        document.getElementById('active-rune-name').style.color = gameState.activeRune.color;
        document.getElementById('active-rune-desc').innerText = gameState.activeRune.desc;
    } else {
        document.getElementById('active-rune-name').innerText = 'No Rune Attached';
        document.getElementById('active-rune-name').style.color = '#fff';
        document.getElementById('active-rune-desc').innerText = '에테르 광석을 소모해 고대 룬을 추출하세요.';
    }
    document.getElementById('roll-rune-btn').disabled = gameState.ore < 50;

    // Upgrades List
    renderUpgrades();

    // Expeditions
    renderDungeons();

    // Ascension / Rebirth
    const pendingFlames = Math.floor(Math.sqrt(gameState.gold / 5000));
    document.getElementById('pending-flames').innerText = `+${pendingFlames} 🔥`;
    document.getElementById('current-flame-mult').innerText = `x${getGlobalFlameMultiplier().toFixed(2)}`;
    document.getElementById('ascend-btn').disabled = pendingFlames <= 0;
}

function renderUpgrades() {
    const container = document.getElementById('upgrades-list');
    container.innerHTML = '';

    UPGRADES_DEF.forEach(def => {
        const lvl = gameState.upgrades[def.id] || 0;
        const cost = Math.floor(def.baseCost * Math.pow(def.costMul, lvl));
        const canBuy = gameState.gold >= cost;

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div class="upg-info">
                <span class="upg-title">${def.title}</span>
                <span class="upg-desc">${def.desc}</span>
                <span class="upg-level">Level ${lvl}</span>
            </div>
            <button class="buy-upg-btn" ${canBuy ? '' : 'disabled'} onclick="buyUpgrade('${def.id}', ${cost})">
                ${formatNumber(cost)} 🪙
            </button>
        `;
        container.appendChild(card);
    });
}

function buyUpgrade(id, cost) {
    if (gameState.gold < cost) return;
    gameState.gold -= cost;
    gameState.upgrades[id] = (gameState.upgrades[id] || 0) + 1;
    SoundFX.playSuccessChord();
    updateUI();
}

function renderDungeons() {
    const container = document.getElementById('dungeon-list');
    container.innerHTML = '';

    const currentPwr = calculateWeaponPower();
    let totalGoldPerSec = 0;
    let totalOrePerSec = 0;

    DUNGEONS_DEF.forEach(d => {
        const unlocked = gameState.dungeons[d.id] > 0;
        const canUnlock = gameState.gold >= d.cost && currentPwr >= d.reqPower;

        if (unlocked) {
            totalGoldPerSec += d.goldPerSec;
            totalOrePerSec += d.orePerSec;
        }

        const card = document.createElement('div');
        card.className = `upgrade-card ${unlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
            <div class="upg-info">
                <span class="upg-title">${d.name} ${unlocked ? '⚔️ [Active]' : '🔒'}</span>
                <span class="upg-desc">Req: ${d.reqPower} Power | Gives +${d.goldPerSec} Gold/s, +${d.orePerSec} Ore/s</span>
            </div>
            ${unlocked ? '<span style="color:#00ffaa; font-size:0.85rem; font-weight:bold;">EXPLORING</span>' : `
                <button class="buy-upg-btn" ${canUnlock ? '' : 'disabled'} onclick="unlockDungeon('${d.id}', ${d.cost})">
                    ${formatNumber(d.cost)} 🪙
                </button>
            `}
        `;
        container.appendChild(card);
    });

    document.getElementById('exp-total-dps').innerText = formatNumber(currentPwr);
    document.getElementById('exp-passive-income').innerText = `+${formatNumber(totalGoldPerSec)} Gold/s`;
    document.getElementById('exp-passive-ore').innerText = `+${totalOrePerSec.toFixed(1)} Ore/s`;
}

function unlockDungeon(id, cost) {
    if (gameState.gold < cost) return;
    gameState.gold -= cost;
    gameState.dungeons[id] = 1;
    SoundFX.playSuccessChord();
    updateUI();
}

function triggerAscension() {
    const pendingFlames = Math.floor(Math.sqrt(gameState.gold / 5000));
    if (pendingFlames <= 0) return;

    if (confirm(`모든 골드와 무기를 태워 ${pendingFlames}개의 태초의 불꽃을 얻으시겠습니까?`)) {
        gameState.flame += pendingFlames;
        gameState.gold = 0;
        gameState.ore = 20;
        gameState.forgeProgress = 0;
        gameState.currentWeaponIndex = 0;
        gameState.currentEnhancement = 0;
        gameState.activeRune = null;
        gameState.upgrades = { hammerPower: 0, anvilQuality: 0, bellowsSpeed: 0, oreMagnet: 0 };

        spawnSparks(window.innerWidth / 2, window.innerHeight / 2, 100, '#ff3300');
        SoundFX.playSuccessChord();
        updateUI();
    }
}

// ---------------- GAME TICK LOOP ----------------
let lastTick = performance.now();
let autoHammerTimer = 0;

function gameLoop(time) {
    const dt = (time - lastTick) / 1000;
    lastTick = time;

    // Passive Dungeon Incomes
    let passiveGold = 0;
    let passiveOre = 0;
    DUNGEONS_DEF.forEach(d => {
        if (gameState.dungeons[d.id] > 0) {
            passiveGold += d.goldPerSec;
            passiveOre += d.orePerSec;
        }
    });

    if (passiveGold > 0) gameState.gold += passiveGold * dt;
    if (passiveOre > 0) gameState.ore += passiveOre * dt;

    // Auto Hammer (Bellows upgrade or toggle)
    if (gameState.autoHammer || gameState.upgrades.bellowsSpeed > 0) {
        autoHammerTimer += dt;
        const interval = Math.max(0.15, 0.8 - (gameState.upgrades.bellowsSpeed * 0.1));
        if (autoHammerTimer >= interval) {
            autoHammerTimer = 0;
            strikeAnvil(null);
        }
    }

    updateUI();
    requestAnimationFrame(gameLoop);
}

// ---------------- ATTACH EVENT LISTENERS ----------------
window.addEventListener('DOMContentLoaded', () => {
    // Anvil Strike
    document.getElementById('anvil-btn').addEventListener('click', (e) => strikeAnvil(e));

    // Salvage
    document.getElementById('equip-or-sell-btn').addEventListener('click', salvageWeapon);

    // Auto Hammer Toggle
    document.getElementById('auto-hammer-btn').addEventListener('click', () => {
        gameState.autoHammer = !gameState.autoHammer;
        document.getElementById('auto-hammer-status').innerText = gameState.autoHammer ? 'ON' : 'OFF';
        document.getElementById('auto-hammer-status').style.color = gameState.autoHammer ? '#00ffaa' : '#ff5555';
    });

    // Runes
    document.getElementById('roll-rune-btn').addEventListener('click', rollRune);

    // Ascension
    document.getElementById('ascend-btn').addEventListener('click', triggerAscension);

    // Tabs Nav
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    // Known rune roster
    const runeList = document.getElementById('rune-collection-list');
    RUNES.forEach(r => {
        const item = document.createElement('div');
        item.className = 'upgrade-card';
        item.style.borderColor = r.color;
        item.innerHTML = `
            <div class="upg-info">
                <span class="upg-title" style="color:${r.color}">${r.name} (${r.prefix})</span>
                <span class="upg-desc">${r.desc}</span>
            </div>
            <span style="font-size:0.8rem; font-weight:bold; color:#aaa;">${r.weight}% Rate</span>
        `;
        runeList.appendChild(item);
    });

    updateUI();
    requestAnimationFrame(gameLoop);
});
