// ============================================================================
// INFINITE FORGE - FULL EXPANDED CORE ENGINE (game.js)
// Over 1,200+ lines of robust incremental systems, persistence & fix logic
// ============================================================================

(function () {
    'use strict';

    // ------------------------------------------------------------------------
    // 1. GAME STATE & PERSISTENCE SPECIFICATION
    // ------------------------------------------------------------------------

    const SAVE_KEY = 'InfiniteForge_SaveData_v2';

    const defaultState = {
        version: 2,
        gold: 0,
        ore: 20,
        flame: 0,
        hammerClicks: 0,
        totalWeaponsForged: 0,
        totalSalvages: 0,
        bestWeaponPower: 0,
        lastSaveTimestamp: Date.now(),

        // 제련 중인 상태
        isCraftingComplete: false,
        forgeProgress: 0,
        currentWeaponId: 'w_rusty_dagger',
        currentEnhancement: 0,
        currentQuality: 100,
        activeRuneId: null,

        // 인벤토리 & 장착
        inventory: [], // [{ uid, id, enhancement, quality, runeId, power, locked, forgedAt }]
        equippedWeaponUid: null,
        maxInventorySlots: 30,

        // 도감 해금 기록 (id -> { discovered: true, timesForged, maxEnhance, firstDiscoveredAt })
        codex: {},

        // 대장간 시설 업그레이드 (id -> level)
        upgrades: {
            hammerPower: 0,
            anvilQuality: 0,
            bellowsSpeed: 0,
            oreMagnet: 0,
            qualityMastery: 0,
            enhancementLuck: 0,
            criticalStrike: 0,
            ancientWhisper: 0,
            celestialDestiny: 0,
            smithMastery: 0,
            safetyForge: 0,
            hyperCatalyst: 0,
            doubleStrike: 0,
            celestialBounty: 0
        },

        // 던전 원정대 해금 (id -> level/unlocked)
        dungeons: {
            d_goblin_cave: 0,
            d_skeleton_crypt: 0,
            d_golem_sanctuary: 0,
            d_dragon_peak: 0,
            d_abyssal_rift: 0,
            d_celestial_citadel: 0,
            d_chrono_vortex: 0,
            d_astral_forge_ruins: 0,
            d_void_cathedral: 0,
            d_primordial_chaos_core: 0,
            d_infinity_overlord_realm: 0
        },

        // 시스템 설정
        settings: {
            autoHammer: false,
            sound: true,
            showCutscene: true, // 팝업 컷신 선택 보기 (기본 ON)
            showCraftToast: true // 장비 획득/제련 완료 알림 팝업 토글 (기본 ON)
        },

        // 스마트 자동 분류 필터 (Auto-Filter)
        autoFilter: {
            enabled: false,
            minTier: 'Rare',
            minQuality: 100,
            minEnhance: 0,
            minPower: 0
        },

        // 실시간 모험 (RPG 모드) 진행 상태
        adventure: {
            currentStage: 1,
            maxClearedStage: 0,
            earnedBuffs: [] // [5, 10, 15...]
        }
    };

    let state = JSON.parse(JSON.stringify(defaultState));
    let particlesInstance = null;

    // ------------------------------------------------------------------------
    // 2. HELPER FUNCTIONS & FORMATTERS
    // ------------------------------------------------------------------------

    function generateUID() {
        return 'wpn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    function formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        if (!isFinite(num)) return 'Infinity';
        if (num < 0) return '-' + formatNumber(-num);
        if (num < 1000) return Math.floor(num).toLocaleString();

        const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
        const unitIndex = Math.min(Math.floor(Math.log10(num) / 3), units.length - 1);
        const scaled = num / Math.pow(10, unitIndex * 3);
        return scaled.toFixed(2) + ' ' + units[unitIndex];
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    function showCraftToast(message, type = 'success') {
        if (!state.settings.showCraftToast) return;
        showToast(message, type);
    }

    // ------------------------------------------------------------------------
    // 3. CORE CALCULATIONS & MULTIPLIERS
    // ------------------------------------------------------------------------

    function getAdventureBuffMultiplier() {
        if (!state.adventure || !state.adventure.earnedBuffs) return 1.0;
        let mult = 1.0;
        // 5스테이지: +15%
        if (state.adventure.earnedBuffs.includes(5)) mult += 0.15;
        // 10스테이지: +30%
        if (state.adventure.earnedBuffs.includes(10)) mult += 0.30;
        // 15스테이지: +50%
        if (state.adventure.earnedBuffs.includes(15)) mult += 0.50;
        // 20스테이지: +60%
        if (state.adventure.earnedBuffs.includes(20)) mult += 0.60;
        // 25스테이지: +80%
        if (state.adventure.earnedBuffs.includes(25)) mult += 0.80;
        // 30스테이지: +200% (최종 권능)
        if (state.adventure.earnedBuffs.includes(30)) mult += 2.00;
        return mult;
    }

    function getCodexBonusMultiplier() {
        // 도감에 등록된 고유 무기 1종당 +2% 영구 생산 보너스
        const totalDiscovered = Object.keys(state.codex).length;
        return 1 + (totalDiscovered * 0.02);
    }

    function getHammerProgressPerHit() {
        const base = 8;
        const upgLvl = state.upgrades.hammerPower || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'hammerPower');
        let bonus = upgDef ? upgDef.effect(upgLvl) : 0;
        // 5스테이지 클리어 버프: 제련 진행도 +2%
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(5)) {
            bonus += 2;
        }
        let total = base + bonus;
        // 25스테이지 클리어 버프: 신조의 대장장이 비전 (진행도 2배)
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(25)) {
            total *= 2;
        }
        return Math.floor(total);
    }

    function getAnvilQualityBonus() {
        const upgLvl = state.upgrades.anvilQuality || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'anvilQuality');
        let bonus = upgDef ? upgDef.effect(upgLvl) : 0;
        // 15스테이지 클리어 버프: 분해 가치 2배
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(15)) {
            bonus += 1.0;
        }
        return 1 + bonus;
    }

    function getAutoBellowsInterval() {
        const upgLvl = state.upgrades.bellowsSpeed || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'bellowsSpeed');
        return upgDef ? upgDef.effect(upgLvl) : 0.85;
    }

    function getOreDropChance() {
        const upgLvl = state.upgrades.oreMagnet || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'oreMagnet');
        let bonus = upgDef ? upgDef.effect(upgLvl) : 0;
        // 15스테이지 클리어 버프: 에테르 수급 2배 (+20% 기본 드랍)
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(15)) {
            bonus += 0.20;
        }
        return bonus;
    }

    function getCriticalChance() {
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(30)) {
            return 1.0; // 30스테이지 인피니트 오버로드 왕관: 크리티컬 100%
        }
        const upgLvl = state.upgrades.criticalStrike || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'criticalStrike');
        return 0.10 + (upgDef ? upgDef.effect(upgLvl) : 0);
    }

    function getAncientWhisperMult() {
        const upgLvl = state.upgrades.ancientWhisper || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'ancientWhisper');
        return upgDef ? upgDef.effect(upgLvl) : 1.0;
    }

    function getCelestialDestinyMult() {
        const upgLvl = state.upgrades.celestialDestiny || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'celestialDestiny');
        return upgDef ? upgDef.effect(upgLvl) : 1.0;
    }

    function getHyperCatalystMult() {
        const upgLvl = state.upgrades.hyperCatalyst || 0;
        const upgDef = window.UPGRADES_DATABASE.find(u => u.id === 'hyperCatalyst');
        return upgDef ? upgDef.effect(upgLvl) : 1.0;
    }

    function computeWeaponItemPower(weaponDef, enhancement = 0, quality = 100, runeDef = null) {
        if (!weaponDef) return 10;
        const advBuffMult = getAdventureBuffMultiplier();
        const codexMult = getCodexBonusMultiplier();
        const hyperMult = getHyperCatalystMult();
        const runeBoost = runeDef ? runeDef.boost : 1.0;
        const enhanceMult = 1 + (enhancement * 0.35); // 강화 1당 +35% 공격력 증가
        const qualityMult = quality / 100;

        return Math.floor(weaponDef.basePower * enhanceMult * qualityMult * runeBoost * advBuffMult * codexMult * hyperMult);
    }

    function computeWeaponSalvagePrice(weaponDef, enhancement = 0, quality = 100, runeDef = null) {
        const pwr = computeWeaponItemPower(weaponDef, enhancement, quality, runeDef);
        const anvilMult = getAnvilQualityBonus();
        return Math.floor(pwr * 2.5 * anvilMult);
    }

    function getEquippedWeapon() {
        if (!state.equippedWeaponUid) return null;
        return state.inventory.find(item => item.uid === state.equippedWeaponUid) || null;
    }

    function getMercenaryTotalDPS() {
        const equipped = getEquippedWeapon();
        let baseEquipDPS = 0;
        if (equipped) {
            baseEquipDPS = equipped.power;
        }

        // 인벤토리 내의 다른 무기들도 5%씩 보조 전투력으로 기여 (수집 인센티브)
        let totalInvAux = 0;
        state.inventory.forEach(item => {
            if (item.uid !== state.equippedWeaponUid) {
                totalInvAux += Math.floor(item.power * 0.05);
            }
        });

        return baseEquipDPS + totalInvAux;
    }

    // ------------------------------------------------------------------------
    // 4. FORGING LOGIC & ANVIL STRIKING
    // ------------------------------------------------------------------------

    function strikeAnvil(e = null) {
        window.SoundFX.init();

        // 크리티컬 판정
        const critChance = getCriticalChance();
        const isCritical = Math.random() < critChance;
        window.SoundFX.playAnvilHit(isCritical);

        state.hammerClicks++;

        // 진행도 가산
        let progressGain = getHammerProgressPerHit();
        if (isCritical) {
            progressGain *= 3;
        }

        // 신의 망치질 (더블 타격 업그레이드)
        const dblUpgDef = window.UPGRADES_DATABASE.find(u => u.id === 'doubleStrike');
        const dblChance = dblUpgDef ? dblUpgDef.effect(state.upgrades.doubleStrike || 0) : 0;
        const isDoubleStrike = Math.random() < dblChance;
        if (isDoubleStrike) {
            progressGain *= 2;
        }

        state.forgeProgress = state.forgeProgress + progressGain;

        // 시각적 피드백 및 파티클
        const btnRect = document.getElementById('anvil-btn').getBoundingClientRect();
        const clickX = e ? e.clientX : btnRect.left + btnRect.width / 2;
        const clickY = e ? e.clientY : btnRect.top + btnRect.height / 2;

        if (particlesInstance) {
            if (isDoubleStrike) {
                particlesInstance.spawnCriticalSparks(clickX, clickY, '#00ffff');
                particlesInstance.spawnFloatingText(clickX, clickY - 20, `DOUBLE STRIKE! +${progressGain}%`, '#00e5ff', '1.4rem');
            } else if (isCritical) {
                particlesInstance.spawnCriticalSparks(clickX, clickY, '#ffdd00');
                particlesInstance.spawnFloatingText(clickX, clickY, `CRITICAL +${progressGain}%!`, '#ffea00', '1.6rem');
            } else {
                particlesInstance.spawnSparks(clickX, clickY, 18, '#ff8800');
                particlesInstance.spawnFloatingText(clickX, clickY, `+${progressGain}%`, '#ffaa33');
            }
        }

        // 에테르 광석 드랍 체크
        const oreChance = getOreDropChance();
        if (Math.random() < oreChance) {
            const bountyDef = window.UPGRADES_DATABASE.find(u => u.id === 'celestialBounty');
            const bountyMult = bountyDef ? bountyDef.effect(state.upgrades.celestialBounty || 0) : 1.0;
            const oreGain = Math.random() < (bountyMult - 1) ? 2 : 1;
            state.ore += oreGain;
            if (particlesInstance) {
                particlesInstance.spawnFloatingText(clickX, clickY - 35, `+${oreGain} 💎 에테르 광석`, '#00e5ff', '1.1rem');
            }
        }

        // 100% 이상 도달 시 제련 완성 판정 (프로그래스가 누적되어 600% 등 한 번에 쌓일 경우 누적된 횟수만큼 연속 뽑기)
        if (state.forgeProgress >= 100) {
            const rollCount = Math.floor(state.forgeProgress / 100);
            state.forgeProgress = state.forgeProgress % 100;
            for (let i = 0; i < rollCount; i++) {
                onWeaponCraftComplete(i === rollCount - 1, rollCount);
            }
        }

        updateUI();
    }

    function onWeaponCraftComplete(isLastRoll = true, totalRolls = 1) {
        state.isCraftingComplete = true;
        state.totalWeaponsForged++;
        if (isLastRoll) {
            window.SoundFX.playCraftComplete();
        }

        // 1. 무기 추첨 (RNG Roll with Ancient Whisper & Celestial Destiny Bonus)
        const whisper = getAncientWhisperMult();
        const destiny = getCelestialDestinyMult();
        const database = window.WEAPONS_DATABASE;

        // 가중치 계산 (더 좋은 등급일수록 업그레이드 보너스를 차등 곱연산 적용)
        let weightedPool = database.map(w => {
            let wWeight = w.weight;
            if (w.tier !== 'Common') {
                // 천상의 운명 공명: Uncommon 이상 모든 상위 등급의 등장 확률 증폭
                wWeight *= destiny;
            }
            if (w.tier !== 'Common' && w.tier !== 'Uncommon') {
                // 고대 비전서: Rare 이상 고티어 추가 증폭
                wWeight *= whisper;
            }
            return { item: w, weight: wWeight };
        });

        const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
        let rollVal = Math.random() * totalWeight;
        let selectedWeapon = database[0];

        for (const entry of weightedPool) {
            if (rollVal < entry.weight) {
                selectedWeapon = entry.item;
                break;
            }
            rollVal -= entry.weight;
        }

        state.currentWeaponId = selectedWeapon.id;

        // 2. 품질(Quality) 판정 (80% ~ 120% + Quality Mastery Upgrade)
        const qualBonus = (state.upgrades.qualityMastery || 0) * 5;
        const rawQuality = Math.floor(Math.random() * 41) + 80 + qualBonus;
        state.currentQuality = rawQuality;

        // 3. 추가 강화치(+Enhance) 판정 (축복받은 불꽃 제련 업그레이드 반영)
        const enhBonus = (state.upgrades.enhancementLuck || 0) * 0.1;
        let bonusEnhance = 0;
        const enhRoll = Math.random() + enhBonus;
        if (enhRoll > 0.98) bonusEnhance = Math.floor(Math.random() * 3) + 5; // +5 ~ +7
        else if (enhRoll > 0.85) bonusEnhance = Math.floor(Math.random() * 3) + 2; // +2 ~ +4
        else if (enhRoll > 0.50) bonusEnhance = 1; // +1
        state.currentEnhancement = bonusEnhance;

        // 4. 도감(Codex) 자동 등록 및 업데이트
        registerToCodex(selectedWeapon.id, bonusEnhance);

        // 5. 최고 전투력 갱신
        const currentPwr = computeWeaponItemPower(
            selectedWeapon,
            state.currentEnhancement,
            state.currentQuality,
            getRuneDef(state.activeRuneId)
        );
        if (currentPwr > state.bestWeaponPower) {
            state.bestWeaponPower = currentPwr;
        }

        // 6. 고티어 전설 컷신 연출 (설정에서 팝업이 켜져 있을 때만 발동)
        if (state.settings.showCutscene && (selectedWeapon.cutscene || selectedWeapon.tier === 'Legendary' || selectedWeapon.tier === 'Mythic' || selectedWeapon.tier === 'Godly')) {
            triggerCinematicCutscene(selectedWeapon, state.currentEnhancement);
        }

        if (totalRolls > 1) {
            showCraftToast(`🎉 [${selectedWeapon.tier}] ${selectedWeapon.name} (누적 ${totalRolls}연속 제련!)`, 'success');
        } else {
            showCraftToast(`🎉 [${selectedWeapon.tier}] ${selectedWeapon.name} 제련 완료!`, 'success');
        }
        autoSave();

        // 7. 스마트 자동 분류 (Auto-Filter) 판정 및 즉시 처리
        checkAutoFilterTrigger(selectedWeapon, currentPwr);
    }

    // 티어 순위 맵 (Common < Uncommon < Rare < Epic < Legendary < Mythic < Godly)
    const TIER_ORDER = {
        'Common': 1,
        'Uncommon': 2,
        'Rare': 3,
        'Epic': 4,
        'Legendary': 5,
        'Mythic': 6,
        'Godly': 7
    };

    function checkAutoFilterTrigger(weaponDef, power) {
        if (!state.autoFilter || !state.autoFilter.enabled) return;

        const filter = state.autoFilter;
        const weaponTierRank = TIER_ORDER[weaponDef.tier] || 1;
        const minTierRank = TIER_ORDER[filter.minTier] || 1;

        // 모든 기준 충족 여부 검사 (티어, 품질, 강화 단계, 파워)
        const meetsTier = weaponTierRank >= minTierRank;
        const meetsQuality = state.currentQuality >= (filter.minQuality || 0);
        const meetsEnhance = state.currentEnhancement >= (filter.minEnhance || 0);
        const meetsPower = power >= (filter.minPower || 0);

        const meetsAllCriteria = meetsTier && meetsQuality && meetsEnhance && meetsPower;

        if (meetsAllCriteria) {
            // 기준 이상: 인벤토리에 자동 보관 시도
            if (state.inventory.length >= state.maxInventorySlots) {
                showCraftToast(`⚠️ [자동 보관 실패] 인벤토리가 가득 차 작업대에 보관되었습니다!`, 'warning');
            } else {
                showCraftToast(`🛡️ [자동 보관] 기준 충족: ${weaponDef.name} (+${state.currentEnhancement}, ${state.currentQuality}%)`, 'success');
                claimCurrentWeaponToInventory();
            }
        } else {
            // 기준 미달: 자동 분해(판매)
            showCraftToast(`♻️ [자동 분해] 필터 미달 무기를 골드로 환전했습니다.`, 'info');
            salvageCurrentWeapon();
        }
    }

    // 스마트 자동 분류 컨트롤 UI 동기화 및 이벤트 등록
    function initAutoFilterControls() {
        const toggle = document.getElementById('auto-filter-enable-toggle');
        const minTierSel = document.getElementById('filter-min-tier');
        const minQualInput = document.getElementById('filter-min-quality');
        const minEnhSel = document.getElementById('filter-min-enhance');
        const minPwrInput = document.getElementById('filter-min-power');
        const hintEl = document.getElementById('auto-filter-status-hint');

        if (!toggle) return;

        // 기존 저장값으로 UI 복원
        toggle.checked = !!state.autoFilter.enabled;
        if (minTierSel && state.autoFilter.minTier) minTierSel.value = state.autoFilter.minTier;
        if (minQualInput && state.autoFilter.minQuality !== undefined) minQualInput.value = state.autoFilter.minQuality;
        if (minEnhSel && state.autoFilter.minEnhance !== undefined) minEnhSel.value = state.autoFilter.minEnhance;
        if (minPwrInput && state.autoFilter.minPower !== undefined) minPwrInput.value = state.autoFilter.minPower;

        function updateFilterHint() {
            if (!hintEl) return;
            if (state.autoFilter.enabled) {
                hintEl.innerHTML = `🟢 <b>자동 분류 활성:</b> [${state.autoFilter.minTier} 이상] AND [품질 ${state.autoFilter.minQuality}% 이상] AND [강화 +${state.autoFilter.minEnhance} 이상] AND [공격력 ${state.autoFilter.minPower} 이상] ➔ <b>인벤토리 보관</b> / 미달 ➔ <b>자동 분해(판매)</b>`;
                hintEl.style.borderLeftColor = '#00ffaa';
                hintEl.style.color = '#e2e8f0';
            } else {
                hintEl.innerHTML = `💡 자동 분류 비활성화 상태입니다. 제련된 무기를 수동으로 보관하거나 분해하세요.`;
                hintEl.style.borderLeftColor = '#38bdf8';
                hintEl.style.color = '#94a3b8';
            }
        }

        updateFilterHint();

        toggle.addEventListener('change', () => {
            state.autoFilter.enabled = toggle.checked;
            updateFilterHint();
            showToast(state.autoFilter.enabled ? '⚙️ 스마트 자동 분류 활성화됨!' : '⚙️ 스마트 자동 분류 꺼짐', 'info');
            autoSave();
        });

        if (minTierSel) {
            minTierSel.addEventListener('change', () => {
                state.autoFilter.minTier = minTierSel.value;
                updateFilterHint();
                autoSave();
            });
        }

        if (minQualInput) {
            minQualInput.addEventListener('change', () => {
                state.autoFilter.minQuality = parseInt(minQualInput.value, 10) || 0;
                updateFilterHint();
                autoSave();
            });
        }

        if (minEnhSel) {
            minEnhSel.addEventListener('change', () => {
                state.autoFilter.minEnhance = parseInt(minEnhSel.value, 10) || 0;
                updateFilterHint();
                autoSave();
            });
        }

        if (minPwrInput) {
            minPwrInput.addEventListener('change', () => {
                state.autoFilter.minPower = parseInt(minPwrInput.value, 10) || 0;
                updateFilterHint();
                autoSave();
            });
        }
    }

    function getRuneDef(runeId) {
        if (!runeId) return null;
        return window.RUNES_DATABASE.find(r => r.id === runeId) || null;
    }

    function registerToCodex(weaponId, enhancement) {
        if (!state.codex[weaponId]) {
            state.codex[weaponId] = {
                discovered: true,
                timesForged: 1,
                maxEnhance: enhancement,
                firstDiscoveredAt: Date.now()
            };
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === weaponId);
            if (wDef) {
                showToast(`📖 도감 등록! [${wDef.name}]`, 'info');
            }
        } else {
            state.codex[weaponId].timesForged += 1;
            state.codex[weaponId].maxEnhance = Math.max(state.codex[weaponId].maxEnhance, enhancement);
        }
    }

    // ------------------------------------------------------------------------
    // 5. INVENTORY & WEAPON MANAGEMENT (FIXES MONEY MULTIPLY BUG)
    // ------------------------------------------------------------------------

    function claimCurrentWeaponToInventory() {
        if (!state.isCraftingComplete) {
            showToast('⚠️ 제련이 완성된 무기만 보관할 수 있습니다!', 'warning');
            return;
        }

        if (state.inventory.length >= state.maxInventorySlots) {
            showToast(`⚠️ 인벤토리가 가득 찼습니다! (${state.maxInventorySlots}/${state.maxInventorySlots}) 무기를 분해하거나 정리하세요.`, 'warning');
            return;
        }

        const wDef = window.WEAPONS_DATABASE.find(w => w.id === state.currentWeaponId);
        const rDef = getRuneDef(state.activeRuneId);
        const pwr = computeWeaponItemPower(wDef, state.currentEnhancement, state.currentQuality, rDef);

        const newWeaponItem = {
            uid: generateUID(),
            id: state.currentWeaponId,
            enhancement: state.currentEnhancement,
            quality: state.currentQuality,
            runeId: state.activeRuneId,
            power: pwr,
            locked: false,
            forgedAt: Date.now()
        };

        state.inventory.push(newWeaponItem);

        // 첫 무기인 경우 자동 대표 무기 장착
        if (!state.equippedWeaponUid) {
            state.equippedWeaponUid = newWeaponItem.uid;
        }

        showCraftToast(`🎒 [${wDef.name} +${state.currentEnhancement}] 보관함에 저장되었습니다!`, 'success');
        window.SoundFX.playBuySound();

        // 작업대 상태 리셋 (새 무기 제작 준비)
        resetWorkbench();
        renderInventoryList();
        updateUI();
        autoSave();
    }

    function salvageCurrentWeapon() {
        // [버그 수정] 제련 완성된 상태에서만 분해 가능
        if (!state.isCraftingComplete) {
            showToast('⚠️ 제련이 진행 중인 무기는 분해할 수 없습니다! (완성 후 분해 가능)', 'warning');
            return;
        }

        const wDef = window.WEAPONS_DATABASE.find(w => w.id === state.currentWeaponId);
        const rDef = getRuneDef(state.activeRuneId);
        const goldGain = computeWeaponSalvagePrice(wDef, state.currentEnhancement, state.currentQuality, rDef);

        state.gold += goldGain;
        state.totalSalvages++;
        window.SoundFX.playCoinSound();

        showToast(`💰 [${wDef.name}] 분해 완료! (+${formatNumber(goldGain)} 골드 획득)`, 'success');

        resetWorkbench();
        updateUI();
        autoSave();
    }

    function resetWorkbench() {
        state.isCraftingComplete = false;
        state.forgeProgress = 0;
        state.currentWeaponId = 'w_rusty_dagger';
        state.currentEnhancement = 0;
        state.currentQuality = 100;
        state.activeRuneId = null;
    }

    function equipWeapon(uid) {
        const item = state.inventory.find(i => i.uid === uid);
        if (!item) return;

        state.equippedWeaponUid = uid;
        const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
        showToast(`⚔️ [${wDef.name} +${item.enhancement}] 대표 무기로 장착했습니다!`, 'success');
        window.SoundFX.playBuySound();
        updateUI();
        autoSave();
    }

    function salvageInventoryItem(uid) {
        const index = state.inventory.findIndex(i => i.uid === uid);
        if (index === -1) return;

        const item = state.inventory[index];
        if (item.locked) {
            showToast('🔒 잠겨있는 무기는 분해할 수 없습니다. 잠금을 해제하세요.', 'warning');
            return;
        }

        const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
        const rDef = getRuneDef(item.runeId);
        const price = computeWeaponSalvagePrice(wDef, item.enhancement, item.quality, rDef);

        state.gold += price;
        state.totalSalvages++;
        window.SoundFX.playCoinSound();

        // 장착된 무기 해제 처리
        if (state.equippedWeaponUid === uid) {
            state.equippedWeaponUid = null;
        }

        state.inventory.splice(index, 1);
        showToast(`💰 [${wDef.name}] 판매 완료! (+${formatNumber(price)} 골드)`, 'info');

        // 판매 즉시 인벤토리 뷰 갱신하여 화면에서 사라지게 처리
        renderInventoryList();
        updateUI();
        autoSave();
    }

    function toggleLockInventoryItem(uid) {
        const item = state.inventory.find(i => i.uid === uid);
        if (!item) return;
        item.locked = !item.locked;
        renderInventoryList();
        updateUI();
        autoSave();
    }

    // 잠금된 장비 이외의 모든 무기 일괄 판매 (신규 기능)
    function salvageAllUnlockedItems() {
        const unlockedItems = state.inventory.filter(i => !i.locked && i.uid !== state.equippedWeaponUid);

        if (unlockedItems.length === 0) {
            showToast('판매할 수 있는 잠금 해제 무기가 없습니다. (대표 무기 및 🔒 잠금 무기 제외)', 'info');
            return;
        }

        let totalGold = 0;
        unlockedItems.forEach(item => {
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
            const rDef = getRuneDef(item.runeId);
            totalGold += computeWeaponSalvagePrice(wDef, item.enhancement, item.quality, rDef);
        });

        // 잠금된 무기 및 대표 무기만 보존
        state.inventory = state.inventory.filter(i => i.locked || i.uid === state.equippedWeaponUid);
        state.gold += totalGold;
        state.totalSalvages += unlockedItems.length;
        window.SoundFX.playCoinSound();

        showToast(`💰 잠금 외 무기 ${unlockedItems.length}개 일괄 판매 완료! (+${formatNumber(totalGold)} 골드)`, 'success');
        renderInventoryList();
        updateUI();
        autoSave();
    }

    // ------------------------------------------------------------------------
    // 6. RUNE INSCRIPTION SYSTEM (인벤토리 장비 선택 각인 지원)
    // ------------------------------------------------------------------------

    function rollRune() {
        const cost = 50;
        if (state.ore < cost) {
            showToast(`⚠️ 에테르 광석이 부족합니다! (${cost}개 필요)`, 'warning');
            return;
        }

        const selector = document.getElementById('rune-target-select');
        const targetVal = selector ? selector.value : 'current';

        state.ore -= cost;
        window.SoundFX.init();

        const runes = window.RUNES_DATABASE;
        const totalWeight = runes.reduce((sum, r) => sum + r.weight, 0);
        let rollVal = Math.random() * totalWeight;
        let selectedRune = runes[0];

        for (const r of runes) {
            if (rollVal < r.weight) {
                selectedRune = r;
                break;
            }
            rollVal -= r.weight;
        }

        let targetWeaponName = '';

        if (targetVal === 'current') {
            state.activeRuneId = selectedRune.id;
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === state.currentWeaponId);
            targetWeaponName = `작업대 무기 (${wDef ? wDef.name : ''})`;
        } else {
            // 인벤토리 무기에 직접 각인
            const invItem = state.inventory.find(i => i.uid === targetVal);
            if (invItem) {
                invItem.runeId = selectedRune.id;
                const wDef = window.WEAPONS_DATABASE.find(w => w.id === invItem.id);
                // 각인된 룬 반영하여 공격력 재계산
                invItem.power = computeWeaponItemPower(wDef, invItem.enhancement, invItem.quality, selectedRune);
                targetWeaponName = `${wDef ? wDef.name : ''} +${invItem.enhancement}`;
            } else {
                state.activeRuneId = selectedRune.id;
                targetWeaponName = '모루 작업대 무기';
            }
        }

        window.SoundFX.playBuySound();

        if (particlesInstance) {
            particlesInstance.spawnSparks(window.innerWidth / 2, window.innerHeight / 2, 35, selectedRune.color);
        }

        if (selectedRune.cutscene) {
            triggerRuneCutscene(selectedRune);
        }

        showToast(`🔮 [${targetWeaponName}]에 고대 룬 [${selectedRune.name}] 각인 완료!`, 'success');
        renderInventoryList();
        renderRuneTargetSelector();
        updateUI();
        autoSave();

        return selectedRune;
    }

    // 룬 자동 인챈트 루프 제어 (지정 룬이 뜰 때까지 자동 시도)
    let autoRuneTimer = null;
    let isAutoRuneActive = false;

    // 룬 티어 랭크 비교용
    const RUNE_TIER_RANK = {
        'r_spark': 1,
        'r_stone': 2,
        'r_ether': 3,
        'r_thunder': 4,
        'r_void': 5,
        'r_genesis': 6,
        'r_singularity': 7
    };

    function startAutoRune() {
        const toggleBtn = document.getElementById('auto-rune-toggle-btn');
        const targetSel = document.getElementById('auto-rune-target-tier');
        if (!targetSel) return;

        const targetRuneId = targetSel.value;
        const targetRank = RUNE_TIER_RANK[targetRuneId] || 1;

        if (state.ore < 50) {
            showToast('⚠️ 에테르 광석이 부족하여 자동 각인을 시작할 수 없습니다. (최소 50개 필요)', 'warning');
            return;
        }

        isAutoRuneActive = true;
        if (toggleBtn) {
            toggleBtn.innerText = '⏹️ 자동 각인 중지';
            toggleBtn.className = 'mini-btn danger';
        }

        showToast(`⚡ 자동 룬 각인 시작! [목표 룬 도달 시 자동 정지]`, 'info');

        function step() {
            if (!isAutoRuneActive) return;

            if (state.ore < 50) {
                stopAutoRune();
                showToast('⚠️ 에테르 광석이 모두 소진되어 자동 각인이 중단되었습니다.', 'warning');
                return;
            }

            const rolled = rollRune();
            const rolledRank = rolled ? (RUNE_TIER_RANK[rolled.id] || 0) : 0;

            if (rolledRank >= targetRank) {
                stopAutoRune();
                showToast(`🎯 목표 달성! [${rolled.name}] 각인 성공으로 자동 인챈트를 종료합니다.`, 'success');
                return;
            }

            autoRuneTimer = setTimeout(step, 160); // 0.16초 주기로 연속 각인
        }

        step();
    }

    function stopAutoRune() {
        isAutoRuneActive = false;
        if (autoRuneTimer) {
            clearTimeout(autoRuneTimer);
            autoRuneTimer = null;
        }
        const toggleBtn = document.getElementById('auto-rune-toggle-btn');
        if (toggleBtn) {
            toggleBtn.innerText = '⚡ 자동 각인 시작';
            toggleBtn.className = 'mini-btn highlight';
        }
    }

    // 인벤토리 무기 및 현재 작업대 무기를 룬 제단 셀렉터에 동기화
    function renderRuneTargetSelector() {
        const selector = document.getElementById('rune-target-select');
        if (!selector) return;

        const currentVal = selector.value || 'current';
        selector.innerHTML = '';

        // 1. 현재 모루 작업대 무기 옵션
        const currDef = window.WEAPONS_DATABASE.find(w => w.id === state.currentWeaponId);
        const currRune = getRuneDef(state.activeRuneId);
        const optCurr = document.createElement('option');
        optCurr.value = 'current';
        optCurr.innerText = `🔨 [현재 모루] ${currDef ? currDef.name : '무기'} ${currRune ? `(${currRune.name})` : '(룬 없음)'}`;
        selector.appendChild(optCurr);

        // 2. 인벤토리에 보관된 무기 목록 옵션
        state.inventory.forEach(item => {
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
            const rDef = getRuneDef(item.runeId);
            const isEquipped = state.equippedWeaponUid === item.uid;

            const opt = document.createElement('option');
            opt.value = item.uid;
            opt.innerText = `🎒 [보관함${isEquipped ? '★장착' : ''}] ${wDef ? wDef.name : 'Unknown'} +${item.enhancement} (⚡${formatNumber(item.power)}) ${rDef ? `[${rDef.name}]` : '[룬 없음]'}`;
            selector.appendChild(opt);
        });

        // 기존 선택값 유지 시도
        if ([...selector.options].some(o => o.value === currentVal)) {
            selector.value = currentVal;
        } else {
            selector.value = 'current';
        }
    }

    // ------------------------------------------------------------------------
    // 6-1. BLACKSMITH ENHANCEMENT SYSTEM (대장장이 +20강 한계돌파)
    // ------------------------------------------------------------------------

    // 강화 단계별 기본 확률표 (성공, 대성공, 유지, 하락, 파괴/초기화)
    function getEnhanceOdds(currentLvl) {
        let success = 0.70;
        let great = 0.05;
        let maintain = 0.25;
        let down = 0.00;
        let broken = 0.00;

        if (currentLvl === 0) {
            success = 0.90; great = 0.10; maintain = 0.00; down = 0.00; broken = 0.00;
        } else if (currentLvl <= 3) {
            success = 0.80; great = 0.08; maintain = 0.12; down = 0.00; broken = 0.00;
        } else if (currentLvl <= 6) {
            success = 0.65; great = 0.06; maintain = 0.25; down = 0.04; broken = 0.00;
        } else if (currentLvl <= 9) {
            success = 0.50; great = 0.05; maintain = 0.30; down = 0.12; broken = 0.03;
        } else if (currentLvl <= 12) {
            success = 0.38; great = 0.04; maintain = 0.32; down = 0.20; broken = 0.06;
        } else if (currentLvl <= 15) {
            success = 0.25; great = 0.03; maintain = 0.35; down = 0.27; broken = 0.10;
        } else if (currentLvl <= 18) {
            success = 0.15; great = 0.02; maintain = 0.35; down = 0.33; broken = 0.15;
        } else { // 19강 -> 20강 극악 난이도
            success = 0.08; great = 0.01; maintain = 0.35; down = 0.36; broken = 0.20;
        }

        // 업그레이드 보너스 적용
        const masterDef = window.UPGRADES_DATABASE.find(u => u.id === 'smithMastery');
        const bonusSuccess = masterDef ? masterDef.effect(state.upgrades.smithMastery || 0) : 0;
        success += bonusSuccess;

        // 20스테이지 클리어 버프: 강화 성공률 +3%
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(20)) {
            success += 0.03;
        }

        // 25스테이지 클리어 버프: 대성공 확률 +5%
        if (state.adventure && state.adventure.earnedBuffs && state.adventure.earnedBuffs.includes(25)) {
            great += 0.05;
        }

        const safetyDef = window.UPGRADES_DATABASE.find(u => u.id === 'safetyForge');
        const reduceBroken = safetyDef ? safetyDef.effect(state.upgrades.safetyForge || 0) : 0;
        broken = Math.max(0, broken - reduceBroken);

        // 합계 100% 정규화
        const sum = success + great + maintain + down + broken;
        return {
            success: success / sum,
            great: great / sum,
            maintain: maintain / sum,
            down: down / sum,
            broken: broken / sum
        };
    }

    function getEnhanceCost(currentLvl) {
        // 골드 & 광석 소모량 계산
        const gold = Math.floor(150 * Math.pow(1.48, currentLvl));
        const ore = Math.max(2, Math.floor(2 + (currentLvl * 1.5)));
        return { gold, ore };
    }

    function renderBlacksmithSelector() {
        const selector = document.getElementById('smith-target-select');
        if (!selector) return;

        const currentVal = selector.value;
        selector.innerHTML = '';

        if (state.inventory.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = '⚠️ 인벤토리에 보관된 무기가 없습니다.';
            selector.appendChild(opt);
            updateBlacksmithUI();
            return;
        }

        state.inventory.forEach(item => {
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
            const rDef = getRuneDef(item.runeId);
            const isEquipped = state.equippedWeaponUid === item.uid;

            const opt = document.createElement('option');
            opt.value = item.uid;
            opt.innerText = `[+${item.enhancement}] ${wDef ? wDef.name : 'Unknown'} ${rDef ? `(${rDef.name})` : ''} ⚡${formatNumber(item.power)} ${isEquipped ? '★대표장착' : ''} ${item.locked ? '🔒' : ''}`;
            selector.appendChild(opt);
        });

        if (currentVal && [...selector.options].some(o => o.value === currentVal)) {
            selector.value = currentVal;
        } else if (state.inventory.length > 0) {
            selector.value = state.inventory[0].uid;
        }

        updateBlacksmithUI();
    }

    function updateBlacksmithUI() {
        const selector = document.getElementById('smith-target-select');
        const uid = selector ? selector.value : null;
        const item = state.inventory.find(i => i.uid === uid);

        const titleEl = document.getElementById('smith-weapon-title');
        const iconEl = document.getElementById('smith-weapon-icon');
        const currEnhEl = document.getElementById('smith-current-enhance');
        const nextEnhEl = document.getElementById('smith-next-enhance');
        const pwrEl = document.getElementById('smith-weapon-power');
        const btn = document.getElementById('smith-enhance-btn');

        if (!item) {
            if (titleEl) titleEl.innerText = '선택된 무기 없음';
            if (iconEl) iconEl.innerText = '❓';
            if (currEnhEl) currEnhEl.innerText = '+0';
            if (nextEnhEl) nextEnhEl.innerText = '+1';
            if (pwrEl) pwrEl.innerText = '0';
            if (btn) btn.disabled = true;
            return;
        }

        const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
        const rDef = getRuneDef(item.runeId);

        if (titleEl) {
            titleEl.innerText = `${rDef ? `${rDef.prefix} ` : ''}${wDef ? wDef.name : '무기'}`;
            titleEl.style.color = rDef ? rDef.color : (wDef ? wDef.color : '#fff');
        }
        if (iconEl) iconEl.innerText = wDef ? wDef.icon : '🗡️';
        if (currEnhEl) currEnhEl.innerText = `+${item.enhancement}`;
        if (pwrEl) pwrEl.innerText = formatNumber(item.power);

        const isMax = item.enhancement >= 20;
        if (nextEnhEl) nextEnhEl.innerText = isMax ? 'MAX (+20)' : `+${item.enhancement + 1}`;

        const odds = getEnhanceOdds(item.enhancement);
        document.getElementById('smith-prob-success').innerText = `${Math.round(odds.success * 100)}%`;
        document.getElementById('smith-prob-great').innerText = `${Math.round(odds.great * 100)}%`;
        document.getElementById('smith-prob-maintain').innerText = `${Math.round(odds.maintain * 100)}%`;
        document.getElementById('smith-prob-down').innerText = `${Math.round(odds.down * 100)}%`;
        document.getElementById('smith-prob-destroy').innerText = `${Math.round(odds.broken * 100)}%`;

        const cost = getEnhanceCost(item.enhancement);
        document.getElementById('smith-cost-gold').innerText = formatNumber(cost.gold);
        document.getElementById('smith-cost-ore').innerText = formatNumber(cost.ore);

        if (btn) {
            if (isMax) {
                btn.disabled = true;
                btn.innerText = '🏆 이미 최고 강화 단계 (+20)에 도달했습니다!';
            } else {
                const canAfford = state.gold >= cost.gold && state.ore >= cost.ore;
                btn.disabled = !canAfford;
                btn.innerText = `🔥 강화 망치질 시작 (+${item.enhancement + 1} 도전) [${formatNumber(cost.gold)}🪙 / ${cost.ore}💎]`;
            }
        }
    }

    function executeBlacksmithEnhance() {
        const selector = document.getElementById('smith-target-select');
        const uid = selector ? selector.value : null;
        const item = state.inventory.find(i => i.uid === uid);
        if (!item || item.enhancement >= 20) return;

        const cost = getEnhanceCost(item.enhancement);
        if (state.gold < cost.gold || state.ore < cost.ore) {
            showToast('⚠️ 재화가 부족합니다! (골드 또는 에테르 광석 확인)', 'warning');
            return;
        }

        state.gold -= cost.gold;
        state.ore -= cost.ore;

        const odds = getEnhanceOdds(item.enhancement);
        const roll = Math.random();
        const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
        const rDef = getRuneDef(item.runeId);
        const prevEnh = item.enhancement;

        let resultType = 'fail';

        if (roll < odds.success) {
            // 성공 (+1)
            item.enhancement += 1;
            resultType = 'success';
        } else if (roll < odds.success + odds.great) {
            // 대성공 (+2)
            item.enhancement = Math.min(20, item.enhancement + 2);
            resultType = 'great';
        } else if (roll < odds.success + odds.great + odds.maintain) {
            // 유지
            resultType = 'maintain';
        } else if (roll < odds.success + odds.great + odds.maintain + odds.down) {
            // 하락 (-1)
            item.enhancement = Math.max(0, item.enhancement - 1);
            resultType = 'down';
        } else {
            // 초기화 / 박살 (0으로 초기화)
            item.enhancement = 0;
            resultType = 'broken';
        }

        // 새 스탯 및 파워 갱신
        item.power = computeWeaponItemPower(wDef, item.enhancement, item.quality, rDef);

        // 연출 및 사운드 피드백
        if (resultType === 'great') {
            window.SoundFX.playLegendaryFanfare();
            showToast(`🌟 대성공!! 운명의 불꽃이 폭발하여 [+${item.enhancement}] 2단계 급상승!`, 'success');
        } else if (resultType === 'success') {
            window.SoundFX.playBuySound();
            showToast(`✨ 강화 성공! [+${prevEnh}] ➔ [+${item.enhancement}] 도달!`, 'success');
        } else if (resultType === 'maintain') {
            window.SoundFX.playAnvilHit(false);
            showToast(`🛡️ 강화 실패! 단계가 안전하게 유지되었습니다. (+${item.enhancement})`, 'info');
        } else if (resultType === 'down') {
            window.SoundFX.playAnvilHit(true);
            showToast(`⚠️ 강화 실패로 등급이 미끄러졌습니다... (+${item.enhancement})`, 'warning');
        } else if (resultType === 'broken') {
            window.SoundFX.playAnvilHit(true);
            showToast(`💥 대장장이의 실수로 모루가 폭발했습니다! 강화 단계가 [+0]으로 초기화되었습니다!`, 'danger');
        }

        renderBlacksmithSelector();
        renderInventoryList();
        renderRuneTargetSelector();
        updateUI();
        autoSave();
    }

    function buyUpgrade(upgradeId) {
        const def = window.UPGRADES_DATABASE.find(u => u.id === upgradeId);
        if (!def) return;

        const currentLvl = state.upgrades[upgradeId] || 0;
        if (currentLvl >= def.maxLevel) {
            showToast('⚠️ 이미 최고 레벨에 도달했습니다!', 'warning');
            return;
        }

        const cost = Math.floor(def.baseCost * Math.pow(def.costMul, currentLvl));
        if (state.gold < cost) {
            showToast(`⚠️ 골드가 부족합니다! (${formatNumber(cost)} 🪙 필요)`, 'warning');
            return;
        }

        state.gold -= cost;
        state.upgrades[upgradeId] = currentLvl + 1;
        window.SoundFX.playBuySound();

        showToast(`⚒️ [${def.title}] 레벨 ${state.upgrades[upgradeId]} 달성!`, 'success');
        renderUpgradesList();
        updateUI();
        autoSave();
    }

    // ------------------------------------------------------------------------
    // 8. DUNGEON EXPEDITION SYSTEM
    // ------------------------------------------------------------------------

    function unlockDungeon(dungeonId) {
        const dDef = window.DUNGEONS_DATABASE.find(d => d.id === dungeonId);
        if (!dDef) return;

        if (state.dungeons[dungeonId] > 0) return;

        const currentDPS = getMercenaryTotalDPS();
        if (currentDPS < dDef.reqPower) {
            showToast(`⚠️ 용병단 전투력이 부족합니다! (${formatNumber(dDef.reqPower)} 필요)`, 'warning');
            return;
        }

        if (state.gold < dDef.cost) {
            showToast(`⚠️ 해금 골드가 부족합니다! (${formatNumber(dDef.cost)} 🪙 필요)`, 'warning');
            return;
        }

        state.gold -= dDef.cost;
        state.dungeons[dungeonId] = 1;
        window.SoundFX.playBuySound();

        showToast(`⚔️ [${dDef.name}] 원정대 탐험 시작!`, 'success');
        renderDungeonsList();
        updateUI();
        autoSave();
    }

    // ------------------------------------------------------------------------
    // 9. ADVENTURE MODE (ACTION RPG ENGINE - REPLACES ASCENSION)
    // ------------------------------------------------------------------------

    let adventureBattleState = null;
    let adventureAnimFrame = null;
    const playerKeys = { w: false, a: false, s: false, d: false, space: false };

    function selectAdventureStage(stageNum) {
        const totalStages = window.STAGES_DATABASE.length;
        const target = Math.max(1, Math.min(totalStages, stageNum));
        state.adventure.currentStage = target;
        renderAdventureStageUI();
    }

    function renderAdventureStageUI() {
        const stageNum = state.adventure.currentStage || 1;
        const stageDef = window.STAGES_DATABASE.find(s => s.stage === stageNum);
        if (!stageDef) return;

        const maxCleared = state.adventure.maxClearedStage || 0;
        const isLocked = stageNum > maxCleared + 1;

        // 헤더 뱃지
        const badge = document.getElementById('adv-current-stage-badge');
        if (badge) badge.innerHTML = `현재 선택: <b style="color:var(--accent-gold);">STAGE ${stageNum}</b> (최고 클리어: STAGE ${maxCleared})`;

        document.getElementById('adv-stage-num').innerText = `STAGE ${stageNum}`;
        document.getElementById('adv-stage-name').innerText = stageDef.name;
        document.getElementById('adv-rec-power').innerText = formatNumber(stageDef.recPower);
        document.getElementById('adv-stage-desc').innerText = stageDef.desc;

        document.getElementById('adv-boss-icon').innerText = stageDef.bossIcon;
        document.getElementById('adv-boss-name').innerText = stageDef.bossName;
        document.getElementById('adv-boss-name').style.color = stageDef.bossColor;
        document.getElementById('adv-boss-hp').innerText = formatNumber(stageDef.bossHp);
        document.getElementById('adv-boss-atk').innerText = formatNumber(stageDef.bossAtk);

        // 버프 박스
        const buffBox = document.getElementById('adv-buff-reward-box');
        const buffText = document.getElementById('adv-buff-text');
        if (stageDef.buffReward) {
            buffBox.style.display = 'block';
            buffText.innerHTML = `<b>${stageDef.buffReward.title}:</b> ${stageDef.buffReward.desc}`;
        } else {
            buffBox.style.display = 'none';
        }

        document.getElementById('adv-stage-select-label').innerText = `Stage ${stageNum} / ${window.STAGES_DATABASE.length}`;

        const startBtn = document.getElementById('adv-start-battle-btn');
        if (isLocked) {
            startBtn.disabled = true;
            startBtn.innerText = `🔒 이전 스테이지 클리어 필요`;
            startBtn.style.opacity = '0.5';
        } else {
            startBtn.disabled = false;
            startBtn.innerText = `⚔️ STAGE ${stageNum} 모험 출격하기 (START)`;
            startBtn.style.opacity = '1';
        }

        renderEarnedBuffsList();
    }

    function renderEarnedBuffsList() {
        const container = document.getElementById('adv-earned-buffs-list');
        if (!container) return;

        const earned = state.adventure.earnedBuffs || [];
        if (earned.length === 0) {
            container.innerHTML = '<div class="none-text" style="color:#666; font-size:0.8rem; padding:8px;">아직 획득한 관문 버프가 없습니다. 5, 10, 15 스테이지를 돌파하여 영구 버프를 획득하세요!</div>';
            return;
        }

        container.innerHTML = '';
        earned.forEach(stNum => {
            const stDef = window.STAGES_DATABASE.find(s => s.stage === stNum);
            if (!stDef || !stDef.buffReward) return;

            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.style.borderColor = '#eab308';
            card.innerHTML = `
                <div class="upg-info">
                    <span class="upg-title" style="color:#fef08a;">🌟 [Stage ${stNum}] ${stDef.buffReward.title}</span>
                    <span class="upg-desc">${stDef.buffReward.desc}</span>
                </div>
                <span style="color:#00ffaa; font-weight:800; font-size:0.75rem;">영구 적용 중</span>
            `;
            container.appendChild(card);
        });
    }

    function startAdventureBattle() {
        const stageNum = state.adventure.currentStage || 1;
        const stageDef = window.STAGES_DATABASE.find(s => s.stage === stageNum);
        if (!stageDef) return;

        const eqWeapon = getEquippedWeapon();
        const basePlayerPower = eqWeapon ? eqWeapon.power : 10;
        const wDef = eqWeapon ? window.WEAPONS_DATABASE.find(w => w.id === eqWeapon.id) : null;

        // 플레이어 기본 체력 및 버프 반영
        let playerMaxHp = 100 + Math.floor(basePlayerPower * 0.5);
        if (state.adventure.earnedBuffs.includes(5)) playerMaxHp = Math.floor(playerMaxHp * 1.25);
        if (state.adventure.earnedBuffs.includes(15)) playerMaxHp = Math.floor(playerMaxHp * 1.50);
        if (state.adventure.earnedBuffs.includes(30)) playerMaxHp = Math.floor(playerMaxHp * 3.00);

        let playerSpeed = 160;
        if (state.adventure.earnedBuffs.includes(20)) playerSpeed = Math.floor(playerSpeed * 1.20);

        // 몬스터 생성 (미니언들 + 보스)
        const minions = [];
        for (let i = 0; i < stageDef.minionCount; i++) {
            minions.push({
                x: 150 + Math.random() * 380,
                y: 50 + Math.random() * 220,
                hp: stageDef.minionHp,
                maxHp: stageDef.minionHp,
                atk: stageDef.minionAtk,
                icon: stageDef.minionIcon,
                size: 16,
                speed: 40 + Math.random() * 25,
                attackCooldown: Math.random() * 2
            });
        }

        adventureBattleState = {
            active: true,
            stageDef,
            timeLeft: 60.0, // 스테이지당 약 1분
            player: {
                x: 50,
                y: 170,
                hp: playerMaxHp,
                maxHp: playerMaxHp,
                speed: playerSpeed,
                size: 18,
                atk: Math.max(15, Math.floor(basePlayerPower * 0.8)),
                swingTimer: 0,
                swingDuration: 0.22,
                weaponIcon: wDef ? wDef.icon : '🗡️',
                weaponName: wDef ? wDef.name : '기본 단검'
            },
            boss: {
                x: 480,
                y: 170,
                hp: stageDef.bossHp,
                maxHp: stageDef.bossHp,
                atk: stageDef.bossAtk,
                icon: stageDef.bossIcon,
                name: stageDef.bossName,
                color: stageDef.bossColor,
                size: 32,
                speed: 55,
                attackCooldown: 1.5
            },
            minions,
            particles: [],
            floatingTexts: []
        };

        window.SoundFX.playBuySound();
        showToast(`⚔️ [${stageDef.name}] 모험 전투 개시!`, 'info');

        // 포커스 및 루프 가동
        const canvas = document.getElementById('adventure-canvas');
        if (canvas) {
            canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
            canvas.focus();
        }
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        if (!adventureAnimFrame) {
            lastAdvFrameTime = performance.now();
            adventureLoop(performance.now());
        }
    }

    let lastAdvFrameTime = performance.now();

    function adventureLoop(now) {
        const dt = Math.min(0.1, (now - lastAdvFrameTime) / 1000);
        lastAdvFrameTime = now;

        if (adventureBattleState && adventureBattleState.active) {
            updateAdventureBattle(dt);
            renderAdventureBattle();
            adventureAnimFrame = requestAnimationFrame(adventureLoop);
        } else {
            renderAdventureIdle();
            adventureAnimFrame = requestAnimationFrame(adventureLoop);
        }
    }

    function updateAdventureBattle(dt) {
        const b = adventureBattleState;
        if (!b) return;

        b.timeLeft -= dt;
        if (b.timeLeft <= 0) {
            endAdventureBattle(false, '⏱️ 제한시간(60초) 초과로 보스를 격파하지 못했습니다!');
            return;
        }

        const p = b.player;

        // 플레이어 이동 (WASD)
        let dx = 0;
        let dy = 0;
        if (playerKeys.w) dy -= 1;
        if (playerKeys.s) dy += 1;
        if (playerKeys.a) dx -= 1;
        if (playerKeys.d) dx += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        p.x = Math.max(p.size, Math.min(600 - p.size, p.x + dx * p.speed * dt));
        p.y = Math.max(p.size, Math.min(340 - p.size, p.y + dy * p.speed * dt));

        // 플레이어 공격 쿨다운
        if (p.swingTimer > 0) {
            p.swingTimer -= dt;
        }
        if (playerKeys.space && p.swingTimer <= 0) {
            performPlayerAttack();
        }

        // 보스 AI
        const boss = b.boss;
        if (boss.hp > 0) {
            const bdx = p.x - boss.x;
            const bdy = p.y - boss.y;
            const bDist = Math.hypot(bdx, bdy);

            if (bDist > 40) {
                boss.x += (bdx / bDist) * boss.speed * dt;
                boss.y += (bdy / bDist) * boss.speed * dt;
            }

            boss.attackCooldown -= dt;
            if (boss.attackCooldown <= 0 && bDist < 55) {
                boss.attackCooldown = 1.2;
                p.hp -= boss.atk;
                b.floatingTexts.push({ x: p.x, y: p.y - 20, text: `-${boss.atk}`, color: '#ff3344', life: 0.8 });
                window.SoundFX.playAnvilHit(true);

                if (p.hp <= 0) {
                    endAdventureBattle(false, `💀 보스 [${boss.name}]에게 쓰러졌습니다!`);
                    return;
                }
            }
        }

        // 미니언 AI
        b.minions.forEach(m => {
            if (m.hp <= 0) return;
            const mdx = p.x - m.x;
            const mdy = p.y - m.y;
            const mDist = Math.hypot(mdx, mdy);

            if (mDist > 28) {
                m.x += (mdx / mDist) * m.speed * dt;
                m.y += (mdy / mDist) * m.speed * dt;
            }

            m.attackCooldown -= dt;
            if (m.attackCooldown <= 0 && mDist < 35) {
                m.attackCooldown = 1.5;
                p.hp -= m.atk;
                b.floatingTexts.push({ x: p.x, y: p.y - 15, text: `-${m.atk}`, color: '#ff7777', life: 0.7 });

                if (p.hp <= 0) {
                    endAdventureBattle(false, `💀 몬스터 무리에게 쓰러졌습니다!`);
                    return;
                }
            }
        });

        // 죽은 미니언 정리
        b.minions = b.minions.filter(m => m.hp > 0);

        // 보스 사망 시 승리!
        if (boss.hp <= 0) {
            endAdventureBattle(true, `🎉 STAGE ${b.stageDef.stage} 돌파 성공!`);
            return;
        }

        // 파티클 & 텍스트 갱신
        b.floatingTexts.forEach(ft => {
            ft.y -= 30 * dt;
            ft.life -= dt;
        });
        b.floatingTexts = b.floatingTexts.filter(ft => ft.life > 0);

        // HUD UI 바 갱신
        const pHpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
        const bHpPct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));

        document.getElementById('arena-player-hp-text').innerText = `${Math.max(0, Math.floor(p.hp))}/${p.maxHp}`;
        document.getElementById('arena-player-hp-bar').style.width = `${pHpPct}%`;

        document.getElementById('arena-boss-hp-label').innerText = `${boss.name} (${Math.floor(bHpPct)}%)`;
        document.getElementById('arena-boss-hp-bar').style.width = `${bHpPct}%`;

        document.getElementById('arena-timer').innerText = `⏱️ ${b.timeLeft.toFixed(1)}s`;
    }

    function performPlayerAttack() {
        const b = adventureBattleState;
        if (!b) return;

        const p = b.player;
        p.swingTimer = p.swingDuration;
        window.SoundFX.playAnvilHit(false);

        const attackRange = 70;

        // 보스 타격 판정
        const bDist = Math.hypot(b.boss.x - p.x, b.boss.y - p.y);
        if (bDist <= attackRange + b.boss.size) {
            const isCrit = Math.random() < getCriticalChance();
            let dmg = p.atk;
            if (isCrit) dmg *= 3;

            b.boss.hp -= dmg;
            b.floatingTexts.push({
                x: b.boss.x,
                y: b.boss.y - 30,
                text: `${isCrit ? '💥 CRIT ' : ''}${formatNumber(dmg)}!`,
                color: isCrit ? '#ffea00' : '#00e5ff',
                life: 0.8
            });
        }

        // 미니언 타격 판정 (광역 휘두르기)
        b.minions.forEach(m => {
            const mDist = Math.hypot(m.x - p.x, m.y - p.y);
            if (mDist <= attackRange + m.size) {
                m.hp -= p.atk;
                b.floatingTexts.push({
                    x: m.x,
                    y: m.y - 20,
                    text: `${formatNumber(p.atk)}`,
                    color: '#ffffff',
                    life: 0.6
                });
            }
        });
    }

    function endAdventureBattle(isVictory, msg) {
        if (!adventureBattleState) return;

        const stageDef = adventureBattleState.stageDef;
        adventureBattleState.active = false;
        adventureBattleState = null;

        if (isVictory) {
            window.SoundFX.playCraftComplete();
            showToast(`${msg} (+${formatNumber(stageDef.rewardGold)} 🪙, +${stageDef.rewardOre} 💎)`, 'success');

            state.gold += stageDef.rewardGold;
            state.ore += stageDef.rewardOre;

            // 최고 클리어 스테이지 갱신
            if (stageDef.stage > (state.adventure.maxClearedStage || 0)) {
                state.adventure.maxClearedStage = stageDef.stage;

                // 5의 배수 스테이지 영구 버프 지급
                if (stageDef.stage % 5 === 0 && !state.adventure.earnedBuffs.includes(stageDef.stage)) {
                    state.adventure.earnedBuffs.push(stageDef.stage);
                    if (stageDef.buffReward) {
                        showToast(`🏆 [영구 관문 버프 획득!] ${stageDef.buffReward.title}: ${stageDef.buffReward.desc}`, 'success');
                        window.SoundFX.playLegendaryFanfare();
                    }
                }
            }

            // 다음 스테이지 자동 선택
            if (stageDef.stage < window.STAGES_DATABASE.length) {
                state.adventure.currentStage = stageDef.stage + 1;
            }
        } else {
            showToast(msg, 'warning');
        }

        renderAdventureStageUI();
        updateUI();
        autoSave();
    }

    function renderAdventureBattle() {
        const canvas = document.getElementById('adventure-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const b = adventureBattleState;
        if (!b) return;

        // 배경
        ctx.fillStyle = '#060911';
        ctx.fillRect(0, 0, 600, 340);

        // 격자 그리드 라인
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 600; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 340); ctx.stroke();
        }
        for (let y = 0; y < 340; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke();
        }

        // 미니언 그리기
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        b.minions.forEach(m => {
            ctx.fillText(m.icon, m.x, m.y);
            // 미니언 미니 HP 바
            const pct = Math.max(0, m.hp / m.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(m.x - 12, m.y - 18, 24, 3);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(m.x - 12, m.y - 18, 24 * pct, 3);
        });

        // 보스 그리기
        const boss = b.boss;
        ctx.font = '36px sans-serif';
        ctx.fillText(boss.icon, boss.x, boss.y);

        // 플레이어 & 무기 휘두르기 이펙트
        const p = b.player;
        ctx.font = '26px sans-serif';
        ctx.fillText('🧙‍♂️', p.x, p.y);

        // 장착한 무기 아이콘 렌더링
        ctx.font = '18px sans-serif';
        ctx.fillText(p.weaponIcon, p.x + 16, p.y - 10);

        // 휘두르기 궤적 아크
        if (p.swingTimer > 0) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 45, -Math.PI / 4, Math.PI / 2);
            ctx.stroke();
        }

        // 데미지 텍스트 렌더링
        ctx.font = 'bold 14px Cinzel, sans-serif';
        b.floatingTexts.forEach(ft => {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    function renderAdventureIdle() {
        const canvas = document.getElementById('adventure-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#060911';
        ctx.fillRect(0, 0, 600, 340);

        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️', 300, 130);

        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('모험 출격(START)을 누르면 실시간 전투가 시작됩니다!', 300, 180);

        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('[WASD] 이동 | [Space] 또는 [클릭] 공격 | 대표 장착 무기 스탯 반영', 300, 215);
    }

    // ------------------------------------------------------------------------
    // 10. CINEMATIC CUTSCENE (SOL'S RNG STYLE)
    // ------------------------------------------------------------------------

    function triggerCinematicCutscene(weapon, enhance = 0) {
        const overlay = document.getElementById('cutscene-overlay');
        const titleEl = document.getElementById('cs-weapon-name');
        const rarityEl = document.getElementById('cs-weapon-rarity');
        const symEl = document.getElementById('cs-weapon-symbol');
        const glowEl = document.getElementById('cs-glow');
        const quoteEl = document.getElementById('cs-quote');

        if (!overlay || !titleEl) return;

        titleEl.innerText = `${weapon.name} ${enhance > 0 ? `+${enhance}` : ''}`;
        titleEl.style.color = weapon.color;
        rarityEl.innerText = `확률 / Rarity: ${weapon.rarityRate}`;
        symEl.innerText = weapon.icon;
        glowEl.style.background = weapon.color;
        quoteEl.innerText = `"${weapon.lore}"`;

        window.SoundFX.playLegendaryFanfare();
        overlay.classList.remove('hidden');

        if (particlesInstance) {
            particlesInstance.spawnCriticalSparks(window.innerWidth / 2, window.innerHeight / 2, weapon.color);
        }

        const closeCutscene = () => {
            overlay.classList.add('hidden');
        };

        const skipBtn = document.getElementById('cs-skip-btn');
        if (skipBtn) skipBtn.onclick = closeCutscene;
        overlay.onclick = closeCutscene;

        setTimeout(closeCutscene, 5000);
    }

    function triggerRuneCutscene(rune) {
        if (!state.settings.showCutscene) return;
        const overlay = document.getElementById('cutscene-overlay');
        const titleEl = document.getElementById('cs-weapon-name');
        const rarityEl = document.getElementById('cs-weapon-rarity');
        const symEl = document.getElementById('cs-weapon-symbol');
        const glowEl = document.getElementById('cs-glow');
        const quoteEl = document.getElementById('cs-quote');

        if (!overlay || !titleEl) return;

        titleEl.innerText = `${rune.prefix} 인챈트 각인`;
        titleEl.style.color = rune.color;
        rarityEl.innerText = rune.desc;
        symEl.innerText = '🔮';
        glowEl.style.background = rune.color;
        quoteEl.innerText = `"고대의 에테르 지혜가 무기에 깃듭니다."`;

        window.SoundFX.playLegendaryFanfare();
        overlay.classList.remove('hidden');

        const closeCutscene = () => overlay.classList.add('hidden');
        overlay.onclick = closeCutscene;
        setTimeout(closeCutscene, 4000);
    }

    // ------------------------------------------------------------------------
    // 11. ITEM DETAIL MODAL
    // ------------------------------------------------------------------------

    function showItemModal(uid) {
        const item = state.inventory.find(i => i.uid === uid);
        if (!item) return;

        const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
        const rDef = getRuneDef(item.runeId);
        const modal = document.getElementById('item-modal');
        if (!modal) return;

        document.getElementById('modal-tier-badge').innerText = wDef.tier;
        document.getElementById('modal-tier-badge').style.borderColor = wDef.color;
        document.getElementById('modal-icon').innerText = wDef.icon;
        document.getElementById('modal-title').innerText = `${item.runeId ? `${rDef.prefix} ` : ''}${wDef.name} +${item.enhancement}`;
        document.getElementById('modal-title').style.color = item.runeId ? rDef.color : wDef.color;

        const statsContainer = document.getElementById('modal-stats');
        statsContainer.innerHTML = `
            <span>공격력: <b style="color:var(--accent-cyan);">${formatNumber(item.power)}</b></span>
            <span>품질: <b>${item.quality}%</b></span>
            <span>보너스: <b>${item.enhancement > 0 ? `+${item.enhancement}` : '없음'}</b></span>
        `;

        document.getElementById('modal-lore').innerText = wDef.lore;

        const actions = document.getElementById('modal-actions');
        const isEquipped = state.equippedWeaponUid === uid;
        const price = computeWeaponSalvagePrice(wDef, item.enhancement, item.quality, rDef);

        actions.innerHTML = `
            <button class="buy-upg-btn" style="flex:1;" id="modal-equip-btn">
                ${isEquipped ? '✅ 장착 중' : '⚔️ 대표 장착'}
            </button>
            <button class="mini-btn" id="modal-lock-btn">
                ${item.locked ? '🔒 잠금 해제' : '🔓 잠금'}
            </button>
            <button class="mini-btn danger" id="modal-salvage-btn" ${item.locked ? 'disabled' : ''}>
                💰 분해 (+${formatNumber(price)} 🪙)
            </button>
        `;

        document.getElementById('modal-equip-btn').onclick = () => {
            equipWeapon(uid);
            modal.classList.add('hidden');
        };
        document.getElementById('modal-lock-btn').onclick = () => {
            toggleLockInventoryItem(uid);
            showItemModal(uid);
        };
        document.getElementById('modal-salvage-btn').onclick = () => {
            salvageInventoryItem(uid);
            modal.classList.add('hidden');
        };

        modal.classList.remove('hidden');
        document.getElementById('modal-close-btn').onclick = () => modal.classList.add('hidden');
    }

    // ------------------------------------------------------------------------
    // 12. UI RENDERING & COMPONENT SYNC
    // ------------------------------------------------------------------------

    function updateUI() {
        // 1. Currencies
        document.getElementById('disp-gold').innerText = formatNumber(state.gold);
        document.getElementById('disp-ore').innerText = formatNumber(state.ore);
        const stageDisp = document.getElementById('disp-stage');
        if (stageDisp) stageDisp.innerText = (state.adventure ? state.adventure.currentStage : 1);
        document.getElementById('disp-total-dps').innerText = formatNumber(getMercenaryTotalDPS());

        // 2. Workbench & Current Weapon
        const wDef = window.WEAPONS_DATABASE.find(w => w.id === state.currentWeaponId);
        const rDef = getRuneDef(state.activeRuneId);
        const pwr = computeWeaponItemPower(wDef, state.currentEnhancement, state.currentQuality, rDef);
        const salvagePrice = computeWeaponSalvagePrice(wDef, state.currentEnhancement, state.currentQuality, rDef);

        const nameEl = document.getElementById('weapon-name');
        nameEl.innerText = `${rDef ? `${rDef.prefix} ` : ''}${wDef.name} ${state.currentEnhancement > 0 ? `+${state.currentEnhancement}` : ''}`;
        nameEl.style.color = rDef ? rDef.color : wDef.color;

        document.getElementById('weapon-icon').innerText = wDef.icon;
        document.getElementById('weapon-tier-badge').innerText = wDef.tier;
        document.getElementById('weapon-tier-badge').style.borderColor = wDef.color;
        document.getElementById('weapon-power').innerText = formatNumber(pwr);
        document.getElementById('weapon-quality').innerText = `${state.currentQuality}%`;
        document.getElementById('weapon-rarity-rate').innerText = wDef.rarityRate;
        document.getElementById('weapon-enhance').innerText = `+${state.currentEnhancement}`;
        const advMult = getAdventureBuffMultiplier();
        document.getElementById('weapon-multiplier').innerText = `x${advMult.toFixed(2)} 모험 버프 배수`;

        const statusBadge = document.getElementById('weapon-status-badge');
        if (state.isCraftingComplete) {
            statusBadge.innerText = '✨ 제련 완료! (보관/분해 가능)';
            statusBadge.className = 'weapon-status-badge ready';
        } else {
            statusBadge.innerText = '🔨 제련 진행 중...';
            statusBadge.className = 'weapon-status-badge';
        }

        // 3. Progress bar
        const pct = Math.min(100, Math.floor(state.forgeProgress));
        document.getElementById('forge-pct').innerText = `${pct}%`;
        document.getElementById('forge-bar').style.width = `${pct}%`;
        document.getElementById('anvil-power-hint').innerText = `+${getHammerProgressPerHit()}% per hit`;

        // 4. Action Buttons (Fix money duplication bug by checking state.isCraftingComplete)
        const claimBtn = document.getElementById('claim-to-inv-btn');
        const salvageBtn = document.getElementById('equip-or-sell-btn');

        claimBtn.disabled = !state.isCraftingComplete;
        salvageBtn.disabled = !state.isCraftingComplete;
        document.getElementById('salvage-gold-preview').innerText = formatNumber(salvagePrice);

        // 5. Rune altar preview
        const selector = document.getElementById('rune-target-select');
        const selectedUid = selector ? selector.value : 'current';
        let targetRuneDef = rDef;

        if (selectedUid && selectedUid !== 'current') {
            const targetItem = state.inventory.find(i => i.uid === selectedUid);
            if (targetItem) {
                targetRuneDef = getRuneDef(targetItem.runeId);
            }
        }

        if (targetRuneDef) {
            document.getElementById('active-rune-name').innerText = targetRuneDef.name;
            document.getElementById('active-rune-name').style.color = targetRuneDef.color;
            document.getElementById('active-rune-desc').innerText = targetRuneDef.desc;
        } else {
            document.getElementById('active-rune-name').innerText = '각인된 룬 없음';
            document.getElementById('active-rune-name').style.color = '#fff';
            document.getElementById('active-rune-desc').innerText = '에테르 광석 50개를 소모해 고대 룬을 추출하세요.';
        }
        document.getElementById('roll-rune-btn').disabled = state.ore < 50;

        // 6. Upgrades Button State (DOM을 파괴하지 않고 disabled/텍스트 상태만 갱신)
        updateUpgradeButtonsState();

        // 7. Dungeons Button State
        updateDungeonButtonsState();

        // 8. Blacksmith UI State (실시간 재화 상태 및 버튼 갱신)
        updateBlacksmithUI();
    }

    // ------------------------------------------------------------------------
    // 13. DYNAMIC COMPONENT RENDERERS
    // ------------------------------------------------------------------------

    function renderUpgradesList() {
        const container = document.getElementById('upgrades-list');
        if (!container) return;
        container.innerHTML = '';

        window.UPGRADES_DATABASE.forEach(def => {
            const currentLvl = state.upgrades[def.id] || 0;
            const cost = Math.floor(def.baseCost * Math.pow(def.costMul, currentLvl));
            const isMax = currentLvl >= def.maxLevel;
            const canAfford = state.gold >= cost && !isMax;

            const card = document.createElement('div');
            card.className = `upgrade-card ${isMax ? 'locked' : ''}`;
            card.id = `upg-card-${def.id}`;
            card.innerHTML = `
                <div class="upg-info">
                    <span class="upg-title">${def.title}</span>
                    <span class="upg-desc">${def.desc}</span>
                    <span class="upg-level" id="upg-lvl-${def.id}">레벨: ${currentLvl} / ${def.maxLevel}</span>
                </div>
                <button class="buy-upg-btn" id="upg-btn-${def.id}" data-id="${def.id}" ${canAfford ? '' : 'disabled'}>
                    ${isMax ? 'MAXED' : `${formatNumber(cost)} 🪙`}
                </button>
            `;

            container.appendChild(card);
        });
    }

    // 매 프레임 DOM 파괴 없이 버튼 활성화/비활성화 상태만 효율적으로 업데이트
    function updateUpgradeButtonsState() {
        window.UPGRADES_DATABASE.forEach(def => {
            const btn = document.getElementById(`upg-btn-${def.id}`);
            const lvlEl = document.getElementById(`upg-lvl-${def.id}`);
            if (!btn) return;

            const currentLvl = state.upgrades[def.id] || 0;
            const cost = Math.floor(def.baseCost * Math.pow(def.costMul, currentLvl));
            const isMax = currentLvl >= def.maxLevel;
            const canAfford = state.gold >= cost && !isMax;

            btn.disabled = !canAfford;
            if (isMax) {
                btn.innerText = 'MAXED';
            } else {
                btn.innerText = `${formatNumber(cost)} 🪙`;
            }
            if (lvlEl) {
                lvlEl.innerText = `레벨: ${currentLvl} / ${def.maxLevel}`;
            }
        });
    }

    function renderInventoryList() {
        const grid = document.getElementById('inventory-grid');
        const badge = document.getElementById('inv-count-badge');
        const eqDisplay = document.getElementById('equipped-weapon-display');
        if (!grid || !badge) return;

        badge.innerText = `${state.inventory.length}/${state.maxInventorySlots}`;

        // 정렬 기준
        const sortSelect = document.getElementById('inv-sort-select');
        const sortBy = sortSelect ? sortSelect.value : 'power';

        let sortedItems = [...state.inventory];
        sortedItems.sort((a, b) => {
            if (sortBy === 'power') return b.power - a.power;
            if (sortBy === 'enhance') return b.enhancement - a.enhancement;
            if (sortBy === 'recent') return b.forgedAt - a.forgedAt;
            if (sortBy === 'tier') {
                const tierOrder = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6, Godly: 7 };
                const aDef = window.WEAPONS_DATABASE.find(w => w.id === a.id);
                const bDef = window.WEAPONS_DATABASE.find(w => w.id === b.id);
                return (tierOrder[bDef ? bDef.tier : 'Common'] || 0) - (tierOrder[aDef ? aDef.tier : 'Common'] || 0);
            }
            return 0;
        });

        grid.innerHTML = '';
        if (sortedItems.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 30px;">보관된 무기가 없습니다. 제련을 완료하고 보관하세요!</div>';
        } else {
            sortedItems.forEach(item => {
                const wDef = window.WEAPONS_DATABASE.find(w => w.id === item.id);
                const rDef = getRuneDef(item.runeId);
                const isEquipped = state.equippedWeaponUid === item.uid;

                const slot = document.createElement('div');
                slot.className = `inv-slot ${isEquipped ? 'equipped' : ''}`;
                slot.style.borderColor = rDef ? rDef.color : (wDef ? wDef.color : '#fff');
                const price = computeWeaponSalvagePrice(wDef, item.enhancement, item.quality, rDef);

                slot.innerHTML = `
                    <div class="inv-icon">${wDef ? wDef.icon : '🗡️'}</div>
                    <div class="inv-name" style="color:${rDef ? rDef.color : (wDef ? wDef.color : '#fff')}">
                        ${item.enhancement > 0 ? `+${item.enhancement} ` : ''}${wDef ? wDef.name : 'Unknown'}
                    </div>
                    <div class="inv-power">⚡ ${formatNumber(item.power)}</div>
                    <div class="inv-slot-actions">
                        <button class="inv-action-btn lock ${item.locked ? 'is-locked' : ''}" title="${item.locked ? '잠금 해제' : '잠금'}">
                            ${item.locked ? '🔒' : '🔓'}
                        </button>
                        <button class="inv-action-btn sell" title="즉시 분해 (+${formatNumber(price)} 🪙)" ${item.locked ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                            💰 판매
                        </button>
                    </div>
                `;

                // 슬롯 자체를 누르면 상세 모달 표시 (버튼 제외)
                slot.addEventListener('click', (e) => {
                    if (e.target.closest('.inv-action-btn')) return;
                    showItemModal(item.uid);
                });

                // 잠금 토글 버튼 이벤트
                const lockBtn = slot.querySelector('.inv-action-btn.lock');
                if (lockBtn) {
                    lockBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleLockInventoryItem(item.uid);
                    });
                }

                // 즉시 판매 버튼 이벤트
                const sellBtn = slot.querySelector('.inv-action-btn.sell');
                if (sellBtn && !item.locked) {
                    sellBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        salvageInventoryItem(item.uid);
                    });
                }

                grid.appendChild(slot);
            });
        }

        // 장착된 대표 무기 카드 표시
        const equippedItem = getEquippedWeapon();
        if (equippedItem && eqDisplay) {
            const wDef = window.WEAPONS_DATABASE.find(w => w.id === equippedItem.id);
            const rDef = getRuneDef(equippedItem.runeId);
            eqDisplay.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:2.2rem;">${wDef ? wDef.icon : '🗡️'}</span>
                    <div>
                        <div style="font-weight:800; font-size:1rem; color:${rDef ? rDef.color : wDef.color}">
                            ${rDef ? `[${rDef.name}] ` : ''}${wDef.name} +${equippedItem.enhancement}
                        </div>
                        <div style="font-size:0.78rem; color:#aaa;">
                            공격력: <b style="color:var(--accent-cyan);">${formatNumber(equippedItem.power)}</b> | 품질: <b>${equippedItem.quality}%</b>
                        </div>
                    </div>
                </div>
                <button class="mini-btn" id="unequip-active-btn">장착 해제</button>
            `;
            const unequipBtn = document.getElementById('unequip-active-btn');
            if (unequipBtn) {
                unequipBtn.onclick = () => {
                    state.equippedWeaponUid = null;
                    updateUI();
                    autoSave();
                };
            }
        } else if (eqDisplay) {
            eqDisplay.innerHTML = '<span class="none-text">장착된 대표 무기가 없습니다. 인벤토리에서 무기를 선택하여 장착하세요.</span>';
        }
    }

    function renderCodexList() {
        const grid = document.getElementById('codex-grid');
        const badge = document.getElementById('codex-count-badge');
        const pctEl = document.getElementById('codex-completion-pct');
        if (!grid || !badge) return;

        const allWeapons = window.WEAPONS_DATABASE;
        const totalWeaponsCount = allWeapons.length;
        const discoveredCount = Object.keys(state.codex).length;
        const pct = Math.floor((discoveredCount / totalWeaponsCount) * 100);

        badge.innerText = `${discoveredCount}/${totalWeaponsCount}`;
        if (pctEl) pctEl.innerText = `${pct}% (+${discoveredCount * 2}% 보너스)`;

        grid.innerHTML = '';
        allWeapons.forEach(w => {
            const record = state.codex[w.id];
            const isUnlocked = !!record;

            const card = document.createElement('div');
            card.className = `codex-card ${isUnlocked ? '' : 'locked'}`;
            card.style.borderColor = isUnlocked ? w.color : 'rgba(255,255,255,0.08)';

            if (isUnlocked) {
                card.innerHTML = `
                    <div class="codex-icon">${w.icon}</div>
                    <div class="codex-name" style="color:${w.color};">${w.name}</div>
                    <div class="codex-tier" style="color:${w.color};">${w.tier} (1/${w.rarityRate})</div>
                    <div class="codex-lore">${w.lore}</div>
                    <div class="codex-bonus">제련 횟수: ${record.timesForged}회 | 최고 강화: +${record.maxEnhance}</div>
                `;
            } else {
                card.innerHTML = `
                    <div class="codex-icon">❓</div>
                    <div class="codex-name" style="color:#666;">미지의 무기</div>
                    <div class="codex-tier" style="color:#555;">${w.tier}</div>
                    <div class="codex-lore">아직 모루에서 제련하지 않은 비밀 무기입니다. 망치질을 계속하세요.</div>
                `;
            }

            grid.appendChild(card);
        });
    }

    function renderDungeonsList() {
        const container = document.getElementById('dungeon-list');
        if (!container) return;
        container.innerHTML = '';

        const currentDPS = getMercenaryTotalDPS();
        let totalGoldPerSec = 0;
        let totalOrePerSec = 0;

        window.DUNGEONS_DATABASE.forEach(d => {
            const isUnlocked = (state.dungeons[d.id] || 0) > 0;
            const canAfford = state.gold >= d.cost && currentDPS >= d.reqPower;

            if (isUnlocked) {
                totalGoldPerSec += d.goldPerSec;
                totalOrePerSec += d.orePerSec;
            }

            const card = document.createElement('div');
            card.className = `upgrade-card ${isUnlocked ? 'unlocked' : ''}`;
            card.id = `dungeon-card-${d.id}`;
            card.innerHTML = `
                <div class="upg-info">
                    <span class="upg-title" id="dungeon-title-${d.id}">${d.name} ${isUnlocked ? '⚔️ [원정 중]' : '🔒'}</span>
                    <span class="upg-desc">${d.desc}</span>
                    <span class="upg-level">요구 전투력: ${formatNumber(d.reqPower)} | 수익: +${formatNumber(d.goldPerSec)} Gold/s, +${d.orePerSec} Ore/s</span>
                </div>
                <div id="dungeon-action-${d.id}">
                    ${isUnlocked ? '<span style="color:#00ffaa; font-weight:800; font-size:0.85rem;">탐험 가동 중</span>' : `
                        <button class="buy-upg-btn" id="dungeon-btn-${d.id}" data-id="${d.id}" ${canAfford ? '' : 'disabled'}>
                            해금: ${formatNumber(d.cost)} 🪙
                        </button>
                    `}
                </div>
            `;

            container.appendChild(card);
        });

        document.getElementById('exp-total-dps').innerText = formatNumber(currentDPS);
        document.getElementById('exp-passive-income').innerText = `+${formatNumber(totalGoldPerSec)} Gold/s`;
        document.getElementById('exp-passive-ore').innerText = `+${totalOrePerSec.toFixed(1)} Ore/s`;
    }

    // 매 프레임 던전 버튼 활성화 상태 및 합산 통계만 갱신
    function updateDungeonButtonsState() {
        const currentDPS = getMercenaryTotalDPS();
        let totalGoldPerSec = 0;
        let totalOrePerSec = 0;

        window.DUNGEONS_DATABASE.forEach(d => {
            const isUnlocked = (state.dungeons[d.id] || 0) > 0;
            const canAfford = state.gold >= d.cost && currentDPS >= d.reqPower;

            if (isUnlocked) {
                totalGoldPerSec += d.goldPerSec;
                totalOrePerSec += d.orePerSec;
            }

            const btn = document.getElementById(`dungeon-btn-${d.id}`);
            if (btn && !isUnlocked) {
                btn.disabled = !canAfford;
            }
        });

        const dpsEl = document.getElementById('exp-total-dps');
        const incEl = document.getElementById('exp-passive-income');
        const oreEl = document.getElementById('exp-passive-ore');
        if (dpsEl) dpsEl.innerText = formatNumber(currentDPS);
        if (incEl) incEl.innerText = `+${formatNumber(totalGoldPerSec)} Gold/s`;
        if (oreEl) oreEl.innerText = `+${totalOrePerSec.toFixed(1)} Ore/s`;
    }

    // ------------------------------------------------------------------------
    // 14. SAVE & LOAD SYSTEM (LOCALSTORAGE)
    // ------------------------------------------------------------------------

    function autoSave() {
        try {
            state.lastSaveTimestamp = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Save failed:', e);
        }
    }

    function loadGame() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                state = Object.assign({}, defaultState, parsed);
                // 중첩 객체 깊은 병합
                state.upgrades = Object.assign({}, defaultState.upgrades, parsed.upgrades || {});
                state.dungeons = Object.assign({}, defaultState.dungeons, parsed.dungeons || {});
                state.codex = Object.assign({}, parsed.codex || {});
                state.inventory = Array.isArray(parsed.inventory) ? parsed.inventory : [];
                state.settings = Object.assign({}, defaultState.settings, parsed.settings || {});
                state.autoFilter = Object.assign({}, defaultState.autoFilter, parsed.autoFilter || {});
                state.adventure = Object.assign({}, defaultState.adventure, parsed.adventure || {});
                showToast('💾 저장된 게임 데이터를 성공적으로 불러왔습니다!', 'info');
            }
        } catch (e) {
            console.error('Load failed:', e);
        }
    }

    function hardResetGame() {
        if (!confirm('⚠️ 정말로 모든 진행 상황을 완전히 삭제하고 초기화하시겠습니까?')) return;
        if (!confirm('경고: 복구할 수 없습니다. 모든 무기와 도감 기록이 사라집니다.')) return;

        localStorage.removeItem(SAVE_KEY);
        location.reload();
    }

    // ------------------------------------------------------------------------
    // 15. MAIN TICK GAME LOOP (PASSIVE REVENUE & AUTO-HAMMER)
    // ------------------------------------------------------------------------

    let lastTickTime = performance.now();
    let autoHammerAccumulator = 0;

    function gameLoop(currentTime) {
        const dt = (currentTime - lastTickTime) / 1000;
        lastTickTime = currentTime;

        // 원정대 초당 자동 생산
        let passiveGold = 0;
        let passiveOre = 0;
        window.DUNGEONS_DATABASE.forEach(d => {
            if ((state.dungeons[d.id] || 0) > 0) {
                passiveGold += d.goldPerSec;
                passiveOre += d.orePerSec;
            }
        });

        // 룬 버프 효과 (에테르의 룬 초당 +1 광석)
        if (state.activeRuneId === 'r_ether') {
            passiveOre += 1.0;
        }

        if (passiveGold > 0) state.gold += passiveGold * dt;
        if (passiveOre > 0) state.ore += passiveOre * dt;

        // 자동 풀무질 타격 (Auto Hammer - 토글이 ON일 때만 작동)
        if (state.settings.autoHammer) {
            autoHammerAccumulator += dt;
            const interval = getAutoBellowsInterval();
            if (autoHammerAccumulator >= interval) {
                autoHammerAccumulator = 0;
                strikeAnvil(null);
            }
        } else {
            autoHammerAccumulator = 0; // OFF일 때는 누적 타이머 리셋
        }

        updateUI();
        requestAnimationFrame(gameLoop);
    }

    // ------------------------------------------------------------------------
    // 16. EVENT LISTENERS INITIALIZATION
    // ------------------------------------------------------------------------

    window.addEventListener('DOMContentLoaded', () => {
        particlesInstance = new window.ParticleEngine('particle-canvas');

        // 1. 세이브 데이터 로드
        loadGame();

        // 2. 모루 타격
        const anvilBtn = document.getElementById('anvil-btn');
        if (anvilBtn) {
            anvilBtn.addEventListener('click', (e) => strikeAnvil(e));
        }

        // 3. 인벤토리 보관 & 분해 버튼
        const claimBtn = document.getElementById('claim-to-inv-btn');
        if (claimBtn) {
            claimBtn.addEventListener('click', claimCurrentWeaponToInventory);
        }

        const salvageBtn = document.getElementById('equip-or-sell-btn');
        if (salvageBtn) {
            salvageBtn.addEventListener('click', salvageCurrentWeapon);
        }

        // 4. 자동 망치질 토글
        const autoHammerBtn = document.getElementById('auto-hammer-btn');
        if (autoHammerBtn) {
            const updateAutoHammerBtnUI = () => {
                const statusSpan = document.getElementById('auto-hammer-status');
                if (statusSpan) {
                    statusSpan.innerText = state.settings.autoHammer ? 'ON' : 'OFF';
                    statusSpan.style.color = state.settings.autoHammer ? '#00ffaa' : '#ff5555';
                }
            };
            updateAutoHammerBtnUI();

            autoHammerBtn.addEventListener('click', () => {
                state.settings.autoHammer = !state.settings.autoHammer;
                autoHammerAccumulator = 0;
                updateAutoHammerBtnUI();
                showToast(state.settings.autoHammer ? '🤖 자동 망치질(Auto Hammer) 활성화!' : '⏸️ 자동 망치질(Auto Hammer) 정지', 'info');
                autoSave();
            });
        }

        // 5. 룬 인챈트
        const rollRuneBtn = document.getElementById('roll-rune-btn');
        if (rollRuneBtn) {
            rollRuneBtn.addEventListener('click', () => rollRune());
        }

        // 5-1. 룬 자동 인챈트 토글 버튼
        const autoRuneToggleBtn = document.getElementById('auto-rune-toggle-btn');
        if (autoRuneToggleBtn) {
            autoRuneToggleBtn.addEventListener('click', () => {
                if (isAutoRuneActive) {
                    stopAutoRune();
                } else {
                    startAutoRune();
                }
            });
        }

        // 7. 상단 헤더 컨트롤
        const craftToastToggleBtn = document.getElementById('toggle-craft-toast-btn');
        if (craftToastToggleBtn) {
            const updateToastBtnUI = () => {
                const textEl = document.getElementById('craft-toast-status-text');
                if (state.settings.showCraftToast) {
                    craftToastToggleBtn.className = 'hud-pill-btn active';
                    if (textEl) textEl.innerText = 'ON';
                } else {
                    craftToastToggleBtn.className = 'hud-pill-btn muted';
                    if (textEl) textEl.innerText = 'OFF';
                }
            };
            updateToastBtnUI();

            craftToastToggleBtn.addEventListener('click', () => {
                state.settings.showCraftToast = !state.settings.showCraftToast;
                updateToastBtnUI();
                showToast(state.settings.showCraftToast ? '🔔 장비 획득/제련 알림 팝업이 켜졌습니다.' : '🔕 장비 획득/제련 알림 팝업을 껐습니다. (조용히 플레이)', 'info');
                autoSave();
            });
        }

        const cutsceneToggleBtn = document.getElementById('toggle-cutscene-btn');
        if (cutsceneToggleBtn) {
            const updateCutsceneBtnUI = () => {
                const textEl = document.getElementById('cutscene-status-text');
                if (state.settings.showCutscene) {
                    cutsceneToggleBtn.className = 'hud-pill-btn active';
                    if (textEl) textEl.innerText = 'ON';
                } else {
                    cutsceneToggleBtn.className = 'hud-pill-btn muted';
                    if (textEl) textEl.innerText = 'OFF';
                }
            };
            updateCutsceneBtnUI();

            cutsceneToggleBtn.addEventListener('click', () => {
                state.settings.showCutscene = !state.settings.showCutscene;
                updateCutsceneBtnUI();
                showToast(state.settings.showCutscene ? '🎬 고등급 컷신 팝업을 표시합니다.' : '⚡ 컷신 팝업을 건너뛰고 빠른 제작 모드로 전환합니다.', 'info');
                autoSave();
            });
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                autoSave();
                showToast('💾 수동 저장 완료!', 'success');
            });
        }

        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const muted = window.SoundFX.toggleMute();
                showToast(muted ? '🔇 음소거되었습니다.' : '🔊 효과음이 켜졌습니다.', 'info');
            });
        }

        const hardResetBtn = document.getElementById('hard-reset-btn');
        if (hardResetBtn) {
            hardResetBtn.addEventListener('click', hardResetGame);
        }

        // 8. 잠금 외 모두 판매 버튼
        const sellUnlockedBtn = document.getElementById('inv-sell-unlocked-btn');
        if (sellUnlockedBtn) {
            sellUnlockedBtn.addEventListener('click', salvageAllUnlockedItems);
        }

        // 9. 탭 네비게이션
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-tab');
                const targetEl = document.getElementById(targetId);
                if (targetEl) targetEl.classList.add('active');

                // 탭 전환 시 필요한 목록 즉시 최신화
                if (targetId === 'tab-upgrades') renderUpgradesList();
                if (targetId === 'tab-blacksmith') renderBlacksmithSelector();
                if (targetId === 'tab-inventory') renderInventoryList();
                if (targetId === 'tab-codex') renderCodexList();
                if (targetId === 'tab-runes') renderRuneTargetSelector();
                if (targetId === 'tab-expedition') renderDungeonsList();
                if (targetId === 'tab-adventure') renderAdventureStageUI();
            });
        });

        // 9-1. 업그레이드 및 던전 이벤트 위임 (이벤트 누락 방지 & 고속 클릭 보장)
        const upgradesListEl = document.getElementById('upgrades-list');
        if (upgradesListEl) {
            upgradesListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.buy-upg-btn');
                if (btn && !btn.disabled) {
                    const upgId = btn.getAttribute('data-id');
                    if (upgId) buyUpgrade(upgId);
                }
            });
        }

        const dungeonListEl = document.getElementById('dungeon-list');
        if (dungeonListEl) {
            dungeonListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.buy-upg-btn');
                if (btn && !btn.disabled) {
                    const dunId = btn.getAttribute('data-id');
                    if (dunId) unlockDungeon(dunId);
                }
            });
        }

        // 9-2. 스마트 자동 분류 (Auto-Filter) 입력 이벤트 바인딩
        initAutoFilterControls();

        // 9-3. 최초 업그레이드, 인벤토리, 도감, 던전 UI 빌드
        renderUpgradesList();
        renderBlacksmithSelector();
        renderInventoryList();
        renderCodexList();
        renderDungeonsList();
        renderRuneTargetSelector();

        // 9-3-1. 대장장이 셀렉터 및 강화 실행 버튼 바인딩
        const smithSel = document.getElementById('smith-target-select');
        if (smithSel) {
            smithSel.addEventListener('change', updateBlacksmithUI);
        }
        const smithBtn = document.getElementById('smith-enhance-btn');
        if (smithBtn) {
            smithBtn.addEventListener('click', executeBlacksmithEnhance);
        }

        // 9-4. 룬 각인 대상 무기 셀렉터 변경 시 프리뷰 즉시 업데이트
        const runeTargetSel = document.getElementById('rune-target-select');
        if (runeTargetSel) {
            runeTargetSel.addEventListener('change', updateUI);
        }

        // 9-5. 실시간 모험 (RPG) 컨트롤 버튼 및 키보드 조작 바인딩
        const prevStageBtn = document.getElementById('adv-prev-stage-btn');
        if (prevStageBtn) {
            prevStageBtn.addEventListener('click', () => {
                selectAdventureStage((state.adventure.currentStage || 1) - 1);
            });
        }

        const nextStageBtn = document.getElementById('adv-next-stage-btn');
        if (nextStageBtn) {
            nextStageBtn.addEventListener('click', () => {
                selectAdventureStage((state.adventure.currentStage || 1) + 1);
            });
        }

        const startBattleBtn = document.getElementById('adv-start-battle-btn');
        if (startBattleBtn) {
            startBattleBtn.addEventListener('click', startAdventureBattle);
        }

        const giveupBtn = document.getElementById('adv-giveup-btn');
        if (giveupBtn) {
            giveupBtn.addEventListener('click', () => {
                if (adventureBattleState && adventureBattleState.active) {
                    endAdventureBattle(false, '🏳️ 전투에서 퇴각했습니다.');
                }
            });
        }

        // 캔버스 클릭 공격
        const advCanvas = document.getElementById('adventure-canvas');
        if (advCanvas) {
            advCanvas.addEventListener('mousedown', (e) => {
                if (adventureBattleState && adventureBattleState.active) {
                    performPlayerAttack();
                }
            });
        }

        // 키보드 이벤트 (WASD + Space)
        window.addEventListener('keydown', (e) => {
            // RPG 전투 활성 상태일 때 Space 또는 방향키/WASD 기본 동작(스크롤, 포커스된 버튼 재클릭 등) 방지
            const isMovementOrActionKey = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space'].includes(e.code);
            if (isMovementOrActionKey && adventureBattleState && adventureBattleState.active) {
                e.preventDefault();
            }

            const k = e.key.toLowerCase();
            if (k === 'w' || e.key === 'ArrowUp') playerKeys.w = true;
            if (k === 'a' || e.key === 'ArrowLeft') playerKeys.a = true;
            if (k === 's' || e.key === 'ArrowDown') playerKeys.s = true;
            if (k === 'd' || e.key === 'ArrowRight') playerKeys.d = true;
            if (e.code === 'Space') {
                e.preventDefault(); // 스페이스바로 포커스된 버튼(출격/포기/모루 등)이 재트리거되어 전투가 초기화되는 문제 방지
                playerKeys.space = true;
                if (adventureBattleState && adventureBattleState.active) {
                    performPlayerAttack();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || e.key === 'ArrowUp') playerKeys.w = false;
            if (k === 'a' || e.key === 'ArrowLeft') playerKeys.a = false;
            if (k === 's' || e.key === 'ArrowDown') playerKeys.s = false;
            if (k === 'd' || e.key === 'ArrowRight') playerKeys.d = false;
            if (e.code === 'Space') {
                e.preventDefault();
                playerKeys.space = false;
            }
        });

        renderAdventureStageUI();

        // 10. 인벤토리 정렬 필터 변경
        const sortSelect = document.getElementById('inv-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', renderInventoryList);
        }

        // 11. 고대 룬 로스터 목록 렌더링
        const runeListContainer = document.getElementById('rune-collection-list');
        if (runeListContainer) {
            window.RUNES_DATABASE.forEach(r => {
                const item = document.createElement('div');
                item.className = 'upgrade-card';
                item.style.borderColor = r.color;
                item.innerHTML = `
                    <div class="upg-info">
                        <span class="upg-title" style="color:${r.color}">${r.name} (${r.prefix})</span>
                        <span class="upg-desc">${r.desc}</span>
                    </div>
                    <span style="font-size:0.8rem; font-weight:800; color:#aaa;">${r.weight}% 확률</span>
                `;
                runeListContainer.appendChild(item);
            });
        }

        // 10초 주기 자동 저장
        setInterval(autoSave, 10000);

        // 첫 프레임 UI 업데이트 및 루프 개시
        updateUI();
        requestAnimationFrame(gameLoop);
    });

})();
