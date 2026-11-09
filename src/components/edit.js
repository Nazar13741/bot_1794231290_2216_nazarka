// Панель редактирования /char redact (админы и кураторы).
//   кнопки: edit:<раздел>:<id>   формы: editm:<раздел>:<id>
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { config } = require('../core/config');
const ui = require('../ui/components');
const characters = require('../services/characters');
const sanity = require('../services/sanity');
const reputation = require('../services/reputation');
const avatars = require('../services/avatars');
const logger = require('../core/logger');
const { isCurator } = require('../core/permissions');
const { statsText } = require('../ui/profileView');

const log = logger.child('Редактор');

// Форма Discord вмещает до 5 полей - длинные списки делим на части
const chunks = (list) => { const out = []; for (let i = 0; i < list.length; i += 5) out.push(list.slice(i, i + 5)); return out; };
const statChunks = () => chunks(config.stats.list);
const repChunks = () => chunks(reputation.factions());

function panel(ch, note = '') {
    const mad = sanity.activeMadness(ch);
    const rep = reputation.list(ch.id).map((r) => `${r.faction.name}: ${ui.signed(r.value)}`).join(' · ');
    const b = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(`edit:${id}:${ch.id}`).setLabel(label).setStyle(style);
    const label = (base, i, n) => (n > 1 ? `${base} ${i + 1}` : base);
    const extra = [
        ...statChunks().map((_, i, a) => b(`stats${i}`, label('Характеристики', i, a.length))),
        ...repChunks().map((_, i, a) => b(`rep${i}`, label('Репутация', i, a.length))),
    ];
    const rows = [
            new ActionRowBuilder().addComponents(b('basic', 'Основное'), b('story', 'Описание'), b('avatar', 'Аватар'), b('progress', 'Прогресс')),
        ...chunks(extra).map((c) => new ActionRowBuilder().addComponents(c)),
        new ActionRowBuilder().addComponents(...(mad ? [b('cure', 'Снять безумие')] : []), b('delete', 'Удалить', ButtonStyle.Danger)),
    ];
    return ui.message({
        accent: 'muted', ephemeral: true,
        blocks: [
            ui.text(`### Редактирование · ${ch.name} (ID ${ch.id})\n**${ch.race}** · **${ch.class}** · уровень ${ch.level} · опыт ${ch.xp}\n` +
                `Владелец: <@${ch.user_id}> · рассудок ${ch.sanity}${mad ? ' · безумие' : ''}`),
            ui.text(statsText(ch) + (rep ? `\n\n${rep}` : '')),
            note ? ui.text(`-# ${note}`) : null,
            ui.line(true),
            ...rows.map(ui.row),
        ],
    });
}

function field(id, label, value, { style = TextInputStyle.Short, required = false, max = 100 } = {}) {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(style).setRequired(required).setMaxLength(max);
    if (value !== null && value !== undefined && String(value) !== '') t.setValue(String(value).slice(0, max));
    return new ActionRowBuilder().addComponents(t);
}

function modalFor(section, ch) {
    const m = new ModalBuilder().setCustomId(`editm:${section}:${ch.id}`);
    if (section === 'basic') {
        return m.setTitle('Основное').addComponents(
            field('name', 'Имя', ch.name, { required: true, max: 50 }),
            field('race', 'Раса', ch.race, { required: true, max: 40 }),
            field('class', 'Класс', ch.class, { required: true, max: 40 }),
            field('age', 'Возраст', ch.age, { max: 30 }),
        );
    }
    if (section === 'story') {
        return m.setTitle('Описание').addComponents(
            field('description', 'Краткое описание', ch.description, { style: TextInputStyle.Paragraph, max: 1500 }),
            field('appearance', 'Внешность', ch.appearance, { style: TextInputStyle.Paragraph, max: 600 }),
        );
    }
    if (section === 'avatar') return m.setTitle('Аватар').addComponents(field('url', 'Ссылка на изображение (пусто = удалить)', '', { max: 500 }));
    if (section === 'progress') {
        return m.setTitle('Прогресс').addComponents(
            field('level', `Уровень (1–${config.xp.maxLevel})`, ch.level, { required: true, max: 3 }),
            field('xp', 'Опыт в текущем уровне', ch.xp, { required: true, max: 7 }),
            field('sanity', `Рассудок (0–${config.sanity.max})`, ch.sanity, { required: true, max: 3 }),
            field('user_id', 'ID владельца (передача персонажа)', ch.user_id, { required: true, max: 20 }),
        );
    }
    if (section.startsWith('stats')) {
        const chunk = statChunks()[Number(section.slice(5))];
        if (chunk) return m.setTitle('Характеристики').addComponents(...chunk.map((s) => field(s.key, `${s.name} (от ${config.stats.min}, без предела)`, ch.stats[s.key], { required: true, max: 9 })));
    }
    if (section.startsWith('rep')) {
        const chunk = repChunks()[Number(section.slice(3))];
        const cur = Object.fromEntries(reputation.list(ch.id).map((r) => [r.faction.key, r.value]));
        if (chunk) return m.setTitle('Репутация').addComponents(...chunk.map((f) => field(f.key, `${f.name} (${config.reputation.min}…${config.reputation.max})`, cur[f.key] ?? 0, { required: true, max: 4 })));
    }
    return null;
}

/** Целое число; max = null - без верхнего предела */
function int(value, min, max, label) {
    const n = Number(String(value).trim());
    const tooBig = max !== null && max !== undefined && n > max;
    if (!Number.isInteger(n) || n < min || tooBig) {
        throw new Error(max === null || max === undefined ? `«${label}»: целое число от ${min} и выше.` : `«${label}»: целое число от ${min} до ${max}.`);
    }
    return n;
}

/** Применяет форму. Возвращает { changes, diff } */
async function applyModal(section, ch, fields) {
    const v = (id) => fields.getTextInputValue(id)?.trim() || null;
    if (section === 'basic') return { changes: { name: v('name'), race: v('race'), class: v('class'), age: v('age') } };
    if (section === 'story') return { changes: { description: v('description'), appearance: v('appearance') } };
    if (section === 'avatar') {
        const url = v('url');
        if (!url) { avatars.remove(ch.id); return { changes: { avatar_file: null } }; }
        if (!/^https?:\/\//i.test(url)) throw new Error('Ссылка должна начинаться с http:// или https://');
        return { changes: { avatar_file: await avatars.saveFromUrl(ch.id, url) } };
    }
    if (section === 'progress') {
        const userId = v('user_id');
        if (!/^\d{17,20}$/.test(userId || '')) throw new Error('ID владельца - 17–20 цифр.');
        const s = sanity.fieldsFor(ch, int(v('sanity'), 0, config.sanity.max, 'Рассудок'));
        return {
            changes: {
                level: int(v('level'), 1, config.xp.maxLevel, 'Уровень'),
                xp: int(v('xp'), 0, 10_000_000, 'Опыт'),
                user_id: userId,
                ...s.fields,
            },
            madness: s.madness,
        };
    }
    if (section.startsWith('stats')) {
        const stats = { ...ch.stats };
        for (const st of statChunks()[Number(section.slice(5))]) stats[st.key] = int(v(st.key), config.stats.min, null, st.name);
        return { changes: { stats } };
    }
    if (section.startsWith('rep')) {
        const lines = [];
        for (const f of repChunks()[Number(section.slice(3))]) {
            const r = reputation.set(ch.id, f.key, int(v(f.key), config.reputation.min, config.reputation.max, f.name));
            if (r.before !== r.after) lines.push(`${f.name}: ${r.before} → ${r.after}`);
        }
        if (lines.length) logger.discord('reputation', { title: 'Репутация изменена', body: `**${ch.name}** (#${ch.id})\n${lines.join('\n')}` });
        return { changes: {}, diff: lines.join('\n') };
    }
    throw new Error('Неизвестный раздел.');
}

function describe(before, changes) {
    return Object.entries(changes).map(([k, val]) => {
        if (k === 'stats') return Object.keys(val).filter((s) => val[s] !== before.stats[s]).map((s) => `${s.toUpperCase()}: ${before.stats[s]} → ${val[s]}`).join('\n');
        if (k === 'madness' || k === 'madness_until') return '';
        if (String(before[k] ?? '') === String(val ?? '')) return '';
        const short = (x) => (x === null || x === undefined || x === '' ? '-' : String(x).slice(0, 80));
        return `${k}: ${short(before[k])} → ${short(val)}`;
    }).filter(Boolean).join('\n');
}

module.exports = {
    id: 'edit',
    aliases: ['editm'],
    panel,
    async execute(interaction, [section, charId]) {
        if (!isCurator(interaction.member)) return ui.replyError(interaction, 'Редактировать анкеты и характеристики могут только администраторы и кураторы.');
        const ch = characters.getById(charId);
        if (!ch) return ui.replyError(interaction, 'Персонаж не найден (возможно, удалён).');

        if (interaction.isModalSubmit()) {
            let res;
            try { res = await applyModal(section, ch, interaction.fields); } catch (e) { return ui.replyError(interaction, e.message); }
            const diff = [describe(ch, res.changes), res.diff].filter(Boolean).join('\n');
            if (res.changes.user_id && res.changes.user_id !== ch.user_id) res.changes.is_active = 0;
            const updated = characters.update(ch.id, res.changes);
            log.info(`${interaction.user.tag} изменил #${ch.id} (${section}): ${diff.replace(/\n/g, '; ') || 'без изменений'}`);
            if (diff && !section.startsWith('rep')) logger.discord('characters', { title: 'Анкета изменена', body: `<@${interaction.user.id}> → **${updated.name}** (#${ch.id})\n\`\`\`\n${diff.slice(0, 1800)}\n\`\`\`` });
            if (res.madness) logger.discord('sanity', { title: 'Временное безумие', accent: 'danger', body: `**${updated.name}** (#${ch.id}): ${res.madness.effect}` });
            const p = panel(updated, diff ? `Сохранено.${res.madness ? ' Начался приступ временного безумия.' : ''}` : 'Без изменений.');
            return interaction.isFromMessage() ? interaction.update(ui.forUpdate(p)) : interaction.reply(p);
        }

        if (section === 'cure') {
            const updated = sanity.cure(ch);
            logger.discord('sanity', { title: 'Безумие снято', body: `<@${interaction.user.id}> → **${ch.name}** (#${ch.id})` });
            return interaction.update(ui.forUpdate(panel(updated, 'Приступ безумия снят.')));
        }
        if (section === 'delete') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`edit:confirmdel:${ch.id}`).setLabel(`Удалить «${ch.name}»`.slice(0, 80)).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`edit:back:${ch.id}`).setLabel('Отмена').setStyle(ButtonStyle.Secondary),
            );
            return interaction.update(ui.forUpdate(ui.notice('Удаление анкеты', `Персонаж **${ch.name}** (ID ${ch.id}) будет удалён без возможности восстановления.`, { accent: 'danger', rows: [row] })));
        }
        if (section === 'back') return interaction.update(ui.forUpdate(panel(ch)));
        if (section === 'confirmdel') {
            characters.remove(ch);
            avatars.remove(ch.id);
            log.warn(`${interaction.user.tag} удалил персонажа #${ch.id} «${ch.name}» (владелец ${ch.user_id})`);
            logger.discord('characters', { title: 'Анкета удалена', accent: 'danger', body: `<@${interaction.user.id}> удалил **${ch.name}** (#${ch.id}), владелец <@${ch.user_id}>` });
            return interaction.update(ui.forUpdate(ui.success('Удалено', `Персонаж **${ch.name}** удалён.`)));
        }
        const modal = modalFor(section, ch);
        if (modal) return interaction.showModal(modal);
    },
};
