// Линейные иконки «чернилами» для карточки профиля. Рисуются кодом - без фона,
// в любом цвете и размере. icon(ctx, name, cx, cy, size, color)
const P = {
    // Сила - меч
    str(c) {
        c.beginPath(); c.moveTo(0, -11); c.lineTo(2.2, -8); c.lineTo(2.2, 5); c.lineTo(-2.2, 5); c.lineTo(-2.2, -8); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(-7, 5); c.lineTo(7, 5); c.stroke();
        c.beginPath(); c.moveTo(0, 5); c.lineTo(0, 10); c.stroke();
        c.beginPath(); c.arc(0, 11.5, 1.6, 0, Math.PI * 2); c.fill();
    },
    // Ловкость - перо
    dex(c) {
        c.beginPath(); c.moveTo(-8, 10); c.bezierCurveTo(-4, 2, 2, -6, 9, -11); c.stroke();
        c.beginPath(); c.moveTo(9, -11); c.bezierCurveTo(10, -3, 5, 4, -3, 4); c.bezierCurveTo(-1, -2, 3, -7, 9, -11); c.stroke();
        c.beginPath(); c.moveTo(-1, 0); c.lineTo(3, -1.5); c.moveTo(1.5, -4); c.lineTo(5, -5); c.stroke();
    },
    // Телосложение - щит
    con(c) {
        c.beginPath(); c.moveTo(0, -11); c.lineTo(9, -7.5); c.bezierCurveTo(9, 2, 5, 8, 0, 11); c.bezierCurveTo(-5, 8, -9, 2, -9, -7.5); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 6); c.moveTo(-4.5, -1.5); c.lineTo(4.5, -1.5); c.stroke();
    },
    // Интеллект - открытая книга
    int(c) {
        c.beginPath(); c.moveTo(0, -5); c.bezierCurveTo(-4, -8, -8, -8, -11, -7); c.lineTo(-11, 7); c.bezierCurveTo(-8, 6, -4, 6, 0, 9); c.stroke();
        c.beginPath(); c.moveTo(0, -5); c.bezierCurveTo(4, -8, 8, -8, 11, -7); c.lineTo(11, 7); c.bezierCurveTo(8, 6, 4, 6, 0, 9); c.stroke();
        c.beginPath(); c.moveTo(0, -5); c.lineTo(0, 9); c.stroke();
    },
    // Восприятие - глаз
    per(c) {
        c.beginPath(); c.moveTo(-11, 0); c.bezierCurveTo(-6, -8, 6, -8, 11, 0); c.bezierCurveTo(6, 8, -6, 8, -11, 0); c.closePath(); c.stroke();
        c.beginPath(); c.arc(0, 0, 3.6, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(0, 0, 1.3, 0, Math.PI * 2); c.fill();
    },
    // Харизма - корона
    cha(c) {
        c.beginPath(); c.moveTo(-10, 7); c.lineTo(-10, -5); c.lineTo(-5, 0); c.lineTo(0, -8); c.lineTo(5, 0); c.lineTo(10, -5); c.lineTo(10, 7); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(-10, 3); c.lineTo(10, 3); c.stroke();
        for (const [x, y] of [[-10, -6.5], [0, -9.5], [10, -6.5]]) { c.beginPath(); c.arc(x, y, 1.4, 0, Math.PI * 2); c.fill(); }
    },
    // Здоровье - сердце
    hp(c) {
        c.beginPath(); c.moveTo(0, 9); c.bezierCurveTo(-12, 1, -9, -10, 0, -4); c.bezierCurveTo(9, -10, 12, 1, 0, 9); c.closePath(); c.stroke();
    },
    // Рассудок - полумесяц
    sanity(c) {
        c.beginPath(); c.arc(0, 0, 9, Math.PI * 0.3, Math.PI * 1.7); c.bezierCurveTo(1, -6, 1, 6, 9 * Math.cos(Math.PI * 0.3), 9 * Math.sin(Math.PI * 0.3)); c.stroke();
        c.beginPath(); c.arc(7, -3, 1, 0, Math.PI * 2); c.fill();
    },
    // Уровень - звезда-роза ветров
    level(c) {
        c.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? 3.5 : 10; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.stroke();
    },
    // Персонажи - силуэт
    person(c) {
        c.beginPath(); c.arc(0, -4.5, 4.5, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(-9, 10); c.bezierCurveTo(-8, 2, 8, 2, 9, 10); c.stroke();
    },
    // Пустая страница - лист с загнутым углом и пером
    page(c) {
        c.beginPath(); c.moveTo(-7, -11); c.lineTo(3, -11); c.lineTo(8, -6); c.lineTo(8, 11); c.lineTo(-7, 11); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(3, -11); c.lineTo(3, -6); c.lineTo(8, -6); c.stroke();
        c.beginPath(); c.moveTo(-3, 0); c.lineTo(4, 0); c.moveTo(-3, 4); c.lineTo(4, 4); c.moveTo(-3, -4); c.lineTo(0, -4); c.stroke();
    },
    // Герб - геральдическая лилия
    crest(c) {
        c.beginPath(); c.moveTo(0, -11); c.bezierCurveTo(4, -6, 4, -1, 0, 3); c.bezierCurveTo(-4, -1, -4, -6, 0, -11); c.stroke();
        c.beginPath(); c.moveTo(-1, 1); c.bezierCurveTo(-5, -5, -11, -3, -9, 2); c.bezierCurveTo(-8, 4, -5, 4, -4, 2); c.stroke();
        c.beginPath(); c.moveTo(1, 1); c.bezierCurveTo(5, -5, 11, -3, 9, 2); c.bezierCurveTo(8, 4, 5, 4, 4, 2); c.stroke();
        c.beginPath(); c.moveTo(-6, 5); c.lineTo(6, 5); c.stroke();
        c.beginPath(); c.moveTo(0, 5); c.lineTo(0, 11); c.moveTo(-3, 11); c.lineTo(3, 11); c.stroke();
    },
    // запасной - ромб
    default(c) { c.beginPath(); c.moveTo(0, -9); c.lineTo(9, 0); c.lineTo(0, 9); c.lineTo(-9, 0); c.closePath(); c.stroke(); },
};

/**
 * Фаза луны: dark = 0 (полная, светлая) … 1 (новолуние, тёмная).
 * Для шкалы рассудка - чем ниже рассудок, тем темнее луна.
 */
function moon(ctx, cx, cy, r, dark, { line, shade, light }) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = light; ctx.fill();
    ctx.save(); ctx.clip();
    if (dark > 0) {
        // тень наползает справа налево
        ctx.beginPath(); ctx.arc(cx + 2 * r * (1 - dark), cy, r * 1.02, 0, Math.PI * 2); ctx.fillStyle = shade; ctx.fill();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = line; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
}

function icon(ctx, name, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    const k = size / 24;
    ctx.scale(k, k);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    (P[name] || P.default)(ctx);
    ctx.restore();
}

module.exports = { icon, moon, has: (name) => name in P };
