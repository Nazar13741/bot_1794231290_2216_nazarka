// Сборка сообщений на Components V2: контейнер с акцентной полосой, текстовые блоки,
// разделители (картинка с завитками или линия), кнопки и списки внутри контейнера.
// Все сообщения бота собираются через message() - стиль меняется здесь и везде сразу.
const path = require('node:path');
const fs = require('node:fs');
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    MediaGalleryBuilder, MediaGalleryItemBuilder, SectionBuilder, ThumbnailBuilder,
    AttachmentBuilder, MessageFlags,
} = require('discord.js');
const { config, ROOT } = require('../core/config');

const T = config.theme;
const COLORS = T.colors;
const hex = (c) => parseInt(c.replace('#', ''), 16);
const DIVIDER_FILE = path.join(ROOT, 'assets', 'profile', 'divider.png');
const DIVIDER_NAME = 'divider.png';
const DIVIDER = Symbol('divider');

// ── Блоки ─────────────────────────────────────────────────────────────
const text = (content) => ({ type: 'text', content: String(content ?? '').slice(0, 4000) });
/** Разделитель между разделами: картинка-виньетка (если включена) или линия */
const divider = () => DIVIDER;
/** Тонкая линия / отступ */
const line = (visible = true, large = false) => ({ type: 'sep', visible, large });
/** Картинка из вложения или ссылки */
const image = (url, description) => ({ type: 'image', url, description });
/** Текст с миниатюрой справа */
const section = (content, thumbnailUrl) => ({ type: 'section', content, thumbnailUrl });
/** Ряд кнопок или список (ActionRowBuilder) */
const row = (actionRow) => ({ type: 'row', row: actionRow });

function build(block, files) {
    if (block === DIVIDER) {
        if (T.dividerImage && fs.existsSync(DIVIDER_FILE)) {
            if (!files.some((f) => f.name === DIVIDER_NAME)) files.push(new AttachmentBuilder(DIVIDER_FILE, { name: DIVIDER_NAME }));
            return ['gallery', new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${DIVIDER_NAME}`))];
        }
        return ['sep', new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)];
    }
    switch (block.type) {
        case 'text': return ['text', new TextDisplayBuilder().setContent(block.content || '\u200b')];
        case 'sep': return ['sep', new SeparatorBuilder().setDivider(block.visible).setSpacing(block.large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)];
        case 'image': {
            const item = new MediaGalleryItemBuilder().setURL(block.url);
            if (block.description) item.setDescription(block.description.slice(0, 1024));
            return ['gallery', new MediaGalleryBuilder().addItems(item)];
        }
        case 'section': return ['section', new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content.slice(0, 4000)))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(block.thumbnailUrl))];
        case 'row': return ['row', block.row];
        default: throw new Error(`Неизвестный блок ${block.type}`);
    }
}

/**
 * Готовое сообщение.
 *   message({ blocks: [text('# Заголовок'), divider(), text('...')], accent: 'primary', files, ephemeral })
 * accent: 'primary' | 'accent' | 'muted' | 'danger'
 */
function message({ blocks = [], accent = 'primary', files = [], ephemeral = false, mentions = [] } = {}) {
    const out = [...files];
    const container = new ContainerBuilder().setAccentColor(hex(COLORS[accent] || COLORS.primary));
    for (const b of blocks.filter(Boolean)) {
        const [kind, comp] = build(b, out);
        if (kind === 'text') container.addTextDisplayComponents(comp);
        else if (kind === 'sep') container.addSeparatorComponents(comp);
        else if (kind === 'gallery') container.addMediaGalleryComponents(comp);
        else if (kind === 'section') container.addSectionComponents(comp);
        else if (kind === 'row') container.addActionRowComponents(comp);
    }
    let flags = MessageFlags.IsComponentsV2;
    if (ephemeral) flags |= MessageFlags.Ephemeral;
    return { components: [container], files: out, flags, allowedMentions: { users: mentions } };
}

/** Для interaction.update / editReply: без флага Ephemeral, старые вложения заменяются */
function forUpdate(payload) {
    return { ...payload, flags: MessageFlags.IsComponentsV2, attachments: [] };
}

/** Короткое уведомление: заголовок + текст */
function notice(title, body, { accent = 'primary', ephemeral = false, rows = [] } = {}) {
    return message({ accent, ephemeral, blocks: [text(`### ${title}${body ? `\n${body}` : ''}`), ...rows.map(row)] });
}

const error = (body) => notice('Ошибка', body, { accent: 'danger', ephemeral: true });
const success = (title, body, opts = {}) => notice(title, body, { accent: 'primary', ...opts });

/** Ответ ошибкой (сам выбирает reply / followUp / editReply) */
async function replyError(interaction, body) {
    const p = error(body);
    if (interaction.deferred && !interaction.replied) return interaction.editReply(forUpdate(p));
    if (interaction.replied) return interaction.followUp(p);
    return interaction.reply(p);
}

/** Текстовая шкала ▰▰▰▱▱ */
function bar(value, max, size = 12) {
    const filled = Math.max(0, Math.min(size, Math.round((value / Math.max(1, max)) * size)));
    return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));

module.exports = { message, forUpdate, notice, error, success, replyError, text, divider, line, image, section, row, bar, signed, colors: COLORS };
