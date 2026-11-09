// Список разделов в /menu
const ui = require('../ui/components');

module.exports = {
    id: 'menu',
    async execute(interaction) {
        const { view } = require('../commands/menu');
        const v = interaction.values[0];
        return interaction.update(ui.forUpdate(view(interaction.client, interaction.member, v === '_home' ? null : v)));
    },
};
