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
    coins: 50,
    wood: 20,
    stone: 20,
    stats: {
        enemiesKilled: 0,
        housesRepaired: 0
    }
};

const camera = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    followPlayer: true
};

function toIso(x, y) {
    const screenCenterX = canvas.width / 2;
    const screenCenterY = canvas.height / 3;
    const relX = x - camera.x;
    const relY = y - camera.y;
    return {
        isoX: screenCenterX + (relX - relY),
        isoY: screenCenterY + (relX + relY) * 0.5
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
const castle = { x: MAP_SIZE / 2, y: MAP_SIZE / 2, size: 110, upgradeCost: { wood: 10, stone: 10, coins: 50 } };

// --- МАССИВ NPC С УНИКАЛЬНЫМИ ИМЕНАМИ И КВЕСТАМИ ---
const npcs = [
    {
        id: 'elder',
        name: '🧙‍♂️ Старейшина Эндонета',
        x: MAP_SIZE / 2 - 120,
        y: MAP_SIZE / 2 + 60,
        size: 20,
        colorTop: '#f1c40f', colorLeft: '#d35400', colorRight: '#e67e22',
        availableQuest: null,
        activeQuest: null,
        questTemplate: { type: 'kill_enemies', amount: 5, text: 'Очистите окрестности! Уничтожьте 5 врагов.', reward: { wood: 30, stone: 30, coins: 60 } }
    },
    {
        id: 'blacksmith',
        name: '🔨 Кузнец Торн',
        x: MAP_SIZE / 2 + 130,
        y: MAP_SIZE / 2 + 80,
        size: 20,
        colorTop: '#e67e22', colorLeft: '#a04000', colorRight: '#d35400',
        availableQuest: null,
        activeQuest: null,
        questTemplate: { type: 'repair_houses', amount: 2, text: 'Городу нужны крыши над головой! Восстановите 2 дома.', reward: { wood: 50, stone: 50, coins: 100 } }
    },
    {
        id: 'archmage',
        name: '🔮 Архимандрит Валиан',
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2 - 140,
        size: 20,
        colorTop: '#9b59b6', colorLeft: '#6c3483', colorRight: '#8e44ad',
        availableQuest: null,
        activeQuest: null,
        questTemplate: { type: 'upgrade_castle', amount: 1, text: 'Укрепите Замок Героев на 1 уровень выше.', reward: { wood: 60, stone: 60, coins: 150 } }
    }
];

function generateQuestForNpc(npcObj) {
    const tpl = npcObj.questTemplate;
    let startVal = 0;
    if (tpl.type === 'kill_enemies') startVal = state.stats.enemiesKilled;
    if (tpl.type === 'repair_houses') startVal = state.stats.housesRepaired;
    if (tpl.type === 'upgrade_castle') startVal = state.worldLevel;

    return {
        ...tpl,
        npcName: npcObj.name,
        npcId: npcObj.id,
        startValue: startVal,
        targetValue: startVal + tpl.amount,
        isCompleted: false
    };
}

// Появление заданий у NPC каждые 60 секунд
setInterval(() => {
    npcs.forEach(n => {
        if (!n.activeQuest && !n.availableQuest) {
            n.availableQuest = generateQuestForNpc(n);
        }
    });
}, 60000);

// Инициализируем стартовые задания при запуске
npcs.forEach(n => n.availableQuest = generateQuestForNpc(n));

// Логика Диалогового Окна NPC
let currentInteractingNpc = null;
let isDialogOpen = false;

function openNpcDialog(npcObj, quest) {
    currentInteractingNpc = npcObj;
    isDialogOpen = true;
    document.getElementById('npc-dialog').style.display = 'block';
    document.getElementById('dialog-title').innerText = npcObj.name;
    document.getElementById('dialog-text').innerText = quest.text;
    document.getElementById('dialog-reward-text').innerText = `🪵${quest.reward.wood || 0} 🪨${quest.reward.stone || 0} 🪙${quest.reward.coins || 0}`;
}

function acceptQuest() {
    if (currentInteractingNpc) {
        currentInteractingNpc.activeQuest = currentInteractingNpc.availableQuest;
        currentInteractingNpc.availableQuest = null;
    }
    closeNpcDialog();
    updateQuestUI();
}

function skipQuest() {
    if (currentInteractingNpc) {
        currentInteractingNpc.availableQuest = null;
    }
    closeNpcDialog();
}

function closeNpcDialog() {
    isDialogOpen = false;
    currentInteractingNpc = null;
    document.getElementById('npc-dialog').style.display = 'none';
}

// Отрисовка списка заданий в UI с указанием ИМЕНИ NPC
function updateQuestUI() {
    const container = document.getElementById('quest-list');
    const activeQuests = npcs.filter(n => n.activeQuest !== null).map(n => n.activeQuest);

    if (activeQuests.length === 0) {
        container.innerHTML = `<div style="color: #7f8c8d; font-style: italic;">Нет активных заданий. Подойдите к NPC.</div>`;
        return;
    }

    let html = '';
    activeQuests.forEach(q => {
        let current = 0;
        if (q.type === 'kill_enemies') current = state.stats.enemiesKilled - q.startValue;
        if (q.type === 'repair_houses') current = state.stats.housesRepaired - q.startValue;
        if (q.type === 'upgrade_castle') current = state.worldLevel;

        let target = q.amount;
        if (q.type === 'upgrade_castle') target = q.targetValue;

        if (current >= target) q.isCompleted = true;

        html += `
            <div class="quest-item ${q.isCompleted ? 'completed' : ''}">
                <div class="quest-npc-author">От: ${q.npcName}</div>
                <b>${q.text}</b><br>
                Прогресс: ${Math.min(current, target)} / ${target}<br>
                Статус: ${q.isCompleted ? '<span style="color:#2ecc71">Сдайте квест NPC!</span>' : '<span style="color:#f39c12">В процессе</span>'}
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- СИСТЕМА РЕЙДОВ ВРАГОВ ---
let isRaidActive = false;
let raidTimer = 10;
let raidInterval = null;

function startRaid() {
    isRaidActive = true;
    raidTimer = 10;
    document.getElementById('raid-banner').style.display = 'block';
    document.getElementById('raid-timer').innerText = raidTimer;

    const spawnInterval = setInterval(() => {
        if (!isRaidActive) { clearInterval(spawnInterval); return; }
        entities.push({
            type: 'enemy',
            x: Math.random() > 0.5 ? 0 : MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            size: 14,
            speed: 1.6
        });
    }, 800);

    raidInterval = setInterval(() => {
        raidTimer--;
        document.getElementById('raid-timer').innerText = raidTimer;
        if (raidTimer <= 0) {
            isRaidActive = false;
            document.getElementById('raid-banner').style.display = 'none';
            clearInterval(raidInterval);
            clearInterval(spawnInterval);
        }
    }, 1000);
}

setInterval(() => {
    if (!isRaidActive) startRaid();
}, 35000);

// Разрушенные дома и Ресурсы[cite: 1, 2]
let houses = [];
for (let i = 0; i < 20; i++) {
    let hx = 100 + Math.random() * (MAP_SIZE - 200);
    let hy = 100 + Math.random() * (MAP_SIZE - 200);
    if (Math.hypot(hx - castle.x, hy - castle.y) > 200) {
        houses.push({
            x: hx, y: hy, size: 50, isRepaired: false, progress: 0,
            cost: { wood: 15, stone: 15, coins: 20 }
        });
    }
}

let entities = [];
function spawnResource(type) {
    entities.push({ type: type, x: 50 + Math.random() * (MAP_SIZE - 100), y: 50 + Math.random() * (MAP_SIZE - 100), size: 14 });
}
for (let i = 0; i < 25; i++) { spawnResource('wood'); spawnResource('stone'); }

// Управление мышью
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 || e.button === 1 || e.shiftKey) {
        camera.isDragging = true;
        camera.dragStartX = e.clientX;
        camera.dragStartY = e.clientY;
        camera.followPlayer = false;
    } else if (e.button === 0) {
        const pos = toCartesian(e.clientX, e.clientY);
        player.targetX = Math.max(0, Math.min(MAP_SIZE, pos.x));
        player.targetY = Math.max(0, Math.min(MAP_SIZE, pos.y));
        camera.followPlayer = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (camera.isDragging) {
        const dx = e.clientX - camera.dragStartX;
        const dy = e.clientY - camera.dragStartY;
        camera.x -= (dy + dx / 2) * 0.8;
        camera.y -= (dy - dx / 2) * 0.8;
        camera.dragStartX = e.clientX;
        camera.dragStartY = e.clientY;
    }
});
window.addEventListener('mouseup', () => camera.isDragging = false);

// Обновление игровой логики
function update() {
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

    // Проверка взаимодействия со всеми NPC[cite: 1]
    npcs.forEach(n => {
        const distToNpc = Math.hypot(n.x - player.x, n.y - player.y);
        if (distToNpc < n.size + player.size + 10) {
            if (n.availableQuest && !isDialogOpen) {
                openNpcDialog(n, n.availableQuest);
            } else if (n.activeQuest && n.activeQuest.isCompleted) {
                state.wood += n.activeQuest.reward.wood || 0;
                state.stone += n.activeQuest.reward.stone || 0;
                state.coins += n.activeQuest.reward.coins || 0;
                n.activeQuest = null;
                updateQuestUI();
            }
        }
    });

    // Ремонт домов[cite: 1]
    houses.forEach(house => {
        if (!house.isRepaired) {
            const distToHouse = Math.hypot(house.x - player.x, house.y - player.y);
            if (distToHouse < house.size / 2 + player.size + 10) {
                if (state.wood >= house.cost.wood && state.stone >= house.cost.stone && state.coins >= house.cost.coins) {
                    house.progress += 2;
                    if (house.progress >= 100) {
                        state.wood -= house.cost.wood;
                        state.stone -= house.cost.stone;
                        state.coins -= house.cost.coins;
                        house.isRepaired = true;
                        state.stats.housesRepaired++;
                        state.coins += 40;
                        updateQuestUI();
                    }
                }
            }
        }
    });

    // Враги и ресурсы[cite: 1, 2]
    for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (ent.type === 'enemy') {
            const edx = castle.x - ent.x;
            const edy = castle.y - ent.y;
            const edist = Math.hypot(edx, edy);
            if (edist > 5) {
                ent.x += (edx / edist) * ent.speed;
                ent.y += (edy / edist) * ent.speed;
            }
        }

        const pDist = Math.hypot(ent.x - player.x, ent.y - player.y);
        if (pDist < player.size + ent.size) {
            if (ent.type === 'wood' || ent.type === 'drop_wood') state.wood += 5;
            if (ent.type === 'stone' || ent.type === 'drop_stone') state.stone += 5;
            if (ent.type === 'drop_coins') state.coins += 15;

            if (ent.type === 'enemy') {
                state.stats.enemiesKilled++;
                const dropType = Math.random() > 0.5 ? 'drop_wood' : 'drop_stone';
                entities.push({ type: dropType, x: ent.x, y: ent.y, size: 10 });
                entities.push({ type: 'drop_coins', x: ent.x + 10, y: ent.y + 10, size: 8 });
                updateQuestUI();
            }

            entities.splice(i, 1);
        }
    }

    if (entities.filter(e => e.type === 'wood').length < 15) spawnResource('wood');
    if (entities.filter(e => e.type === 'stone').length < 15) spawnResource('stone');

    // Улучшение замок[cite: 1]
    const distToCastle = Math.hypot(castle.x - player.x, castle.y - player.y);
    if (distToCastle < castle.size / 2 + player.size) {
        if (state.wood >= castle.upgradeCost.wood && state.stone >= castle.upgradeCost.stone && state.coins >= castle.upgradeCost.coins) {
            state.wood -= castle.upgradeCost.wood;
            state.stone -= castle.upgradeCost.stone;
            state.coins -= castle.upgradeCost.coins;
            state.worldLevel += 1;

            castle.upgradeCost.wood = Math.floor(castle.upgradeCost.wood * 1.5);
            castle.upgradeCost.stone = Math.floor(castle.upgradeCost.stone * 1.5);
            castle.upgradeCost.coins = Math.floor(castle.upgradeCost.coins * 1.5);
            updateQuestUI();
        }
    }

    // Текстовый UI
    document.getElementById('worldLevel').innerText = state.worldLevel;
    document.getElementById('coins').innerText = state.coins;
    document.getElementById('wood').innerText = state.wood;
    document.getElementById('stone').innerText = state.stone;
    document.getElementById('costCoins').innerText = castle.upgradeCost.coins;
    document.getElementById('costWood').innerText = castle.upgradeCost.wood;
    document.getElementById('costStone').innerText = castle.upgradeCost.stone;
}

// Отрисовка Мини-карты
function renderMinimap() {
    const size = minimapCanvas.width;
    const viewRadius = 450;
    const scale = size / (viewRadius * 2);

    miniCtx.fillStyle = '#1e272e';
    miniCtx.fillRect(0, 0, size, size);

    const camX = player.x;
    const camY = player.y;

    function toMiniMap(x, y) {
        return {
            x: (x - camX) * scale + size / 2,
            y: (y - camY) * scale + size / 2
        };
    }

    // Границы карты
    const topLeft = toMiniMap(0, 0);
    const bottomRight = toMiniMap(MAP_SIZE, MAP_SIZE);
    miniCtx.strokeStyle = '#7f8c8d';
    miniCtx.lineWidth = 1;
    miniCtx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

    // Дома[cite: 1]
    houses.forEach(h => {
        const pos = toMiniMap(h.x, h.y);
        miniCtx.fillStyle = h.isRepaired ? '#e67e22' : '#7f8c8d';
        miniCtx.fillRect(pos.x - 3, pos.y - 3, 6, 6);
    });

    // Враги[cite: 1]
    entities.forEach(e => {
        if (e.type === 'enemy') {
            const pos = toMiniMap(e.x, e.y);
            miniCtx.fillStyle = '#e74c3c';
            miniCtx.beginPath();
            miniCtx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            miniCtx.fill();
        }
    });

    // Замок[cite: 1]
    const castlePos = toMiniMap(castle.x, castle.y);
    miniCtx.fillStyle = '#9b59b6';
    miniCtx.fillRect(castlePos.x - 6, castlePos.y - 6, 12, 12);

    // Все NPC (желтые точки)[cite: 1]
    npcs.forEach(n => {
        const pos = toMiniMap(n.x, n.y);
        miniCtx.fillStyle = '#f1c40f';
        miniCtx.beginPath();
        miniCtx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        miniCtx.fill();
    });

    // Игрок
    const playerPos = toMiniMap(player.x, player.y);
    miniCtx.fillStyle = '#3498db';
    miniCtx.beginPath();
    miniCtx.arc(playerPos.x, playerPos.y, 4, 0, Math.PI * 2);
    miniCtx.fill();
    miniCtx.strokeStyle = '#ffffff';
    miniCtx.lineWidth = 1.5;
    miniCtx.stroke();
}

// Отрисовка Изометрии
function drawIsoBlock(x, y, sizeX, sizeY, height, topColor, leftColor, rightColor) {
    const p1 = toIso(x, y);
    const p2 = toIso(x + sizeX, y);
    const p3 = toIso(x + sizeX, y + sizeY);
    const p4 = toIso(x, y + sizeY);

    if (p3.isoX < -100 || p1.isoX > canvas.width + 100 || p3.isoY < -100 || p1.isoY > canvas.height + 100) return;

    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(p4.isoX, p4.isoY); ctx.lineTo(p3.isoX, p3.isoY);
    ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p4.isoX, p4.isoY - height);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(p2.isoX, p2.isoY); ctx.lineTo(p3.isoX, p3.isoY);
    ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p2.isoX, p2.isoY - height);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(p1.isoX, p1.isoY - height); ctx.lineTo(p2.isoX, p2.isoY - height);
    ctx.lineTo(p3.isoX, p3.isoY - height); ctx.lineTo(p4.isoX, p4.isoY - height);
    ctx.closePath(); ctx.fill();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawIsoBlock(0, 0, MAP_SIZE, MAP_SIZE, 0, '#4d8348', '#386134', '#284725');

    let renderList = [
        { type: 'castle', y: castle.y },
        ...npcs.map(n => ({ type: 'npc', data: n, y: n.y })),
        { type: 'player', y: player.y },
        ...houses.map(h => ({ type: 'house', data: h, y: h.y })),
        ...entities.map(e => ({ type: e.type, data: e, y: e.y }))
    ];

    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach(obj => {
        if (obj.type === 'castle') {
            drawIsoBlock(castle.x - 55, castle.y - 55, 110, 110, 80, '#9b59b6', '#8e44ad', '#6c3483');
            const iso = toIso(castle.x, castle.y);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('🏰 Замок Героев', iso.isoX, iso.isoY - 95);
        }
        else if (obj.type === 'npc') {
            const n = obj.data;
            drawIsoBlock(n.x - 10, n.y - 10, 20, 20, 30, n.colorTop, n.colorLeft, n.colorRight);
            const iso = toIso(n.x, n.y);
            
            ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
            if (n.activeQuest && n.activeQuest.isCompleted) {
                ctx.fillStyle = '#2ecc71';
                ctx.fillText('❓ (Сдать!)', iso.isoX, iso.isoY - 45);
            } else if (n.availableQuest) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillText('❗ (Квест)', iso.isoX, iso.isoY - 45);
            } else {
                ctx.fillStyle = '#bdc3c7';
                ctx.font = '11px sans-serif';
                ctx.fillText(n.name, iso.isoX, iso.isoY - 40);
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
                if (h.progress > 0) {
                    ctx.fillStyle = '#e74c3c'; ctx.fillRect(iso.isoX - 25, iso.isoY - 24, 50, 4);
                    ctx.fillStyle = '#2ecc71'; ctx.fillRect(iso.isoX - 25, iso.isoY - 24, (h.progress / 100) * 50, 4);
                }
            }
        }
        else if (obj.type === 'player') {
            const iso = toIso(player.x, player.y);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(iso.isoX, iso.isoY, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
            drawIsoBlock(player.x - 9, player.y - 9, 18, 18, 28, '#3498db', '#2980b9', '#1f618d');
        }
        else if (obj.type === 'wood') drawIsoBlock(obj.data.x - 7, obj.data.y - 7, 14, 14, 18, '#2ecc71', '#27ae60', '#1e8449');
        else if (obj.type === 'stone') drawIsoBlock(obj.data.x - 7, obj.data.y - 7, 14, 14, 10, '#bdc3c7', '#95a5a6', '#7f8c8d');
        else if (obj.type === 'enemy') drawIsoBlock(obj.data.x - 7, obj.data.y - 7, 14, 14, 16, '#e74c3c', '#c0392b', '#962d22');
        else if (obj.type === 'drop_wood') drawIsoBlock(obj.data.x - 5, obj.data.y - 5, 10, 10, 8, '#f1c40f', '#27ae60', '#1e8449');
        else if (obj.type === 'drop_stone') drawIsoBlock(obj.data.x - 5, obj.data.y - 5, 10, 10, 8, '#f1c40f', '#95a5a6', '#7f8c8d');
        else if (obj.type === 'drop_coins') drawIsoBlock(obj.data.x - 4, obj.data.y - 4, 8, 8, 5, '#f39c12', '#d35400', '#e67e22');
    });

    renderMinimap();
}

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

loop();