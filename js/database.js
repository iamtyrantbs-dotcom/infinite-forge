// ============================================================================
// INFINITE FORGE - DATABASE & DEFINITIONS (WEAPONS, RUNES, UPGRADES, DUNGEONS)
// ============================================================================

const WEAPONS_DATABASE = [
    // Tier 1: Common (일반)
    {
        id: 'w_rusty_dagger',
        name: '녹슨 단검',
        engName: 'Rusty Dagger',
        icon: '🗡️',
        basePower: 10,
        rarityRate: '1/1 (100%)',
        weight: 45.0,
        tier: 'Common',
        color: '#a0a0a0',
        lore: '광산에서 버려진 녹슨 쇠붙이를 대충 갈아 만든 단검. 무기라 부르기도 민망하지만 시작으로는 충분하다.',
        cutscene: false
    },
    {
        id: 'w_wooden_club',
        name: '오크 방망이',
        engName: 'Oak Club',
        icon: '🪵',
        basePower: 18,
        rarityRate: '1/2 (50%)',
        weight: 35.0,
        tier: 'Common',
        color: '#b08968',
        lore: '단단한 참나무를 깎고 가시못을 박아 제작한 거친 몽둥이.',
        cutscene: false
    },
    {
        id: 'w_iron_shortsword',
        name: '견습 대장장이 숏소드',
        engName: 'Apprentice Shortsword',
        icon: '⚔️',
        basePower: 28,
        rarityRate: '1/3 (33%)',
        weight: 20.0,
        tier: 'Common',
        color: '#c0c0c0',
        lore: '처음으로 쇳물을 붓고 담금질을 마친 기본 철제 검.',
        cutscene: false
    },

    // Tier 2: Uncommon (고급)
    {
        id: 'w_steel_broadsword',
        name: '강철 브로드소드',
        engName: 'Steel Broadsword',
        icon: '🗡️',
        basePower: 65,
        rarityRate: '1/5 (20%)',
        weight: 15.0,
        tier: 'Uncommon',
        color: '#4ade80',
        lore: '정제된 연철을 여러 겹 접어 단조한 튼튼한 장검. 기병들이 애용한다.',
        cutscene: false
    },
    {
        id: 'w_war_hammer',
        name: '전투 모루 해머',
        engName: 'War Anvil Hammer',
        icon: '🔨',
        basePower: 110,
        rarityRate: '1/8 (12.5%)',
        weight: 12.0,
        tier: 'Uncommon',
        color: '#22c55e',
        lore: '대장장이들이 적의 갑옷째로 뼈를 으스러뜨리기 위해 개조한 육중한 망치.',
        cutscene: false
    },
    {
        id: 'w_frost_spear',
        name: '서리 깃든 창',
        engName: 'Frost Spear',
        icon: '🔱',
        basePower: 175,
        rarityRate: '1/15 (6.6%)',
        weight: 8.0,
        tier: 'Uncommon',
        color: '#67e8f9',
        lore: '얼어붙은 만년설수로 담금질하여 칼날 끝에 항상 냉기가 서려 있다.',
        cutscene: false
    },

    // Tier 3: Rare (희귀)
    {
        id: 'w_obsidian_cleaver',
        name: '흑요석 대도',
        engName: 'Obsidian Cleaver',
        icon: '🪓',
        basePower: 380,
        rarityRate: '1/30 (3.3%)',
        weight: 4.5,
        tier: 'Rare',
        color: '#38bdf8',
        lore: '화산 심층부의 흑요석을 제련하여 만든 무기. 유리처럼 날카로우면서도 깨지지 않는다.',
        cutscene: false
    },
    {
        id: 'w_storm_glaive',
        name: '뇌우의 글레이브',
        engName: 'Storm Glaive',
        icon: '⚡',
        basePower: 650,
        rarityRate: '1/60 (1.6%)',
        weight: 3.0,
        tier: 'Rare',
        color: '#60a5fa',
        lore: '번개가 내리친 바위산을 채굴한 광석으로 벼려낸 장병기. 휘두를 때마다 찌릿한 스파크가 튄다.',
        cutscene: false
    },
    {
        id: 'w_blood_fang_dagger',
        name: '진홍빛 흡혈단도',
        engName: 'Crimson Bloodfang',
        icon: '🩸',
        basePower: 1100,
        rarityRate: '1/120 (0.83%)',
        weight: 1.8,
        tier: 'Rare',
        color: '#f43f5e',
        lore: '마수의 송곳니를 갈아 붉은 루비 용액에 담가 완성했다. 적의 생명력을 흡수할 것만 같다.',
        cutscene: false
    },

    // Tier 4: Epic (영웅)
    {
        id: 'w_sunforged_halberd',
        name: '태양단조 할버드',
        engName: 'Sunforged Halberd',
        icon: '🔱',
        basePower: 2600,
        rarityRate: '1/250 (0.4%)',
        weight: 0.9,
        tier: 'Epic',
        color: '#c084fc',
        lore: '작열하는 태양빛을 모아 제련한 성기사의 무기. 어둠을 정화하는 눈부신 빛을 뿜는다.',
        cutscene: false
    },
    {
        id: 'w_abyssal_scythe',
        name: '심연 영혼의 낫',
        engName: 'Abyssal Soul Scythe',
        icon: '🌙',
        basePower: 4500,
        rarityRate: '1/500 (0.2%)',
        weight: 0.5,
        tier: 'Epic',
        color: '#a855f7',
        lore: '죽은 자들의 한숨과 심연의 암흑광물을 융합해 벼려낸 사신의 낫.',
        cutscene: false
    },
    {
        id: 'w_phoenix_claymore',
        name: '불사조 대검',
        engName: 'Phoenix Flame Claymore',
        icon: '🔥',
        basePower: 8200,
        rarityRate: '1/1,000 (0.1%)',
        weight: 0.25,
        tier: 'Epic',
        color: '#f97316',
        lore: '잿더미 속에서 다시 태어나는 불사조의 깃털을 모루 위에 얹고 망치질하여 깃들인 명검.',
        cutscene: true
    },

    // Tier 5: Legendary (전설)
    {
        id: 'w_dragonbone_katana',
        name: '용골도 무라마사',
        engName: 'Dragonbone Muramasa',
        icon: '🐉',
        basePower: 22000,
        rarityRate: '1/3,000 (0.033%)',
        weight: 0.08,
        tier: 'Legendary',
        color: '#f59e0b',
        lore: '고대 드래곤의 척추골을 깎아 수만 번의 접쇠 공정을 거쳐 탄생한 살기 어린 명도.',
        cutscene: true
    },
    {
        id: 'w_aegis_breaker',
        name: '신성 파괴자 발뭉',
        engName: 'Aegis Breaker Balmung',
        icon: '🛡️',
        basePower: 48000,
        rarityRate: '1/8,000 (0.0125%)',
        weight: 0.035,
        tier: 'Legendary',
        color: '#fbbf24',
        lore: '어떤 마법 방벽도 두부 베듯 가를 수 있다는 파괴의 검.',
        cutscene: true
    },
    {
        id: 'w_celestial_bow',
        name: '천공의 별자리궁',
        engName: 'Celestial Star Bow',
        icon: '🏹',
        basePower: 95000,
        rarityRate: '1/20,000 (0.005%)',
        weight: 0.015,
        tier: 'Legendary',
        color: '#eab308',
        lore: '떨어지는 유성을 잡아 당겨 시위를 만들었다고 전해지는 전설의 활.',
        cutscene: true
    },

    // Tier 6: Mythic (신화)
    {
        id: 'w_astral_voidblade',
        name: '아스트랄 보이드블레이드',
        engName: 'Astral Voidblade',
        icon: '🌌',
        basePower: 260000,
        rarityRate: '1/50,000 (0.002%)',
        weight: 0.006,
        tier: 'Mythic',
        color: '#ec4899',
        lore: '시공간의 왜곡 현상 자체를 물질화하여 칼날로 고정시켰다. 벨 수 없는 것이 없다.',
        cutscene: true
    },
    {
        id: 'w_chronos_edge',
        name: '시간의 파편 크로노스',
        engName: 'Chronos Time Fragment',
        icon: '⌛',
        basePower: 650000,
        rarityRate: '1/150,000 (0.00067%)',
        weight: 0.0025,
        tier: 'Mythic',
        color: '#d946ef',
        lore: '과거와 미래의 궤적이 겹쳐져, 적이 베이기 전 이미 상처가 벌어진다.',
        cutscene: true
    },
    {
        id: 'w_supernova_lance',
        name: '초신성 분쇄창',
        engName: 'Supernova Lance',
        icon: '🌠',
        basePower: 1600000,
        rarityRate: '1/400,000 (0.00025%)',
        weight: 0.001,
        tier: 'Mythic',
        color: '#a21caf',
        lore: '항성이 붕괴하며 방출하는 폭발 에너지를 한 점에 응축하여 만든 무기.',
        cutscene: true
    },

    // Tier 7: Godly (신살 / 천상계)
    {
        id: 'w_ragnarok_sovereign',
        name: '라그나로크 소버린',
        engName: 'Ragnarok Sovereign',
        icon: '🌋',
        basePower: 5500000,
        rarityRate: '1/1,000,000 (0.0001%)',
        weight: 0.00035,
        tier: 'Godly',
        color: '#ef4444',
        lore: '세상의 종말을 선고하는 거인의 불꽃. 대지가 울부짖고 신들이 공포에 떤다.',
        cutscene: true
    },
    {
        id: 'w_primordial_genesis',
        name: '태초의 창세기 신살검',
        engName: 'Genesis God Slayer',
        icon: '✨',
        basePower: 18000000,
        rarityRate: '1/3,500,000 (0.000028%)',
        weight: 0.0001,
        tier: 'Godly',
        color: '#ff2255',
        lore: '우주가 팽창하기 이전 한 점에 모여있던 순수 질량과 에너지를 대장간 망치로 다듬어 낸 궁극의 신살검.',
        cutscene: true
    },
    {
        id: 'w_infinity_singularity',
        name: '무한의 특이점 인피니티',
        engName: 'Infinity Singularity',
        icon: '👁️',
        basePower: 75000000,
        rarityRate: '1/10,000,000 (0.00001%)',
        weight: 0.00003,
        tier: 'Godly',
        color: '#ff00ff',
        lore: '모든 평행우주와 차원의 힘이 하나로 모인 궁극의 형상. 이 검을 쥔 자가 곧 우주의 법칙이 된다.',
        cutscene: true
    }
];

// ============================================================================
// RUNES DATABASE (룬 인챈트 가챠 시스템)
// ============================================================================

const RUNES_DATABASE = [
    {
        id: 'r_spark',
        name: '타오르는 불꽃',
        prefix: '타오르는 (Blazing)',
        boost: 1.5,
        weight: 45.0,
        color: '#ff7700',
        tier: 'Common',
        desc: '무기 공격력 +50% 증가',
        cutscene: false
    },
    {
        id: 'r_stone',
        name: '단단한 대지',
        prefix: '견고한 (Sturdy)',
        boost: 1.8,
        weight: 30.0,
        color: '#84cc16',
        tier: 'Common',
        desc: '무기 공격력 +80% 증가 및 분해 가치 +20%',
        cutscene: false
    },
    {
        id: 'r_ether',
        name: '흐르는 에테르',
        prefix: '에테르의 (Flowing)',
        boost: 2.5,
        weight: 15.0,
        color: '#00e5ff',
        tier: 'Uncommon',
        desc: '무기 공격력 +150% 증가 및 초당 +1 광석 채굴',
        cutscene: false
    },
    {
        id: 'r_thunder',
        name: '천둥의 분노',
        prefix: '벼락치는 (Thunderous)',
        boost: 3.8,
        weight: 6.0,
        color: '#3b82f6',
        tier: 'Rare',
        desc: '무기 공격력 +280% 증가 및 타격 시 스파크 2배',
        cutscene: false
    },
    {
        id: 'r_void',
        name: '심연의 포식자',
        prefix: '심연의 (Abyssal)',
        boost: 6.5,
        weight: 2.5,
        color: '#a855f7',
        tier: 'Epic',
        desc: '무기 공격력 +550% 증가 및 모루 타격력 +50%',
        cutscene: false
    },
    {
        id: 'r_genesis',
        name: '태초의 창조물',
        prefix: '신을 베는 (God-Slayer)',
        boost: 18.0,
        weight: 0.9,
        color: '#ffaa00',
        tier: 'Legendary',
        desc: '무기 공격력 +1700% 증가 및 골드 분해 수익 3배',
        cutscene: true
    },
    {
        id: 'r_singularity',
        name: '차원 붕괴 특이점',
        prefix: '무한의 (Infinite)',
        boost: 80.0,
        weight: 0.1,
        color: '#ec4899',
        tier: 'Godly',
        desc: '무기 공격력 +7900% 폭발적 증가 및 원정대 DPS 5배',
        cutscene: true
    }
];

// ============================================================================
// UPGRADES DATABASE (대장간 시설 업그레이드 - 밸런스 조정)
// ============================================================================

const UPGRADES_DATABASE = [
    {
        id: 'hammerPower',
        title: '헤비 오리하르콘 해머',
        desc: '타격당 제련 진행도를 +2% 추가 상승시킵니다.',
        baseCost: 35,
        costMul: 1.32,
        maxLevel: 50,
        effect: (lvl) => lvl * 2
    },
    {
        id: 'anvilQuality',
        title: '미스릴 합금 모루',
        desc: '무기 분해 시 회수하는 골드 가치를 +12% 증가시킵니다.',
        baseCost: 80,
        costMul: 1.35,
        maxLevel: 50,
        effect: (lvl) => lvl * 0.12
    },
    {
        id: 'bellowsSpeed',
        title: '지옥불 자동 풀무 (Auto)',
        desc: '자동 망치질 속도를 단축합니다. (최소 0.35초 간격)',
        baseCost: 250,
        costMul: 1.40,
        maxLevel: 30,
        effect: (lvl) => Math.max(0.35, 1.20 - (lvl * 0.028))
    },
    {
        id: 'oreMagnet',
        title: '에테르 광맥 유도기',
        desc: '모루 타격 시 에테르 광석이 드랍될 확률을 +2% 증가시킵니다. (최대 50%)',
        baseCost: 350,
        costMul: 1.38,
        maxLevel: 25,
        effect: (lvl) => Math.min(0.50, lvl * 0.02)
    },
    {
        id: 'qualityMastery',
        title: '담금질 장인의 손길',
        desc: '제련 완성 시 무기의 기본 품질(Quality)을 +2.5% 상승시킵니다.',
        baseCost: 600,
        costMul: 1.35,
        maxLevel: 40,
        effect: (lvl) => lvl * 2.5
    },
    {
        id: 'enhancementLuck',
        title: '축복받은 불꽃 제련',
        desc: '무기 제련 시 고강화 보너스 수치(+1 ~ +7)가 붙을 확률이 상승합니다.',
        baseCost: 1500,
        costMul: 1.45,
        maxLevel: 20,
        effect: (lvl) => lvl * 0.05
    },
    {
        id: 'criticalStrike',
        title: '벼림의 크리티컬',
        desc: '모루 타격 시 3배 파워의 크리티컬 발동 확률을 +2% 증가시킵니다. (최대 50%)',
        baseCost: 2500,
        costMul: 1.45,
        maxLevel: 20,
        effect: (lvl) => Math.min(0.50, lvl * 0.02)
    },
    {
        id: 'ancientWhisper',
        title: '고대 대장장이의 비전서',
        desc: '고티어(Rare 이상) 무기가 제련될 확률을 레벨당 +10%씩 곱연산 상승시킵니다.',
        baseCost: 8000,
        costMul: 1.55,
        maxLevel: 15,
        effect: (lvl) => 1 + (lvl * 0.10)
    }
];

// ============================================================================
// DUNGEONS DATABASE (던전 원정대 시스템)
// ============================================================================

const DUNGEONS_DATABASE = [
    {
        id: 'd_goblin_cave',
        name: '고블린 광산 동굴',
        engName: 'Goblin Cave',
        reqPower: 30,
        goldPerSec: 8,
        orePerSec: 0.3,
        cost: 60,
        desc: '약탈당한 광산에 숨어든 고블린 소탕. 초반 골드와 에테르 광석의 안정적인 보급처.'
    },
    {
        id: 'd_skeleton_crypt',
        name: '망령들의 지하 납골당',
        engName: 'Undead Crypt',
        reqPower: 180,
        goldPerSec: 35,
        orePerSec: 0.9,
        cost: 350,
        desc: '죽은 병사들의 유골이 배회하는 폐허. 고대 철제 유물과 귀금속을 발굴합니다.'
    },
    {
        id: 'd_golem_sanctuary',
        name: '마법석 골렘 보호구역',
        engName: 'Golem Sanctuary',
        reqPower: 900,
        goldPerSec: 180,
        orePerSec: 2.8,
        cost: 2200,
        desc: '거대한 마법 골렘들이 지키는 성역. 고밀도 에테르 원석이 대량 매장되어 있습니다.'
    },
    {
        id: 'd_dragon_peak',
        name: '작열하는 드래곤 영봉',
        engName: 'Dragon Peak',
        reqPower: 6000,
        goldPerSec: 1200,
        orePerSec: 12.0,
        cost: 18000,
        desc: '화염룡이 둥지를 튼 화산 봉우리. 드래곤의 보물창고에서 막대한 황금을 약탈합니다.'
    },
    {
        id: 'd_abyssal_rift',
        name: '차원 균열 심연',
        engName: 'Abyssal Rift',
        reqPower: 45000,
        goldPerSec: 9500,
        orePerSec: 55.0,
        cost: 120000,
        desc: '뒤틀린 차원의 틈새. 이세계의 물질과 천문학적인 에테르가 뿜어져 나옵니다.'
    },
    {
        id: 'd_celestial_citadel',
        name: '천상계의 별빛 요새',
        engName: 'Celestial Citadel',
        reqPower: 350000,
        goldPerSec: 80000,
        orePerSec: 280.0,
        cost: 950000,
        desc: '신화 속 신들이 기거하던 부유 성채. 상상을 초월하는 부와 신성한 에테르를 수확합니다.'
    }
];

// 전역 내보내기 (다른 파일 및 메인 로직에서 참조)
window.WEAPONS_DATABASE = WEAPONS_DATABASE;
window.RUNES_DATABASE = RUNES_DATABASE;
window.UPGRADES_DATABASE = UPGRADES_DATABASE;
window.DUNGEONS_DATABASE = DUNGEONS_DATABASE;
