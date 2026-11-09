// Карточка профиля (картинка для /profile).
// Стиль: экран персонажа из Genshin + справочники D&D (TTG Club, dnd.su) -
// тёмный сланцевый фон, бирюзовая панель, тонкие золотые линии, звёзды-ромбы, списки атрибутов.
// Слева - «именная карта» с портретом в арке, справа - персонажи, характеристики, рассудок.
// Ассеты: assets/profile/background.png, sidebar.png (генерируются: npm run assets).
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { config, ROOT } = require('../core/config');
const characters = require('../services/characters');
const progression = require('../services/progression');
const sanity = require('../services/sanity');
const avatars = require('../services/avatars');
const { icon } = require('./icons');

// ── Шрифты ────────────────────────────────────────────────────────────
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
for (const f of fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR) : []) {
    if (f.endsWith('.ttf')) GlobalFonts.registerFromPath(path.join(FONT_DIR, f), f.split('-')[0]);
}
const HEAD = 'Merriweather';
const BODY = 'Lora';

// ── Размеры: рисуем в логических 1100×540, на выходе ×1.5 ─────────────
const W = 1100, H = 540, SCALE = 1.5;
const C = config.theme.colors;
const PAL = {
    text: C.light,                          // слоновая кость
    soft: 'rgba(255, 255, 240, 0.72)',
    muted: 'rgba(255, 255, 240, 0.48)',
    faint: 'rgba(255, 255, 240, 0.22)',
    gold: '#d9b26f',                        // светлая латунь - линии и подписи
    brass: C.accent,
    line: 'rgba(217, 178, 111, 0.32)',
    lineSoft: 'rgba(217, 178, 111, 0.14)',
    row: 'rgba(255, 255, 240, 0.045)',
    rowAlt: 'rgba(255, 255, 240, 0.022)',
    emerald: C.primary,
    emeraldHi: '#3f8a60',
    teal: '#1d5260',          // в тон левой панели
    tealHi: '#2f7480',
    danger: '#c0564b',
};
const RX1 = 324, RX2 = 1076;
// ── Ассеты ────────────────────────────────────────────────────────────
const ASSET_DIR = path.join(ROOT, 'assets', 'profile');
const assetCache = new Map();
async function asset(name) {
    if (!assetCache.has(name)) {
        const file = path.join(ASSET_DIR, name);
        assetCache.set(name, fs.existsSync(file) ? loadImage(fs.readFileSync(file)) : Promise.resolve(null));
    }
    return assetCache.get(name);
}

// ── Внешние картинки (аватары): таймаут, лимит размера, кеш 5 минут ───
const remoteCache = new Map();
async function remote(url) {
    if (!url) return null;
    const hit = remoteCache.get(url);
    if (hit && hit.expires > Date.now()) return hit.img;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 10 * 1024 * 1024) throw new Error('too big');
        const img = await loadImage(buf);
        remoteCache.set(url, { img, expires: Date.now() + 5 * 60 * 1000 });
        return img;
    } catch { return null; }
}

async function characterArt(ch, fallbackUrl) {
    const file = avatars.filePath(ch?.avatar_file);
    if (file && fs.existsSync(file)) { try { return await loadImage(fs.readFileSync(file)); } catch { /* битый файл */ } }
    return remote(fallbackUrl);
}

// ── Помощники рисования ───────────────────────────────────────────────
function font(ctx, size, family = BODY, weight = '') { ctx.font = `${weight} ${size}px ${family}`.trim(); }

function fitFont(ctx, text, maxW, size, family, weight = '', min = 10) {
    let s = size;
    do { font(ctx, s, family, weight); s--; } while (ctx.measureText(text).width > maxW && s >= min);
}

function ellipsis(ctx, text, maxW) {
    let t = String(text ?? '');
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t}…`;
}

/** Текст капителью с разрядкой */
function caps(ctx, text, x, y, spacing = 1.2, align = 'left') {
    const chars = [...String(text).toUpperCase()];
    const total = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    ctx.textAlign = 'left';
    for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
    return total;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function cover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function hline(ctx, x1, x2, y, color = PAL.line, width = 1) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y + 0.5); ctx.lineTo(x2, y + 0.5); ctx.stroke(); ctx.restore();
}

/** Линия, тающая к правому краю */
function fadeLine(ctx, x1, x2, y, color = PAL.gold, alpha = 0.45) {
    const g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, hexA(color, alpha)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x1, y, x2 - x1, 1);
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

/** Четырёхлучевая звезда */
function star4(ctx, x, y, r, color) {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
}

function diamond(ctx, cx, cy, r, color) {
    ctx.save(); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    ctx.restore();
}

/** Контур со срезанными углами (как плашки в Genshin) */
function cutRect(ctx, x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}

/** Заголовок раздела: ✦ НАЗВАНИЕ ────────── подпись */
function heading(ctx, title, right, y, { rightColor = PAL.gold, rightIcon } = {}) {
    star4(ctx, RX1 + 6, y - 5, 6, PAL.gold);
    ctx.fillStyle = PAL.text; font(ctx, 13.5, HEAD, 'bold');
    const tw = caps(ctx, title, RX1 + 20, y, 1.8);
    let rx = RX2;
    if (right) {
        ctx.fillStyle = rightColor; font(ctx, 10.5, HEAD, 'bold');
        const rw = caps(ctx, right, RX2, y, 1.2, 'right');
        rx = RX2 - rw - 14;
        if (rightIcon) { icon(ctx, rightIcon, rx, y - 4, 14, rightColor); rx -= 16; }
    }
    fadeLine(ctx, RX1 + 20 + tw + 14, rx, y - 5, PAL.gold, 0.35);
}

function initials(ctx, name, cx, cy, size, color = PAL.gold) {
    ctx.fillStyle = color; font(ctx, size, HEAD, 'bold');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText([...String(name || '?').trim()][0]?.toUpperCase() || '?', cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
}

/** Плашка-пилюля с текстом. Возвращает ширину */
function pill(ctx, text, x, y, { h = 22, fill = 'rgba(6, 22, 32, 0.5)', stroke = PAL.line, color = PAL.gold, size = 10.5, measureOnly = false } = {}) {
    font(ctx, size, HEAD, 'bold');
    const chars = [...String(text).toUpperCase()];
    const tw = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + 1.2 * (chars.length - 1);
    const w = tw + 26;
    if (measureOnly) return w;
    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color; caps(ctx, text, x + 13, y + h / 2 + size * 0.36, 1.2);
    return w;
}

// ── Фон ───────────────────────────────────────────────────────────────
async function background(ctx) {
    const bg = await asset('background.png');
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else { ctx.fillStyle = '#101814'; ctx.fillRect(0, 0, W, H); }
}

// ── Левая панель: «именная карта» ─────────────────────────────────────
const SB = { x: 24, y: 24, w: 276, h: 492 };

/** Арка (верх - полукруг) */
function archPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
}

async function sidebar(ctx, d) {
    const { ch } = d;
    const { x, y, w, h } = SB, cx = x + w / 2;
    // подложка
    ctx.save(); cutRect(ctx, x, y, w, h, 12); ctx.clip();
    const tex = await asset('sidebar.png');
    if (tex) ctx.drawImage(tex, x, y, w, h); else { ctx.fillStyle = '#1c3d2c'; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    cutRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 12); ctx.strokeStyle = PAL.gold; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    cutRect(ctx, x + 6, y + 6, w - 12, h - 12, 9); ctx.strokeStyle = PAL.lineSoft; ctx.stroke();
    for (const [px, py] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) star4(ctx, px, py, 5, PAL.gold);

    // Сервер
    const guildIcon = await remote(d.guildIconUrl);
    let tx = x + 24;
    if (guildIcon) {
        ctx.save(); ctx.beginPath(); ctx.arc(x + 33, y + 34, 10, 0, Math.PI * 2); ctx.clip(); cover(ctx, guildIcon, x + 23, y + 24, 20, 20); ctx.restore();
        ctx.beginPath(); ctx.arc(x + 33, y + 34, 10.5, 0, Math.PI * 2); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.stroke();
        tx = x + 50;
    } else { star4(ctx, x + 30, y + 34, 7, PAL.gold); tx = x + 44; }
    ctx.fillStyle = PAL.soft; fitFont(ctx, (d.guildName || '').toUpperCase(), w - (tx - x) - 24, 11, HEAD, 'bold', 8);
    caps(ctx, ellipsis(ctx, d.guildName || '', w - (tx - x) - 40), tx, y + 38, 2);

    // Портрет в арке, низ растворяется в панели
    const ax = x + 26, ay = y + 58, aw = w - 52, ah = 238;
    const art = await characterArt(ch, d.ownerAvatarUrl);
    ctx.save(); archPath(ctx, ax, ay, aw, ah); ctx.clip();
    ctx.fillStyle = 'rgba(8, 30, 42, 0.45)'; ctx.fillRect(ax, ay, aw, ah);
    if (art) cover(ctx, art, ax, ay, aw, ah); else initials(ctx, ch.name, ax + aw / 2, ay + ah * 0.48, 78, '#a7a48f');
    const fade = ctx.createLinearGradient(0, ay + ah * 0.55, 0, ay + ah);
    fade.addColorStop(0, 'rgba(20, 58, 76, 0)'); fade.addColorStop(1, 'rgba(20, 58, 76, 0.92)');
    ctx.fillStyle = fade; ctx.fillRect(ax, ay, aw, ah);
    ctx.restore();
    archPath(ctx, ax, ay, aw, ah); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.4; ctx.stroke();
    archPath(ctx, ax - 6, ay - 6, aw + 12, ah + 6); ctx.strokeStyle = PAL.line; ctx.lineWidth = 1; ctx.stroke();
    // замковый камень арки
    diamond(ctx, cx, ay - 6, 7, '#163a4c'); star4(ctx, cx, ay - 6, 9, PAL.gold);

    // Уровень - плашка на нижнем краю арки (как «Ур. 80/90»)
    const lvl = `Ур. ${ch.level} / ${config.xp.maxLevel}`;
    const lw = pill(ctx, lvl, 0, 0, { measureOnly: true, size: 11 });
    pill(ctx, lvl, cx - lw / 2, ay + ah - 13, { h: 26, size: 11, fill: '#143b4f', stroke: PAL.gold, color: PAL.text });

    // Имя и владелец
    ctx.textAlign = 'center'; ctx.fillStyle = PAL.text; fitFont(ctx, ch.name, w - 40, 24, HEAD, 'bold', 13);
    ctx.fillText(ellipsis(ctx, ch.name, w - 40), cx, y + 346);
    ctx.fillStyle = PAL.muted; font(ctx, 12.5, BODY, 'italic');
    ctx.fillText(ellipsis(ctx, d.ownerName ? `@${d.ownerName}` : '', w - 40), cx, y + 367);

    // Раса и класс - две плашки по центру (обрезаются, если длинные)
    ctx.textAlign = 'left';
    const tags = [ch.race, ch.class].filter(Boolean).map((t) => String(t));
    font(ctx, 10, HEAD, 'bold');
    const cut = (t, max) => { let s = t; while (s.length > 1 && pill(ctx, s, 0, 0, { measureOnly: true, size: 10 }) > max) s = s.slice(0, -1); return s === t ? t : `${s.slice(0, -1)}…`; };
    const parts = tags.map((t) => cut(t, (w - 48) / tags.length));
    const widths = parts.map((t) => pill(ctx, t, 0, 0, { measureOnly: true, size: 10 }));
    let px = cx - (widths.reduce((a, b) => a + b, 0) + 8 * (parts.length - 1)) / 2;
    parts.forEach((t, i) => { pill(ctx, t, px, y + 382, { size: 10 }); px += widths[i] + 8; });

    // Опыт
    const need = progression.xpToNext(ch.level);
    const pct = Math.max(0, Math.min(1, ch.xp / Math.max(1, need)));
    const bx = x + 26, bw = w - 52, by = y + 436;
    fadeLine(ctx, bx, bx + bw, by - 14, PAL.gold, 0.25);
    ctx.fillStyle = PAL.muted; font(ctx, 9.5, HEAD, 'bold'); caps(ctx, 'Опыт', bx, by + 8, 1.6);
    ctx.textAlign = 'right'; ctx.fillStyle = PAL.text; font(ctx, 13, HEAD, 'bold'); ctx.fillText(`${ch.xp} / ${need}`, bx + bw, by + 9);
    roundRect(ctx, bx, by + 18, bw, 6, 3); ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fill();
    ctx.strokeStyle = PAL.lineSoft; ctx.lineWidth = 1; ctx.stroke();
    if (pct > 0) {
        const fw = Math.max(6, bw * pct);
        const g = ctx.createLinearGradient(bx, 0, bx + fw, 0); g.addColorStop(0, PAL.brass); g.addColorStop(1, '#f0cf8e');
        roundRect(ctx, bx, by + 18, fw, 6, 3); ctx.fillStyle = g; ctx.fill();
        star4(ctx, bx + fw, by + 21, 6, '#fff3d6');
    }
    ctx.textAlign = 'left'; ctx.fillStyle = PAL.faint; font(ctx, 10.5, BODY, 'italic');
    ctx.fillText(ch.level >= config.xp.maxLevel ? 'Максимальный уровень' : `до ${ch.level + 1} уровня - ${Math.max(0, need - ch.xp)}`, bx, by + 42);
}

// ── Персонажи ─────────────────────────────────────────────────────────
async function slots(ctx, d) {
    const n = Math.min(3, Math.max(1, config.characters.maxPerUser));
    heading(ctx, 'Персонажи', `${d.characters.length} / ${config.characters.maxPerUser}`, 50, { rightIcon: 'person' });
    const gap = 12, sw = (RX2 - RX1 - gap * (n - 1)) / n, sy = 66, sh = 136;
    const list = [...d.characters];
    if (list.length > n && !list.slice(0, n).some((c) => c.id === d.ch.id)) list.splice(n - 1, 0, d.ch);
    for (let i = 0; i < n; i++) {
        const c = list[i];
        const sx = RX1 + i * (sw + gap);
        const cur = c && c.id === d.ch.id;
        // карточка
        roundRect(ctx, sx, sy, sw, sh, 8);
        if (cur) {
            const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
            g.addColorStop(0, 'rgba(47, 116, 128, 0.55)'); g.addColorStop(1, 'rgba(20, 58, 76, 0.8)');
            ctx.fillStyle = g;
        } else ctx.fillStyle = c ? 'rgba(255, 255, 240, 0.03)' : 'rgba(0, 0, 0, 0)';
        ctx.fill();
        ctx.save(); if (!c) ctx.setLineDash([4, 4]);
        ctx.strokeStyle = cur ? PAL.gold : c ? PAL.lineSoft : PAL.faint; ctx.lineWidth = cur ? 1.4 : 1; ctx.stroke(); ctx.restore();
        ctx.textAlign = 'right'; ctx.fillStyle = cur ? PAL.gold : PAL.faint; font(ctx, 10, HEAD, 'bold');
        ctx.fillText(String(i + 1).padStart(2, '0'), sx + sw - 14, sy + 22);
        if (!c) {
                        ctx.strokeStyle = PAL.muted; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(sx + sw / 2 - 6, sy + 52); ctx.lineTo(sx + sw / 2 + 6, sy + 52); ctx.moveTo(sx + sw / 2, sy + 46); ctx.lineTo(sx + sw / 2, sy + 58); ctx.stroke();
            ctx.textAlign = 'center'; ctx.fillStyle = PAL.muted; font(ctx, 13.5, HEAD, 'bold'); ctx.fillText('Свободный слот', sx + sw / 2, sy + 96);
            ctx.fillStyle = PAL.faint; font(ctx, 11, BODY, 'italic'); ctx.fillText('выдаёт администрация', sx + sw / 2, sy + 114);
            continue;
        }
        // миниатюра
        const t = 58, tx = sx + 14, ty = sy + 14;
        ctx.save(); roundRect(ctx, tx, ty, t, t, 6); ctx.fillStyle = 'rgba(8, 30, 42, 0.6)'; ctx.fill(); ctx.clip();
        const art = await characterArt(c, null);
        if (art) cover(ctx, art, tx, ty, t, t); else initials(ctx, c.name, tx + t / 2, ty + t / 2, 24);
        ctx.restore();
        roundRect(ctx, tx, ty, t, t, 6); ctx.strokeStyle = cur ? PAL.gold : PAL.line; ctx.lineWidth = 1; ctx.stroke();
        // имя, раса и класс
        const nx = tx + t + 12, nw = sw - (nx - sx) - 30;
        ctx.textAlign = 'left'; ctx.fillStyle = PAL.text; fitFont(ctx, c.name, nw, 15.5, HEAD, 'bold', 10);
        ctx.fillText(ellipsis(ctx, c.name, nw), nx, ty + 26);
        ctx.fillStyle = PAL.muted; font(ctx, 11, BODY, 'italic');
        ctx.fillText(ellipsis(ctx, c.race, nw + 16), nx, ty + 43);
        ctx.fillText(ellipsis(ctx, c.class, nw + 16), nx, ty + 57);
        // нижняя полоса: ID · активен · уровень
        const fy = sy + sh - 40;
        hline(ctx, sx + 14, sx + sw - 14, fy, cur ? 'rgba(217,178,111,0.35)' : PAL.lineSoft);
        ctx.fillStyle = PAL.muted; font(ctx, 10, BODY, 'bold'); ctx.fillText(`ID ${c.id}`, sx + 14, fy + 25);
        if (c.is_active) { star4(ctx, sx + 58, fy + 21, 4.5, PAL.gold); ctx.fillStyle = PAL.gold; font(ctx, 9, HEAD, 'bold'); caps(ctx, 'активен', sx + 66, fy + 25, 1); }
        ctx.textAlign = 'right'; ctx.fillStyle = PAL.text; font(ctx, 17, HEAD, 'bold');
        ctx.fillText(String(c.level), sx + sw - 14, fy + 27);
        const lw = ctx.measureText(String(c.level)).width;
        ctx.fillStyle = PAL.muted; font(ctx, 9, HEAD, 'bold'); caps(ctx, 'ур.', sx + sw - 19 - lw, fy + 25, 1, 'right');
    }
}

// ── Характеристики: список атрибутов в две колонки ───────────────────
function stats(ctx, d) {
    const { ch } = d;
    heading(ctx, 'Характеристики', `Здоровье ${characters.maxHp(ch)}`, 236, { rightIcon: 'hp' });
    const list = config.stats.list;
    const cols = list.length > 3 ? 2 : 1, rows = Math.ceil(list.length / cols);
    const gap = 12, cw = (RX2 - RX1 - gap * (cols - 1)) / cols, rh = rows > 3 ? 112 / rows : 34, rg = 5, y0 = 250;
    list.forEach((s, i) => {
        const col = Math.floor(i / rows), row = i % rows;
        const x = RX1 + col * (cw + gap), y = y0 + row * (rh + rg);
        if (row > 0) hline(ctx, x, x + cw, y - rg / 2 - 0.5, PAL.lineSoft);
        const ix = x + 14, iy = y + rh / 2;
        icon(ctx, s.key, ix, iy, 15, PAL.gold);
        ctx.textAlign = 'left'; ctx.fillStyle = PAL.gold; font(ctx, 10, HEAD, 'bold'); caps(ctx, s.short, x + 34, iy + 4, 1.4);
        const v = String(ch.stats[s.key]);
        ctx.fillStyle = PAL.text; fitFont(ctx, v, cw * 0.4, 17, HEAD, 'bold', 10);
        ctx.textAlign = 'right'; ctx.fillText(v, x + cw - 4, iy + 6);
        const vw = ctx.measureText(v).width;
        ctx.textAlign = 'left'; ctx.fillStyle = PAL.soft; font(ctx, 12.5, BODY);
        ctx.fillText(ellipsis(ctx, s.name, cw - 74 - vw - 16), x + 74, iy + 4.5);
    });
}

// ── Рассудок: фаза луны + шкала с порогами ───────────────────────────
function mind(ctx, d) {
    const { ch } = d;
    const mad = sanity.activeMadness(ch);
    const pen = sanity.rollPenalty(ch);
    const st = sanity.state(ch.sanity);
    heading(ctx, 'Рассудок', mad ? `Безумие · штраф ${pen}` : pen ? `Штраф к броскам ${pen}` : 'Без штрафов', 400, { rightColor: mad ? PAL.danger : PAL.gold });
    const states = [...config.sanity.states].sort((a, b) => b.min - a.min);
    const y = 416, h = 80;
    const accent = mad ? PAL.danger : PAL.gold;
    ctx.textAlign = 'left'; ctx.fillStyle = PAL.text; font(ctx, 24, HEAD, 'bold');
    const val = `${ch.sanity}`; ctx.fillText(val, RX1, y + 40);
    const vw = ctx.measureText(val).width;
    ctx.fillStyle = PAL.muted; font(ctx, 12, BODY); ctx.fillText(`/ ${config.sanity.max}`, RX1 + 5 + vw, y + 40);
    ctx.fillStyle = accent; font(ctx, 10.5, HEAD, 'bold');
    caps(ctx, mad ? 'Временное безумие' : st.name, RX1 + 1, y + 60, 1.4);
    // шкала 0…max, слева направо
    const max = Math.max(1, config.sanity.max);
    const bx1 = RX1 + 190, bx2 = RX2, by = y + 30;
    const X = (v) => bx1 + (bx2 - bx1) * Math.max(0, Math.min(1, v / max));
    const asc = [...states].reverse();
    asc.forEach((s, i) => {
        const sx = X(s.min) + (i ? 2 : 0), ex = X(asc[i + 1]?.min ?? max) - (i < asc.length - 1 ? 2 : 0);
        const on = s === st;
        roundRect(ctx, sx, by - 3, Math.max(2, ex - sx), 6, 3);
        ctx.fillStyle = on ? (mad ? PAL.danger : PAL.tealHi) : 'rgba(255,255,240,0.08)'; ctx.fill();
        ctx.textAlign = 'center'; ctx.fillStyle = on ? PAL.text : PAL.muted; font(ctx, 9, HEAD, 'bold');
        caps(ctx, ellipsis(ctx, s.name, ex - sx - 4), (sx + ex) / 2, by + 22, 1, 'center');
        ctx.fillStyle = on ? PAL.soft : PAL.faint; font(ctx, 10, BODY, 'italic');
        ctx.textAlign = 'center'; ctx.fillText(`от ${s.min}${s.penalty ? ` · ${s.penalty}` : ''}`, (sx + ex) / 2, by + 36);
    });
    const fx = X(ch.sanity);
    star4(ctx, fx, by, 11, '#0f1619'); star4(ctx, fx, by, 9, accent);
}

/**
 * Рисует карточку. data = {
 *   ch, characters: [персонажи владельца], ownerName, ownerAvatarUrl, guildName, guildIconUrl
 * }
 */
async function renderProfileCard(data) {
    const d = { characters: [data.ch], ...data };
    const canvas = createCanvas(Math.round(W * SCALE), Math.round(H * SCALE));
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingQuality = 'high';
    await background(ctx);
    await sidebar(ctx, d);
    await slots(ctx, d);
    stats(ctx, d);
    mind(ctx, d);
    return canvas.toBuffer('image/png');
}

module.exports = { renderProfileCard };
