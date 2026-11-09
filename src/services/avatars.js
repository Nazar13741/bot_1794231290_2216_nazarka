// Сохраняет аватары персонажей на диск (ссылки Discord на вложения со временем «протухают»).
const fs = require('node:fs');
const path = require('node:path');
const { config, ROOT } = require('../core/config');

const DIR = path.join(ROOT, 'data', 'avatars');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Скачивает картинку по ссылке и сохраняет. Возвращает имя файла. */
async function saveFromUrl(characterId, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Не удалось скачать изображение (HTTP ${res.status}).`);
    const type = (res.headers.get('content-type') || '').split(';')[0];
    if (!EXT[type]) throw new Error('Аватар должен быть картинкой PNG, JPG, WEBP или GIF.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > config.characters.maxAvatarSizeMb * 1024 * 1024) {
        throw new Error(`Аватар больше ${config.characters.maxAvatarSizeMb} МБ.`);
    }
    fs.mkdirSync(DIR, { recursive: true });
    remove(characterId);
    const file = `${characterId}.${EXT[type]}`;
    fs.writeFileSync(path.join(DIR, file), buf);
    return file;
}

function filePath(file) { return file ? path.join(DIR, file) : null; }

function remove(characterId) {
    if (!fs.existsSync(DIR)) return;
    for (const f of fs.readdirSync(DIR)) if (f.startsWith(`${characterId}.`)) fs.unlinkSync(path.join(DIR, f));
}

module.exports = { saveFromUrl, filePath, remove };
