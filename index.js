/**
 * 
 */

import 'dotenv/config';
import { Events, GatewayIntentBits, Client, Partials, InteractionCollector } from 'discord.js';

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

client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const categories = member.guild.channels.cache.filter((val) => val.type === 4);

        for (const category of categories) {
            await category.permissionOverwrites.edit(member.id, {
                'ViewChannel': false
            }, { type: 1 })

        }

    } catch (err) {
        console.error('Error Occured:', err);
    }
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if (!newMember.roles.has('1207551772571213885')) {
        // TODO: Finish
    }
});

client.login(TOKEN);