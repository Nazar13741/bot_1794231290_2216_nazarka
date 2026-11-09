// Опыт и уровни.
const { config } = require('../core/config');
const characters = require('./characters');

const X = config.xp;

/** Опыт, нужный для перехода с уровня level на следующий */
function xpToNext(level) { return Math.round(X.levelBase * Math.pow(level, X.levelExponent)); }

/** Добавляет опыт (отрицательный - уменьшает, не ниже 0). Возвращает { character, levelsGained } */
function addXp(character, amount) {
    let { level, xp } = character;
    xp = Math.max(0, xp + amount);
    let levelsGained = 0;
    while (level < X.maxLevel && xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level++;
        levelsGained++;
    }
    if (level >= X.maxLevel) xp = Math.min(xp, xpToNext(level));
    return { character: characters.update(character.id, { level, xp }), levelsGained };
}

module.exports = { xpToNext, addXp };
