const {gsrun, gsUpdateOverwrite} = require('./database/api/api');
const {runDeleteCommand} = require('./database/delete');
const {addToDatabase} = require('./database/add');

/**
 * Changes the server's prefix.
 * @param message
 * @param server
 * @param prefixString The old prefix.
 * @param newPrefix The new prefix.
 * @returns {*}
 */
function changePrefix (message, server, prefixString, newPrefix) {
  if (!message.member.hasPermission('KICK_MEMBERS')) {
    return message.channel.send('Permissions Error: Only members who can kick other members can change the prefix.');
  }
  if (!newPrefix) {
    return message.channel.send('No argument was given. Enter the new prefix after the command.');
  }
  if (newPrefix.length > 1) {
    return message.channel.send('Prefix length cannot be greater than 1.');
  }
  if (newPrefix === '+' || newPrefix === '=' || newPrefix === '\'') {
    return message.channel.send('Cannot have ' + newPrefix + ' as a prefix.');
  }
  if (newPrefix.toUpperCase() !== newPrefix.toLowerCase() || newPrefix.charCodeAt(0) > 126) {
    return message.channel.send("cannot have a letter as a prefix.");
  }
  newPrefix = message.guild.id;
  message.channel.send('*changing prefix...*').then(async sentPrefixMsg => {
    await gsrun('A', 'B', 'prefixes').then(async () => {
      await runDeleteCommand(message, newPrefix, 'prefixes', false);
      await addToDatabase(server, [null, message.guild.id, newPrefix], message, 'prefixes', false);
      await gsrun('A', 'B', 'prefixes').then(async (xdb) => {
        await gsUpdateOverwrite([xdb.congratsDatabase.size + 3], 'prefixes', xdb.dsInt);
        server.prefix = newPrefix;
        message.channel.send(`Prefix successfully changed to ${newPrefix}`);
        prefixString = ('\\' + newPrefix).substr(-1, 1);
        sentPrefixMsg.delete();
        let name = 'db bot';
        if (message.guild.me.nickname) {
          name = message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 1);
        }

        async function changeNamePrefix () {
          if (!message.guild.me.nickname) {
            await message.guild.me.setNickname('[' + prefixString + '] ' + "db bot");
          } else if (message.guild.me.nickname.indexOf('[') > -1 && message.guild.me.nickname.indexOf(']') > -1) {
            await message.guild.me.setNickname('[' + prefixString + '] ' + message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 2));
          } else {
            await message.guild.me.setNickname('[' + prefixString + '] ' + message.guild.me.nickname);
          }
        }

        if (!message.guild.me.nickname || (message.guild.me.nickname.substring(0, 1) !== '['
          && message.guild.me.nickname.substr(2, 1) !== ']')) {
          message.channel.send('----------------------\nWould you like me to update my name to reflect this? (yes or no)\nFrom **' +
            (message.guild.me.nickname || 'db bot') + '**  -->  **[' + prefixString + '] ' + name + '**').then(() => {
            const filter = m => message.author.id === m.author.id;

            message.channel.awaitMessages({filter, time: 30000, max: 1, errors: ['time']})
              .then(async messages => {
                // message.channel.send(`You've entered: ${messages.first().content}`);
                if (messages.first().content.toLowerCase() === 'yes' || messages.first().content.toLowerCase() === 'y') {
                  await changeNamePrefix();
                  message.channel.send('name has been updated, prefix is: ' + prefixString);
                } else {
                  message.channel.send('ok, prefix is: ' + prefixString);
                }
              })
              .catch(() => {
                message.channel.send('prefix is now: ' + prefixString);
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