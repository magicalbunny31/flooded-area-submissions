import Discord from "discord.js";
import fetch from "node-fetch";
import dayjs from "dayjs";

import { readFile } from "fs/promises";
const pkg = JSON.parse(await readFile(`./package.json`));

import { colours, strip } from "@magicalbunny31/awesome-utility-stuff";

/**
 * @param {Discord.Message} message
 * @param {string[]} args
 */
export default async (message, args) => {
   // command arguments
   const [ player, timeToBanInSeconds ] = args;
   const reason = message.content
      .slice((message.content.indexOf(` ${timeToBanInSeconds} `) !== -1 ? message.content.indexOf(` ${timeToBanInSeconds} `) : message.content.lastIndexOf(` ${timeToBanInSeconds}`)) + (timeToBanInSeconds?.length || 0) + 2)
      .trim();


   // missing arguments
   const prefixRegexp = new RegExp(`^(<@!?${message.client.user.id}>|;)\\s*`);
   const [ _, matchedPrefix ] = message.content.toLowerCase().match(prefixRegexp);

   if (!player || !timeToBanInSeconds)
      return await message.reply({
         content: strip`
            🗯️ **Missing ${
               (() => {
                  const list = [
                     ...!player             ? [ `__\`player\`__` ] : [],
                     ...!timeToBanInSeconds ? [ `__\`time\`__` ]   : []
                  ];
                  return list
                     .concat(
                        list.splice(-2, 2).join(` and `)
                     )
                     .join(`, `);
               })()
            } ${(!player && !timeToBanInSeconds) ? `arguments` : `argument`}.**
            > **${matchedPrefix === `;` ? matchedPrefix : `${matchedPrefix} `}tempban** ${!player ? `__\`player\`__` : `\`player\``} ${!timeToBanInSeconds ? `__\`time\`__` : `\`time\``} (\`reason\`)
         `,
         allowedMentions: {
            repliedUser: false
         }
      });


   // time to ban in seconds isn't a number
   if (isNaN(+timeToBanInSeconds))
      return await message.reply({
         content: strip`
            🗯️ **__time__ argument \`${timeToBanInSeconds}\` not a number.**
            > It must be a natural number consisting of *only* numbers.
         `,
         allowedMentions: {
            repliedUser: false
         }
      });


   // time to ban in seconds is too large
   if (BigInt(timeToBanInSeconds) > BigInt(Number.MAX_SAFE_INTEGER))
      return await message.reply({
         content: strip`
            🗯️ **__time__ argument \`${timeToBanInSeconds}\` too large.**
            > It must be a natural number less than or equal to \`${Number.MAX_SAFE_INTEGER.toLocaleString()}\`.
         `,
         allowedMentions: {
            repliedUser: false
         }
      });


   // time to ban in seconds is less than or equal to 0
   if (+timeToBanInSeconds <= 0)
      return await message.reply({
         content: strip`
            🗯️ **__time__ argument \`${timeToBanInSeconds}\` too small.**
            > It must be a natural number (greater than 0).
         `,
         allowedMentions: {
            repliedUser: false
         }
      });


   // user-agent for requests
   const userAgent = `${pkg.name}/${pkg.version} (${process.env.GITHUB})`;


   // get a user by user id
   // https://users.roblox.com/docs#!/Users
   const userByUserId = async id => {
      // this isn't a user id, can't get a player
      if (!+id)
         return null;

      // send a http get request
      const response = await fetch(`https://users.roblox.com/v1/users/${id}`, {
         headers: {
            "Accept": `application/json`,
            "User-Agent": userAgent
         }
      });

      // response is good, return its data
      if (response.ok)
         return await response.json();

      // something went wrong, return nothing
      else
         return null;
   };


   // get a user id by username
   // https://users.roblox.com/docs#!/Users
   const userIdByUsername = await (async () => {
      // send a http post request
      const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
         method: `POST`,
         headers: {
            "Accept": `application/json`,
            "Content-Type": `application/json`,
            "User-Agent": userAgent
         },
         body: JSON.stringify({
            usernames: [ player ]
         })
      });

      // something went wrong, return nothing
      if (!response.ok)
         return null;

      // response is good, return its data (or undefined if no user exists with this username)
      const { data } = await response.json();
      return data[0]?.id;
   })();


   // get player(s) based on command arguments
   const userFromUserId   = await userByUserId(player);
   const userFromUsername = await userByUserId(userIdByUsername);


   // inputted player doesn't exist
   if (!userFromUserId && !userFromUsername)
      return await message.reply({
         content: strip`
            ❌ **A player doesn't exist with \`${player}\` as a username nor id.**
            > If this player *does* exist, Roblox might currently be having an outage.
            > ${Discord.hideLinkEmbed(`https://status.roblox.com`)}
         `,
         allowedMentions: {
            repliedUser: false
         }
      });


   // function to send a moderation
   const sendModeration = async (player, interaction) => {
      // get a user's avatar bust by user id
      // https://thumbnails.roblox.com/docs/index.html#!/
      const avatarBustByUserId = await (async () => {
         // send a http get request
         const response = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${player.id}&size=420x420&format=Png&isCircular=false`, {
            headers: {
               "Accept": `application/json`,
               "User-Agent": userAgent
            }
         });

         // response is good, return its data
         if (response.ok)
            return (await response.json()).data[0].imageUrl;

         // something went wrong, return nothing
         else
            return null;
      })();


      // formatted humanised time
      const formattedDuration = (() => {
         const format = [];
         const duration = dayjs.duration(+timeToBanInSeconds, `seconds`);

         const days = (duration.years() * 365) + (duration.months() * 30) + duration.days();

         if (duration.asDays()    >= 1) format.push(`${days} ${days === 1 ? `day` : `days`}`);
         if (duration.asHours()   >= 1) format.push(`${duration.hours()} ${duration.hours() === 1 ? `hour` : `hours`}`);
         if (duration.asMinutes() >= 1) format.push(`${duration.minutes()} ${duration.minutes() === 1 ? `minute` : `minutes`}`);
         if (duration.asSeconds() >= 1) format.push(`${duration.seconds()} ${duration.seconds() === 1 ? `second` : `seconds`}`);

         return format.join(`, `);
      })();


      // reply to the command
      const payload = {
         content: `📥 **Sending temporary ban...**`,
         embeds: [
            new Discord.EmbedBuilder()
               .setColor(colours.flooded_area)
               .setAuthor({
                  name: userByUserId
                     ? `${player.displayName} (@${player.name})`
                     : `A Player with the id \`${player.id}\``,
                  url: `https://www.roblox.com/users/${player.id}/profile`,
                  iconURL: avatarBustByUserId
               })
               .setDescription(strip`
                  **\`reason\`** : ${reason ? `\`${reason}\`` : ``}
                  **\`length\`** : \`${formattedDuration}\`
               `)
         ],
         components: [],
         allowedMentions: {
            repliedUser: false
         }
      };

      const commandReply = await (async () => {
         if (!interaction)
            return await message.reply(payload);

         else {
            await interaction.update(payload);
            return await interaction.fetchReply();
         };
      })();


      // push this ban to the moderations array
      message.client.moderations.push({
         method: `Ban`,               // what action the server will take on this player (ban them)
         reason,                      // the reason to display to the player on kick, if they are currently in a server (also displays on the moderation logs embed)
         length: +timeToBanInSeconds, // length in seconds to ban this player for

         value:       player.id,          // player (id)           to ban
         displayName: player.displayName, // player (display name) to ban
         username:    player.name,        // player (username)     to ban
         avatarBust:  avatarBustByUserId, // image url to player's avatar bust

         guild:   message.guild.id,   // this guild's id
         channel: message.channel.id, // this channel's id
         message: commandReply.id,    // this message's id

         moderator: message.author.id // the id of the moderator who sent this ban
      });


      /* this interaction will be edited once the lua server sends a request to this server~ */
   };


   // this could either be a username or a user id
   if (userFromUserId && userFromUsername) {
      // reply to the message
      const commandReply = await message.reply({
         content: `❓ **Is this a \`username\` or an \`id\`?**`,
         components: [
            new Discord.ActionRowBuilder()
               .setComponents(
                  new Discord.StringSelectMenuBuilder()
                     .setCustomId(`${message.id}:prompt-select-user`)
                     .setPlaceholder(`Select a player...`)
                     .setOptions(
                        new Discord.StringSelectMenuOptionBuilder()
                           .setLabel(`username`)
                           .setValue(`${userFromUserId.id}`)
                           .setDescription(`${userFromUserId.displayName} (@${userFromUserId.name}) : ${userFromUserId.id}`)
                           .setEmoji(`📛`),
                        new Discord.StringSelectMenuOptionBuilder()
                           .setLabel(`id`)
                           .setValue(`${userIdByUsername}`)
                           .setDescription(`${userFromUsername.displayName} (@${userFromUsername.name}) : ${userFromUsername.id}`)
                           .setEmoji(`🆔`)
                     )
               )
         ],
         allowedMentions: {
            repliedUser: false
         }
      });


      // listen for interactions
      const menu = message.channel.createMessageComponentCollector({
         filter: i => i.customId.startsWith(message.id),
         time: 300000 // 5 minutes
      });


      // select menu received
      menu.on(`collect`, async anySelectMenuInteraction => {
         // this isn't the user who used the command
         if (anySelectMenuInteraction.user.id !== message.author.id)
            return await anySelectMenuInteraction.reply({
               content: `❌ **Only ${message.author} can confirm who to temporarily ban.**`,
               ephemeral: true
            });

         // manually stop the menu
         menu.stop();

         // the selected value
         const [ selectedPlayerId ] = anySelectMenuInteraction.values;

         // send this player to be banned
         return await sendModeration(
            selectedPlayerId === player
               ? userFromUserId
               : userFromUsername,
            anySelectMenuInteraction
         );
      });


      // component collector ended
      menu.on(`end`, async (collected, reason) => {
         // the menu didn't time out
         if (reason !== `time`)
            return;

         // edit the command reply's message
         return await commandReply.edit({
            content: `❌ **Menu timed out.**`,
            components: []
         });
      });


      // don't continue
      return;
   };


   // send this player to be banned
   return await sendModeration(userFromUserId || userFromUsername);
};