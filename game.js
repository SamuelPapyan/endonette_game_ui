const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const miniCtx = minimapCanvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const MAP_SIZE = 2400;

const state = {
    worldLevel: 1,
    coins: 120,
    wood: 60,
    stone: 60,
    raidTime: 45,
    castleCost: { wood: 50, stone: 50, coins: 100 },
    stats: { enemiesKilled: 0, housesRepaired: 0 }
};

// ТАЙМЕР И СПАВН РЕЙДА (ДВИЖЕНИЕ К ГЕРОЮ)
setInterval(() => {
    if (state.raidTime > 0) {
        state.raidTime--;
    } else {
        state.raidTime = 45;
        // Появление агрессивной волны врагов по периметру
        const count = 4 + state.worldLevel * 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 600 + Math.random() * 300;
            enemies.push({
                x: player.x + Math.cos(angle) * dist,
                y: player.y + Math.sin(angle) * dist,
                hp: 40 + state.worldLevel * 15,
                maxHp: 40 + state.worldLevel * 15,
                speed: 2.2 + Math.random() * 0.8,
                size: 16
            });
        }
    }
    document.getElementById('raidTimer').innerText = state.raidTime;
}, 1000);

// --- СПИСОК ГЕРОЕВ С ЦЕНАМИ УЛУЧШЕНИЙ ---
const heroes = [
    {
        id: 'warrior', name: 'Вальгар', className: 'Воин', icon: '⚔️',
        colorTop: '#e74c3c', colorLeft: '#c0392b', colorRight: '#962d22',
        level: 1, hp: 120, attack: 18, defense: 12,
        upgradeCost: { coins: 30, wood: 15, stone: 15 }
    },
    {
        id: 'mage', name: 'Элион', className: 'Маг', icon: '🔮',
        colorTop: '#9b59b6', colorLeft: '#8e44ad', colorRight: '#6c3483',
        level: 1, hp: 80, attack: 25, defense: 5,
        upgradeCost: { coins: 35, wood: 20, stone: 10 }
    },
    {
        id: 'rogue', name: 'Тень', className: 'Разбойник', icon: '🗡️',
        colorTop: '#2ecc71', colorLeft: '#27ae60', colorRight: '#1e8449',
        level: 1, hp: 95, attack: 22, defense: 8,
        upgradeCost: { coins: 30, wood: 10, stone: 20 }
    },
    {
        id: 'paladin', name: 'Лисандр', className: 'Паладин', icon: '🛡️',
        colorTop: '#f1c40f', colorLeft: '#f39c12', colorRight: '#d35400',
        level: 1, hp: 150, attack: 14, defense: 16,
        upgradeCost: { coins: 40, wood: 20, stone: 20 }
    }
];

let activeHero = heroes[0];

const camera = {
    x: MAP_SIZE / 2, y: MAP_SIZE / 2,
    isDragging: false, dragStartX: 0, dragStartY: 0, followPlayer: true
};

function toIso(x, y, z = 0) {
    const screenCenterX = canvas.width / 2;
    const screenCenterY = canvas.height / 3;
    const relX = x - camera.x;
    const relY = y - camera.y;
    return {
        isoX: screenCenterX + (relX - relY),
        isoY: screenCenterY + (relX + relY) * 0.5 - z
    };
}

function toCartesian(screenX, screenY) {
    const screenCenterX = canvas.width / 2;
    const screenCenterY = canvas.height / 3;
    const isoX = screenX - screenCenterX;
    const isoY = screenY - screenCenterY;
    return {
        x: (isoY + isoX / 2) + camera.x,
        y: (isoY - isoX / 2) + camera.y
    };
}

const player = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 + 80, targetX: MAP_SIZE / 2, targetY: MAP_SIZE / 2 + 80, speed: 5, size: 18 };
const castle = { x: MAP_SIZE / 2, y: MAP_SIZE / 2, size: 110 };

// РЕЛЬЕФ, ЛОЩИНЫ, РЕКИ И ТРОПИНКИ
const terrainHeights = [];
const GRID_RES = 60;
for (let i = 0; i < MAP_SIZE / GRID_RES; i++) {
    terrainHeights[i] = [];
    for (let j = 0; j < MAP_SIZE / GRID_RES; j++) {
        // Изометрические холмы и лощины
        const distFromCenter = Math.hypot(i * GRID_RES - MAP_SIZE/2, j * GRID_RES - MAP_SIZE/2);
        if (distFromCenter < 350) {
            terrainHeights[i][j] = 0; // Главное плато Замка
        } else {
            const h = Math.sin(i * 0.2) * Math.cos(j * 0.2);
            terrainHeights[i][j] = h > 0.4 ? 25 : (h < -0.4 ? -15 : 0);
        }
    }
}

// Тропинки (соединяющие точки)
const paths = [
    { from: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 }, to: { x: MAP_SIZE / 2 - 120, y: MAP_SIZE / 2 + 60 } },
    { from: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 }, to: { x: MAP_SIZE / 2 + 130, y: MAP_SIZE / 2 + 80 } },
    { from: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 }, to: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 - 140 } }
];

// --- ЛОГИКА ДОМАШНЕЙ БАЗЫ И ГЕРОЕВ ---
function openHomeBase() {
    document.getElementById('home-base-screen').style.display = 'flex';
    updateHomeBaseUI();
}

function closeHomeBase() {
    document.getElementById('home-base-screen').style.display = 'none';
}

function updateHomeBaseUI() {
    document.getElementById('base-hero-icon').innerText = activeHero.icon;
    document.getElementById('base-hero-name').innerText = activeHero.name;
    document.getElementById('base-hero-class').innerText = `Класс: ${activeHero.className}`;
    document.getElementById('base-hero-lvl').innerText = activeHero.level;
    document.getElementById('base-hero-hp').innerText = Math.round(activeHero.hp);
    document.getElementById('base-hero-atk').innerText = Math.round(activeHero.attack);
    document.getElementById('base-hero-def').innerText = Math.round(activeHero.defense);

    const c = activeHero.upgradeCost;
    document.getElementById('upgrade-cost-text').innerText = `🪙 ${c.coins} | 🪵 ${c.wood} | 🪨 ${c.stone}`;

    const btn = document.getElementById('btn-upgrade-hero');
    btn.disabled = !(state.coins >= c.coins && state.wood >= c.wood && state.stone >= c.stone);
}

function upgradeCurrentHero() {
    const cost = activeHero.upgradeCost;
    if (state.coins >= cost.coins && state.wood >= cost.wood && state.stone >= cost.stone) {
        state.coins -= cost.coins; state.wood -= cost.wood; state.stone -= cost.stone;
        activeHero.level += 1; activeHero.hp *= 1.10; activeHero.attack *= 1.09; activeHero.defense *= 1.08;
        cost.coins = Math.floor(cost.coins * 1.4); cost.wood = Math.floor(cost.wood * 1.4); cost.stone = Math.floor(cost.stone * 1.4);
        updateHomeBaseUI(); updateMainUI();
    }
}

function openHeroSelectModal() {
    const container = document.getElementById('heroes-list-container');
    let html = '';
    heroes.forEach(h => {
        const isActive = h.id === activeHero.id;
        const c = h.upgradeCost;
        html += `
            <div class="hero-card ${isActive ? 'active' : ''}">
                <div>
                    <div style="font-size: 38px;">${h.icon}</div>
                    <h4 style="margin:4px 0; color:#f1c40f;">${h.name}</h4>
                    <div style="font-size:12px; color:#bdc3c7;">${h.className} (Ур. ${h.level})</div>
                    <div style="font-size:11px; margin: 8px 0; text-align:left;">
                        ❤️ HP: ${Math.round(h.hp)}<br>
                        ⚔️ Атака: ${Math.round(h.attack)}<br>
                        🛡️ Защита: ${Math.round(h.defense)}
                    </div>
                </div>
                <div>
                    <div class="hero-card-cost">
                        Цена апгрейда:<br>
                        🪙${c.coins} 🪵${c.wood} 🪨${c.stone}
                    </div>
                    ${isActive 
                        ? `<span style="color:#2ecc71; font-weight:bold; font-size:12px;">Выбран</span>`
                        : `<button class="btn-ui" style="padding:6px; font-size:12px;" onclick="selectHero('${h.id}')">Выбрать</button>`
                    }
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    document.getElementById('hero-select-modal').style.display = 'block';
}

function selectHero(heroId) {
    const found = heroes.find(h => h.id === heroId);
    if (found) { activeHero = found; updateHomeBaseUI(); openHeroSelectModal(); }
}

function closeHeroSelectModal() { document.getElementById('hero-select-modal').style.display = 'none'; }

// NPC И КВЕСТЫ
const npcs = [
    { id: 'elder', name: '🧙‍♂️ Старейшина', x: MAP_SIZE / 2 - 120, y: MAP_SIZE / 2 + 60, size: 20, colorTop: '#f1c40f', colorLeft: '#d35400', colorRight: '#e67e22', availableQuest: null, activeQuest: null, questTemplate: { type: 'kill_enemies', amount: 5, text: 'Очистите окрестности! Уничтожьте 5 врагов.', reward: { wood: 30, stone: 30, coins: 60 } } },
    { id: 'blacksmith', name: '🔨 Кузнец Торн', x: MAP_SIZE / 2 + 130, y: MAP_SIZE / 2 + 80, size: 20, colorTop: '#e67e22', colorLeft: '#a04000', colorRight: '#d35400', availableQuest: null, activeQuest: null, questTemplate: { type: 'repair_houses', amount: 2, text: 'Восстановите 2 разрушенных дома.', reward: { wood: 50, stone: 50, coins: 100 } } },
    { id: 'archmage', name: '🔮 Архимаг Валиан', x: MAP_SIZE / 2, y: MAP_SIZE / 2 - 140, size: 20, colorTop: '#9b59b6', colorLeft: '#6c3483', colorRight: '#8e44ad', availableQuest: null, activeQuest: null, questTemplate: { type: 'upgrade_castle', amount: 1, text: 'Укрепите Замок на 1 уровень.', reward: { wood: 60, stone: 60, coins: 150 } } }
];

function generateQuestForNpc(npcObj) {
    const tpl = npcObj.questTemplate;
    let startVal = tpl.type === 'kill_enemies' ? state.stats.enemiesKilled : (tpl.type === 'repair_houses' ? state.stats.housesRepaired : state.worldLevel);
    return { ...tpl, npcName: npcObj.name, npcId: npcObj.id, startValue: startVal, targetValue: startVal + tpl.amount, isCompleted: false };
}
npcs.forEach(n => n.availableQuest = generateQuestForNpc(n));

let currentInteractingNpc = null;
let isDialogOpen = false;

function openNpcDialog(npcObj, quest) {
    currentInteractingNpc = npcObj; isDialogOpen = true;
    document.getElementById('npc-dialog').style.display = 'block';
    document.getElementById('dialog-title').innerText = npcObj.name;
    document.getElementById('dialog-text').innerText = quest.text;
    document.getElementById('dialog-reward-text').innerText = `🪵${quest.reward.wood || 0} 🪨${quest.reward.stone || 0} 🪙${quest.reward.coins || 0}`;
}

function acceptQuest() {
    if (currentInteractingNpc) { currentInteractingNpc.activeQuest = currentInteractingNpc.availableQuest; currentInteractingNpc.availableQuest = null; }
    closeNpcDialog(); updateQuestUI();
}
function skipQuest() { if (currentInteractingNpc) currentInteractingNpc.availableQuest = null; closeNpcDialog(); }
function closeNpcDialog() { isDialogOpen = false; currentInteractingNpc = null; document.getElementById('npc-dialog').style.display = 'none'; }

function updateQuestUI() {
    const container = document.getElementById('quest-list');
    const activeQuests = npcs.filter(n => n.activeQuest !== null).map(n => n.activeQuest);
    if (activeQuests.length === 0) { container.innerHTML = `<div style="color: #7f8c8d; font-style: italic;">Нет активных заданий.</div>`; return; }
    let html = '';
    activeQuests.forEach(q => {
        let current = q.type === 'kill_enemies' ? state.stats.enemiesKilled - q.startValue : (q.type === 'repair_houses' ? state.stats.housesRepaired - q.startValue : state.worldLevel);
        let target = q.type === 'upgrade_castle' ? q.targetValue : q.amount;
        if (current >= target) q.isCompleted = true;
        html += `<div class="quest-item ${q.isCompleted ? 'completed' : ''}">
            <div class="quest-npc-author">От: ${q.npcName}</div>
            <b>${q.text}</b><br>Прогресс: ${Math.min(current, target)} / ${target}<br>
            Статус: ${q.isCompleted ? '<span style="color:#2ecc71">Сдайте квест!</span>' : '<span style="color:#f39c12">В процессе</span>'}
        </div>`;
    });
    container.innerHTML = html;
}

let houses = [];
for (let i = 0; i < 15; i++) {
    houses.push({ x: 150 + Math.random() * (MAP_SIZE - 300), y: 150 + Math.random() * (MAP_SIZE - 300), size: 50, isRepaired: false, progress: 0, cost: { wood: 15, stone: 15, coins: 20 } });
}

let enemies = [];
let entities = [];
function spawnResource(type) {
    entities.push({ type: type, x: 100 + Math.random() * (MAP_SIZE - 200), y: 100 + Math.random() * (MAP_SIZE - 200), size: 14 });
}
for (let i = 0; i < 20; i++) { spawnResource('wood'); spawnResource('stone'); }

// Управление
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 || e.button === 1) {
        camera.isDragging = true; camera.dragStartX = e.clientX; camera.dragStartY = e.clientY; camera.followPlayer = false;
    } else if (e.button === 0) {
        const pos = toCartesian(e.clientX, e.clientY);
        player.targetX = Math.max(0, Math.min(MAP_SIZE, pos.x));
        player.targetY = Math.max(0, Math.min(MAP_SIZE, pos.y));
        camera.followPlayer = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (camera.isDragging) {
        const dx = e.clientX - camera.dragStartX; const dy = e.clientY - camera.dragStartY;
        camera.x -= (dy + dx / 2) * 0.8; camera.y -= (dy - dx / 2) * 0.8;
        camera.dragStartX = e.clientX; camera.dragStartY = e.clientY;
    }
});
window.addEventListener('mouseup', () => camera.isDragging = false);

function updateMainUI() {
    document.getElementById('worldLevel').innerText = state.worldLevel;
    document.getElementById('coins').innerText = state.coins;
    document.getElementById('wood').innerText = state.wood;
    document.getElementById('stone').innerText = state.stone;
}

function update() {
    // Движение игрока
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > player.speed) {
        player.x += (dx / dist) * player.speed;
        player.y += (dy / dist) * player.speed;
    }

    if (camera.followPlayer) {
        camera.x += (player.x - camera.x) * 0.1;
        camera.y += (player.y - camera.y) * 0.1;
    }

    // ДВИЖЕНИЕ ВРАГОВ К ГЕРОЮ (ИЛИ К ЗАМКУ)
    enemies.forEach(en => {
        const distToPlayer = Math.hypot(player.x - en.x, player.y - en.y);
        let targetX = player.x;
        let targetY = player.y;

        // Если замок ближе чем игрок, враг штурмует замок
        const distToCastle = Math.hypot(castle.x - en.x, castle.y - en.y);
        if (distToCastle < distToPlayer && distToCastle > 70) {
            targetX = castle.x;
            targetY = castle.y;
        }

        const edx = targetX - en.x;
        const edy = targetY - en.y;
        const eDist = Math.hypot(edx, edy);
        if (eDist > 10) {
            en.x += (edx / eDist) * en.speed;
            en.y += (edy / eDist) * en.speed;
        }
    });

    // Улучшение Замка
    if (Math.hypot(castle.x - player.x, castle.y - player.y) < castle.size / 2 + player.size + 15) {
        if (state.wood >= state.castleCost.wood && state.stone >= state.castleCost.stone && state.coins >= state.castleCost.coins) {
            state.wood -= state.castleCost.wood; state.stone -= state.castleCost.stone; state.coins -= state.castleCost.coins;
            state.worldLevel++;
            state.castleCost.wood = Math.floor(state.castleCost.wood * 1.5);
            state.castleCost.stone = Math.floor(state.castleCost.stone * 1.5);
            state.castleCost.coins = Math.floor(state.castleCost.coins * 1.5);
            updateQuestUI();
        }
    }

    // NPC
    npcs.forEach(n => {
        if (Math.hypot(n.x - player.x, n.y - player.y) < n.size + player.size + 10) {
            if (n.availableQuest && !isDialogOpen) openNpcDialog(n, n.availableQuest);
            else if (n.activeQuest && n.activeQuest.isCompleted) {
                state.wood += n.activeQuest.reward.wood || 0;
                state.stone += n.activeQuest.reward.stone || 0;
                state.coins += n.activeQuest.reward.coins || 0;
                n.activeQuest = null; updateQuestUI();
            }
        }
    });

    // Ремонт
    houses.forEach(house => {
        if (!house.isRepaired && Math.hypot(house.x - player.x, house.y - player.y) < house.size / 2 + player.size + 10) {
            if (state.wood >= house.cost.wood && state.stone >= house.cost.stone && state.coins >= house.cost.coins) {
                house.progress += 2;
                if (house.progress >= 100) {
                    state.wood -= house.cost.wood; state.stone -= house.cost.stone; state.coins -= house.cost.coins;
                    house.isRepaired = true; state.stats.housesRepaired++; state.coins += 40; updateQuestUI();
                }
            }
        }
    });

    // Ресурсы
    for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (Math.hypot(ent.x - player.x, ent.y - player.y) < player.size + ent.size) {
            if (ent.type === 'wood') state.wood += 5;
            if (ent.type === 'stone') state.stone += 5;
            entities.splice(i, 1);
        }
    }

    // Бой с врагами
    for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        if (Math.hypot(en.x - player.x, en.y - player.y) < player.size + en.size + 15) {
            en.hp -= activeHero.attack;
            if (en.hp <= 0) {
                enemies.splice(i, 1);
                state.stats.enemiesKilled++; state.coins += 15; updateQuestUI();
            }
        }
    }

    if (entities.filter(e => e.type === 'wood').length < 15) spawnResource('wood');
    if (entities.filter(e => e.type === 'stone').length < 15) spawnResource('stone');

    updateMainUI();
}

function drawIsoBlock(x, y, sizeX, sizeY, height, topColor, leftColor, rightColor, z = 0) {
    const p1 = toIso(x, y, z);
    const p2 = toIso(x + sizeX, y, z);
    const p3 = toIso(x + sizeX, y + sizeY, z);
    const p4 = toIso(x, y + sizeY, z);

    ctx.fillStyle = leftColor; ctx.beginPath(); ctx.moveTo(p4.isoX, p4.isoY); ctx.lineTo(p3.isoX, p3.isoY); ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p4.isoX, p4.isoY - height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rightColor; ctx.beginPath(); ctx.moveTo(p2.isoX, p2.isoY); ctx.lineTo(p3.isoX, p3.isoY); ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p2.isoX, p2.isoY - height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = topColor; ctx.beginPath(); ctx.moveTo(p1.isoX, p1.isoY - height); ctx.lineTo(p2.isoX, p2.isoY - height); ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p4.isoX, p4.isoY - height); ctx.closePath(); ctx.fill();
}

// ОТРИСОВКА МИНИ-КАРТЫ
function renderMinimap() {
    const size = minimapCanvas.width;
    const center = size / 2;
    const scale = size / (MAP_SIZE * 1.2);

    miniCtx.fillStyle = '#11141a';
    miniCtx.fillRect(0, 0, size, size);

    // Река
    miniCtx.strokeStyle = 'rgba(41, 128, 185, 0.5)';
    miniCtx.lineWidth = 6;
    miniCtx.beginPath();
    miniCtx.moveTo(0, center + 80);
    miniCtx.lineTo(size, center - 80);
    miniCtx.stroke();

    // Замок
    miniCtx.fillStyle = '#9b59b6';
    miniCtx.fillRect(center + (castle.x - camera.x) * scale - 4, center + (castle.y - camera.y) * scale - 4, 8, 8);

    // Дома
    houses.forEach(h => {
        miniCtx.fillStyle = h.isRepaired ? '#e67e22' : '#7f8c8d';
        miniCtx.fillRect(center + (h.x - camera.x) * scale - 2, center + (h.y - camera.y) * scale - 2, 4, 4);
    });

    // Ресурсы
    entities.forEach(e => {
        miniCtx.fillStyle = e.type === 'wood' ? '#2ecc71' : '#bdc3c7';
        miniCtx.fillRect(center + (e.x - camera.x) * scale - 1, center + (e.y - camera.y) * scale - 1, 2, 2);
    });

    // NPC
    npcs.forEach(n => {
        miniCtx.fillStyle = '#f1c40f';
        miniCtx.beginPath(); miniCtx.arc(center + (n.x - camera.x) * scale, center + (n.y - camera.y) * scale, 3, 0, Math.PI * 2); miniCtx.fill();
    });

    // Движущиеся враги
    enemies.forEach(en => {
        miniCtx.fillStyle = '#e74c3c';
        miniCtx.beginPath(); miniCtx.arc(center + (en.x - camera.x) * scale, center + (en.y - camera.y) * scale, 2.5, 0, Math.PI * 2); miniCtx.fill();
    });

    // Игрок
    miniCtx.fillStyle = '#3498db';
    miniCtx.beginPath(); miniCtx.arc(center + (player.x - camera.x) * scale, center + (player.y - camera.y) * scale, 4, 0, Math.PI * 2); miniCtx.fill();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ИЗОМЕТРИЧЕСКИЙ ЛАНДШАФТ (ХОЛМЫ И СТУПЕНИ)
    const startI = Math.max(0, Math.floor((camera.x - 1200) / GRID_RES));
    const endI = Math.min(MAP_SIZE / GRID_RES, Math.ceil((camera.x + 1200) / GRID_RES));
    const startJ = Math.max(0, Math.floor((camera.y - 1200) / GRID_RES));
    const endJ = Math.min(MAP_SIZE / GRID_RES, Math.ceil((camera.y + 1200) / GRID_RES));

    for (let i = startI; i < endI; i++) {
        for (let j = startJ; j < endJ; j++) {
            const h = terrainHeights[i][j];
            const x = i * GRID_RES;
            const y = j * GRID_RES;

            let topColor = '#4d8348';
            let leftColor = '#386134';
            let rightColor = '#284725';

            if (h > 0) {
                topColor = '#5dade2'; leftColor = '#2980b9'; rightColor = '#1f618d'; // Возвышенность
            } else if (h < 0) {
                topColor = '#27ae60'; leftColor = '#1e8449'; rightColor = '#145a32'; // Лощина
            }

            drawIsoBlock(x, y, GRID_RES, GRID_RES, Math.abs(h), topColor, leftColor, rightColor, h < 0 ? h : 0);
        }
    }

    // ТРОПИНКИ
    paths.forEach(p => {
        const p1 = toIso(p.from.x, p.from.y);
        const p2 = toIso(p.to.x, p.to.y);
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(p1.isoX, p1.isoY); ctx.lineTo(p2.isoX, p2.isoY); ctx.stroke();
    });

    // РЕКА
    const rStart = toIso(0, MAP_SIZE / 2 + 300);
    const rEnd = toIso(MAP_SIZE, MAP_SIZE / 2 - 300);
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)';
    ctx.lineWidth = 40;
    ctx.beginPath(); ctx.moveTo(rStart.isoX, rStart.isoY); ctx.lineTo(rEnd.isoX, rEnd.isoY); ctx.stroke();

    // ОБЪЕКТЫ И СУЩНОСТИ
    let renderList = [
        { type: 'castle', y: castle.y },
        ...npcs.map(n => ({ type: 'npc', data: n, y: n.y })),
        { type: 'player', y: player.y },
        ...houses.map(h => ({ type: 'house', data: h, y: h.y })),
        ...entities.map(e => ({ type: e.type, data: e, y: e.y })),
        ...enemies.map(en => ({ type: 'enemy', data: en, y: en.y }))
    ];

    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach(obj => {
        if (obj.type === 'castle') {
            drawIsoBlock(castle.x - 55, castle.y - 55, 110, 110, 80, '#9b59b6', '#8e44ad', '#6c3483');
            const iso = toIso(castle.x, castle.y);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('🏰 Замок Героев', iso.isoX, iso.isoY - 95);

            const c = state.castleCost;
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(iso.isoX - 60, iso.isoY - 88, 120, 20);
            ctx.fillStyle = '#f1c40f'; ctx.font = '11px sans-serif';
            ctx.fillText(`Апгрейд: 🪵${c.wood} 🪨${c.stone} 🪙${c.coins}`, iso.isoX, iso.isoY - 74);
        }
        else if (obj.type === 'npc') {
            const n = obj.data;
            drawIsoBlock(n.x - 10, n.y - 10, 20, 20, 30, n.colorTop, n.colorLeft, n.colorRight);
            const iso = toIso(n.x, n.y);
            ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
            if (n.activeQuest && n.activeQuest.isCompleted) {
                ctx.fillStyle = '#2ecc71'; ctx.fillText('❓ (Сдать!)', iso.isoX, iso.isoY - 45);
            } else if (n.availableQuest) {
                ctx.fillStyle = '#f1c40f'; ctx.fillText('❗ (Квест)', iso.isoX, iso.isoY - 45);
            } else {
                ctx.fillStyle = '#bdc3c7'; ctx.font = '11px sans-serif'; ctx.fillText(n.name, iso.isoX, iso.isoY - 40);
            }
        }
        else if (obj.type === 'house') {
            const h = obj.data;
            if (h.isRepaired) {
                drawIsoBlock(h.x - 22, h.y - 22, 44, 44, 40, '#e67e22', '#d35400', '#a04000');
            } else {
                drawIsoBlock(h.x - 22, h.y - 22, 44, 44, 18, '#7f8c8d', '#95a5a6', '#34495e');
                const iso = toIso(h.x, h.y);
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(iso.isoX - 45, iso.isoY - 48, 90, 20);
                ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(`🪵${h.cost.wood} 🪨${h.cost.stone} 🪙${h.cost.coins}`, iso.isoX, iso.isoY - 34);
            }
        }
        else if (obj.type === 'player') {
            drawIsoBlock(player.x - 9, player.y - 9, 18, 18, 28, activeHero.colorTop, activeHero.colorLeft, activeHero.colorRight);
            const iso = toIso(player.x, player.y);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(activeHero.name, iso.isoX, iso.isoY - 35);
        }
        else if (obj.type === 'enemy') {
            const en = obj.data;
            drawIsoBlock(en.x - 8, en.y - 8, 16, 16, 22, '#e74c3c', '#c0392b', '#7f8c8d');
            
            // HP Bar над врагом
            const iso = toIso(en.x, en.y);
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(iso.isoX - 15, iso.isoY - 30, 30, 4);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(iso.isoX - 15, iso.isoY - 30, (en.hp / en.maxHp) * 30, 4);
        }
        else if (obj.type === 'wood') drawIsoBlock(obj.data.x - 7, obj.data.y - 7, 14, 14, 18, '#2ecc71', '#27ae60', '#1e8449');
        else if (obj.type === 'stone') drawIsoBlock(obj.data.x - 7, obj.data.y - 7, 14, 14, 10, '#bdc3c7', '#95a5a6', '#7f8c8d');
    });

    renderMinimap();
}

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

loop();