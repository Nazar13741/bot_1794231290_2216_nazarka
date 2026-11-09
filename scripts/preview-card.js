// Предпросмотр карточки профиля без Discord: npm run preview → preview.png
//   npm run preview -- путь/к/арту.png   - со своим артом
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../src/core/config');

(async () => {
    const { renderProfileCard } = require('../src/ui/profileCard');
    const stats = Object.fromEntries(config.stats.list.map((s, i) => [s.key, [14, 12, 13, 10, 15, 9][i % 6]]));
    const base = { guild_id: '0', user_id: '0', race: 'Раса', class: 'Класс', level: 1, xp: 0, sanity: 100, free_points: 0, stats, is_active: false };
    const ch = { ...base, id: 1, name: 'Имя персонажа', level: 7, xp: 920, sanity: 52, is_active: true };
    const art = process.argv[2];
    if (art) {
        const dir = path.join(__dirname, '..', 'data', 'avatars');
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(art, path.join(dir, `1${path.extname(art)}`));
        ch.avatar_file = `1${path.extname(art)}`;
    }
    const second = { ...base, id: 2, name: 'Второй персонаж', level: 2 };
    const png = await renderProfileCard({ ch, characters: [ch, second], ownerName: 'username', guildName: 'Сервер' });
    fs.writeFileSync('preview.png', png);
    console.log('Готово: preview.png');
})();
