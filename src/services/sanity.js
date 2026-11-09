// Рассудок / стресс: пороги, штрафы к броскам, временное безумие.
const { config } = require('../core/config');
const characters = require('./characters');

const SN = config.sanity;

function state(value) {
    return SN.states.find((s) => value >= s.min) || SN.states[SN.states.length - 1];
}

function activeMadness(ch) {
    return ch.madness && ch.madness_until && ch.madness_until > Date.now() ? { effect: ch.madness, until: ch.madness_until } : null;
}

/** Общий штраф к броскам от рассудка и приступа безумия */
function rollPenalty(ch) {
    return state(ch.sanity).penalty + (activeMadness(ch) ? SN.madness.extraPenalty : 0);
}

/** Поля для записи нового значения рассудка (+ приступ, если опустился ниже порога) */
function fieldsFor(ch, value) {
    const before = ch.sanity;
    const after = Math.max(0, Math.min(SN.max, value));
    const fields = { sanity: after };
    let madness = null;
    const M = SN.madness;
    if (M.enabled && after < before && after < M.triggerBelow && !activeMadness(ch)) {
        const effect = M.effects.length ? M.effects[Math.floor(Math.random() * M.effects.length)] : 'Временное безумие';
        madness = { effect, until: Date.now() + M.durationMinutes * 60000 };
        fields.madness = madness.effect;
        fields.madness_until = madness.until;
    }
    return { fields, before, after, madness };
}

function cure(ch) { return characters.update(ch.id, { madness: null, madness_until: null }); }

module.exports = { state, activeMadness, rollPenalty, fieldsFor, cure };
