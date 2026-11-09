// Генерирует все картинки оформления в assets/profile/:
//   background.png - фон карточки профиля, sidebar.png - фактура левой панели,
//   divider.png - разделитель для сообщений.
// Запуск: npm run assets   (после смены цветов в config/config.js)
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');
const { config } = require('../src/core/config');

const C = config.theme.colors;
const OUT = path.join(__dirname, '..', 'assets', 'profile');
fs.mkdirSync(OUT, { recursive: true });
const S = 1.5; // масштаб: карточка рисуется 1100×540 логических → 1650×810

// детерминированный «рандом», чтобы ассеты не менялись от запуска к запуску
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const GOLD = '#d9b26f';

function star4(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
}

/** Мелкое зерно (материал «бумага/ткань») */
function grain(ctx, W, H, amount, alpha) {
    for (let i = 0; i < amount; i++) {
        const v = rnd() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
        ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
    }
}
/** Потёртости: мягкие светлые пятна-«облака» */
function wear(ctx, W, H, count, alpha) {
    for (let i = 0; i < count; i++) {
        const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 90;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,248,230,${alpha * (0.4 + rnd() * 0.6)})`); g.addColorStop(1, 'rgba(255,248,230,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
}

// ── Фон карточки: спокойный тёмный сланец с ромбами ──────────────────
function background() {
    const W = 1100, H = 540;
    const cv = createCanvas(W * S, H * S); const ctx = cv.getContext('2d'); ctx.scale(S, S);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#121a1d'); g.addColorStop(0.55, '#0f1619'); g.addColorStop(1, '#0a0f11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // крупные ромбы, проявляются только к центру
    const d = 62;
    ctx.save();
    const mask = ctx.createRadialGradient(W * 0.6, H * 0.5, 40, W * 0.6, H * 0.5, W * 0.55);
    for (let y = -d; y < H + d; y += d) for (let x = -d; x < W + d; x += d * 2) {
        const ox = (Math.round(y / d) % 2) * d;
        const cx = x + ox, cy = y;
        const dist = Math.hypot(cx - W * 0.6, cy - H * 0.5) / (W * 0.55);
        const a = Math.max(0, 0.035 * (1 - dist));
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(160,200,205,${a})`;
        ctx.beginPath(); ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy); ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    void mask;
    grain(ctx, W, H, 26000, 0.05);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // тонкая рамка
    ctx.strokeStyle = rgba(GOLD, 0.22); ctx.lineWidth = 1; ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
    fs.writeFileSync(path.join(OUT, 'background.png'), cv.toBuffer('image/png'));
}

// ── Фактура левой панели: глубокая бирюза, потёртая ткань ────────────
function sidebar() {
    const W = 276, H = 492;
    const cv = createCanvas(W * S, H * S); const ctx = cv.getContext('2d'); ctx.scale(S, S);
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#2a6670'); g.addColorStop(0.45, '#184257'); g.addColorStop(1, '#0d2b40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    wear(ctx, W, H, 14, 0.035);
    // тонкая диагональная сетка
    ctx.strokeStyle = 'rgba(220,245,245,0.03)'; ctx.lineWidth = 1;
    for (let k = -H; k < W + H; k += 26) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - H, H); ctx.stroke();
    }
    // мягкие лучи сверху
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, w, a] of [[70, 36, 0.035], [150, 60, 0.03], [225, 26, 0.035]]) {
        const lg = ctx.createLinearGradient(0, 0, 0, H * 0.6);
        lg.addColorStop(0, `rgba(210,245,240,${a})`); lg.addColorStop(1, 'rgba(210,245,240,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w - 80, H * 0.6); ctx.lineTo(x - 80, H * 0.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    grain(ctx, W, H, 9000, 0.06);
    const b = ctx.createLinearGradient(0, H * 0.5, 0, H);
    b.addColorStop(0, 'rgba(4,14,22,0)'); b.addColorStop(1, 'rgba(4,14,22,0.45)');
    ctx.fillStyle = b; ctx.fillRect(0, 0, W, H);
    fs.writeFileSync(path.join(OUT, 'sidebar.png'), cv.toBuffer('image/png'));
}

// ── Разделитель для сообщений (прозрачный) ────────────────────────────
function divider() {
    const W = 620, H = 44, K = 3;
    const cv = createCanvas(W * K, H * K); const ctx = cv.getContext('2d'); ctx.scale(K, K);
    const cx = W / 2, cy = H / 2;
    for (const d of [-1, 1]) {
        const lg = ctx.createLinearGradient(cx + d * 40, 0, cx + d * (W / 2), 0);
        lg.addColorStop(0, rgba(GOLD, 0.95)); lg.addColorStop(1, rgba(GOLD, 0));
        ctx.strokeStyle = lg; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(cx + d * 40, cy); ctx.lineTo(cx + d * (W / 2 - 4), cy); ctx.stroke();
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(cx + d * 32, cy, 2.4, 0, Math.PI * 2); ctx.fill();
        star4(ctx, cx + d * 70, cy, 5, rgba(GOLD, 0.9));
    }
    ctx.strokeStyle = rgba(GOLD, 0.8); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
    star4(ctx, cx, cy, 17, GOLD);
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    fs.writeFileSync(path.join(OUT, 'divider.png'), cv.toBuffer('image/png'));
}

background(); sidebar(); divider();
console.log('Готово: assets/profile/{background,sidebar,divider}.png');
