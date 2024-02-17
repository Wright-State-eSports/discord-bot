/**
 * 
 */

import 'dotenv/config';
import { Events, GatewayIntentBits, Client, Partials, InteractionCollector } from 'discord.js';
import ids from './data/ids.json';

const TOKEN = process.env._TOKEN_SECRET;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.once(Events.ClientReady, ready => {
    console.log(`Logged in as ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    const categories = interaction.member.guild.channels.cache.filter((val) => val.type === 4 && ids['categories'].contains(val.id));

    console.log(categories);
})

client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const categories = member.guild.channels.cache.filter((val) => val.type === 4 && ids['categories'].includes(val.id));

        for (const category of categories) {
            await category.permissionOverwrites.edit(member.id, {
                'ViewChannel': false
            }, { type: 1 })
        }

    } catch (err) {
        console.error('Error Occured:', err);
    }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {

    if (!newMember.roles.has(ids['roles']['not-signed-up'])) {
        const categories = member.guild.channels.cache.filter((val) => val.type === 4 && ids['categories'].includes(val.id));

        for (const category of categories)
            await category.permissionOverwrites.delete(newMember.id);

    }
});

client.login(TOKEN);