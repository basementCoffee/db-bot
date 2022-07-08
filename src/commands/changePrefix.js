const {gsrun, gsUpdateOverwrite, gsUpdateAdd} = require('./database/api/api');
const {PREFIX_SN} = require('../utils/process/constants');

/**
 * Changes the server's prefix.
 * @param message The message content metadata
 * @param server The server playback metadata
 * @param oldPrefix The old prefix.
 * @param newPrefix The new prefix.
 * @returns {*}
 */
function changePrefix(message, server, oldPrefix, newPrefix) {
  if (!message.member.permissions.has('KICK_MEMBERS')) {
    return message.channel.send('\`Permissions Error: Only members who can kick other members can change the prefix.\`');
  }
  if (!newPrefix) {
    return message.channel.send('\`No argument was given. Enter the new prefix after the command.\`');
  }
  if (newPrefix.length > 1) {
    return message.channel.send('\`Prefix length cannot be greater than 1.\`');
  }
  if (newPrefix === '+' || newPrefix === '=' || newPrefix === '\'') {
    return message.channel.send('Cannot have ' + newPrefix + ' as a prefix.');
  }
  if (newPrefix.toUpperCase() !== newPrefix.toLowerCase() || newPrefix.charCodeAt(0) > 126) {
    return message.channel.send('cannot have a letter as a prefix.');
  }
  message.channel.send('*changing prefix...*').then(async (prefixMsg) => {
    await gsrun('A', 'B', PREFIX_SN).then(async (xdb) => {
      let index = xdb.line.indexOf(message.guild.id);
      if (index === -1) {
        gsUpdateAdd(message.guild.id, oldPrefix, 'A', 'B', PREFIX_SN);
        return message.channel.send('\`There was an error - please try again or contact dev team\`');
      }
      index += 2;
      await gsUpdateOverwrite([message.guild.id, newPrefix], PREFIX_SN, 'A', index, 'B', index);
      gsrun('A', 'B', PREFIX_SN).then(async (xdb) => {
        server.prefix = xdb.congratsDatabase.get(message.guild.id);
        if (server.prefix === newPrefix) {
          prefixMsg.edit({content: `Prefix successfully changed to: ${server.prefix}`});
        } else {
          console.log(server.prefix);
          prefixMsg.edit({content: `\`There was an error - prefix is set to ${server.prefix}\``});
          return;
        }
        let name = 'db vibe';
        if (message.guild.me.nickname) {
          name = message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 1);
        }
        /**
         * Changes the prefix of the bot.
         */
        async function changeNamePrefix() {
          if (!message.guild.me.nickname) {
            await message.guild.me.setNickname('[' + newPrefix + '] ' + 'db vibe');
          } else if (message.guild.me.nickname.indexOf('[') > -1 && message.guild.me.nickname.indexOf(']') > -1) {
            await message.guild.me.setNickname('[' + newPrefix + '] ' + message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 2));
          } else {
            await message.guild.me.setNickname('[' + newPrefix + '] ' + message.guild.me.nickname);
          }
        }

        if (!message.guild.me.nickname || (message.guild.me.nickname.substring(0, 1) !== '[' &&
          message.guild.me.nickname.substr(2, 1) !== ']')) {
          message.channel.send('----------------------\nWould you like me to update my name to reflect this? (yes or no)\nFrom **' +
            (message.guild.me.nickname || 'db bot') + '**  -->  **[' + newPrefix + '] ' + name + '**').then(() => {
            const filter = (m) => message.author.id === m.author.id;
            message.channel.awaitMessages({filter, time: 30000, max: 1, errors: ['time']})
              .then(async (messages) => {
                // message.channel.send(`You've entered: ${messages.first().content}`);
                if (messages.first().content.toLowerCase() === 'yes' || messages.first().content.toLowerCase() === 'y') {
                  await changeNamePrefix();
                  message.channel.send('name has been updated, prefix is: ' + newPrefix);
                } else {
                  message.channel.send('ok, prefix is: ' + newPrefix);
                }
              })
              .catch(() => {
                message.channel.send('prefix is now: ' + newPrefix);
              });
          });
        } else if (message.guild.me.nickname.substring(0, 1) === '[' && message.guild.me.nickname.substr(2, 1) === ']') {
          await changeNamePrefix();
        }
      });
    });
  });
}

module.exports = {changePrefix};
