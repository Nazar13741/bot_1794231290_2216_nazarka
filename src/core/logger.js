// Логгер: цветная консоль + файлы в logs/ + отправка в Discord-каналы логов.
const fs = require('node:fs');
const path = require('node:path');
const { config, ROOT } = require('./config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';
const LOG_DIR = path.join(ROOT, 'logs');
const minLevel = LEVELS[config.logging.level] ?? LEVELS.info;

let discordClient = null;

if (config.logging.toFile) fs.mkdirSync(LOG_DIR, { recursive: true });

function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function format(arg) {
    if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
    if (typeof arg === 'object') { try { return JSON.stringify(arg); } catch { return String(arg); } }
    return String(arg);
}

function write(level, scope, args) {
    if (LEVELS[level] < minLevel) return;
    const text = args.map(format).join(' ');
    const line = `[${stamp()}] [${level.toUpperCase()}] [${scope}] ${text}`;
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    out(`${COLORS[level]}${line}${RESET}`);
    if (!config.logging.toFile) return;
    const day = stamp().slice(0, 10);
    fs.appendFile(path.join(LOG_DIR, `bot-${day}.log`), line + '\n', () => {});
    if (level === 'error') fs.appendFile(path.join(LOG_DIR, 'errors.log'), line + '\n', () => {});
}

/** Удаляет файлы логов старше logging.keepDays дней */
function cleanupOldLogs() {
    if (!config.logging.toFile) return;
    const limit = Date.now() - config.logging.keepDays * 86400000;
    for (const f of fs.readdirSync(LOG_DIR)) {
        const m = /^bot-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
        if (m && new Date(m[1]).getTime() < limit) fs.unlinkSync(path.join(LOG_DIR, f));
    }
}

/** Создаёт логгер с подписью: const log = logger.child('Персонажи') */
function child(scope) {
    return {
        debug: (...a) => write('debug', scope, a),
        info: (...a) => write('info', scope, a),
        warn: (...a) => write('warn', scope, a),
        error: (...a) => write('error', scope, a),
    };
}

function attachClient(client) { discordClient = client; }

/**
 * Запись в Discord-канал логов (Components V2).
 * category: 'characters' | 'xp' | 'sanity' | 'reputation' | 'errors' | другое → default
 */
async function discord(category, { title, body = '', accent = 'muted' }) {
    const channelId = config.logging.channels[category] || config.logging.channels.default;
    if (!discordClient || !channelId) return;
    try {
        const ui = require('../ui/components');
        const channel = await discordClient.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) return;
        const p = ui.message({ accent, blocks: [ui.text(`### ${title}\n${body}`.slice(0, 3900)), ui.text(`-# ${category} · <t:${Math.floor(Date.now() / 1000)}:f>`)] });
        await channel.send(p);
    } catch (e) {
        write('warn', 'Логгер', [`Не удалось отправить лог в Discord (${category}): ${e.message}`]);
    }
}

module.exports = { child, discord, attachClient, cleanupOldLogs, ...child('Бот') };
