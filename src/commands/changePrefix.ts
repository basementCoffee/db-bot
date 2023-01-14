import { gsrun, gsUpdateOverwrite, gsUpdateAdd } from '../database/api/api';
import { PREFIX_SN } from '../utils/lib/constants';
import { getBotDisplayName } from '../utils/utils';
import {Message, PermissionsBitField} from "discord.js";
import LocalServer from "../utils/lib/LocalServer";

/**
 * Changes the server's prefix.
 * @param message The message content metadata
 * @param server {LocalServer} The server playback metadata
 * @param oldPrefix The old prefix.
 * @param newPrefix The new prefix.
 * @returns {*}
 */
function changePrefix(message: Message, server: LocalServer, oldPrefix: string, newPrefix: string) {
  if (!message.member!.permissions.has(PermissionsBitField.Flags.KickMembers)) {
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
      let index = xdb.line.indexOf(message.guild!.id);
      if (index === -1) {
        gsUpdateAdd(message.guild!.id, oldPrefix, 'A', 'B', PREFIX_SN);
        return message.channel.send('\`There was an error - please try again or contact dev team\`');
      }
      index += 2;
      await gsUpdateOverwrite([message.guild!.id, newPrefix], PREFIX_SN, 'A', index, 'B', index);
      gsrun('A', 'B', PREFIX_SN).then(async (xdb2) => {
        server.prefix = xdb2.congratsDatabase.get(message.guild!.id);
        if (server.prefix === newPrefix) {
          prefixMsg.edit({ content: `Prefix successfully changed to: ${server.prefix}` });
        }
        else {
          console.log(server.prefix);
          prefixMsg.edit({ content: `\`There was an error - prefix is set to ${server.prefix}\`` });
          return;
        }
        let name = 'db vibe';
        const botObject = message.guild!.members.me!;
        if (!botObject) return;
        if (botObject.nickname) {
          name = botObject.nickname.substring(botObject.nickname.indexOf(']') + 1);
        }
        /**
         * Changes the prefix of the bot.
         */
        async function changeNamePrefix() {
          if (!botObject.nickname) {
            await botObject.setNickname('[' + newPrefix + '] ' + 'db vibe');
          }
          else if (botObject.nickname.indexOf('[') > -1 && botObject.nickname.indexOf(']') > -1) {
            await botObject.setNickname('[' + newPrefix + '] ' + botObject.nickname.substring(botObject.nickname.indexOf(']') + 2));
          }
          else {
            await botObject.setNickname('[' + newPrefix + '] ' + botObject.nickname);
          }
        }

        if (!botObject.nickname || (botObject.nickname.substring(0, 1) !== '[' &&
          botObject.nickname.substr(2, 1) !== ']')) {
          message.channel.send('----------------------\nShould I update my nickname to display this change? (yes or no)\nFrom **' +
            (getBotDisplayName(message.guild!)) + '**  -->  **[' + newPrefix + '] ' + name + '**').then(() => {
            const filter = (m: Message) => message.author.id === m.author.id;
            message.channel.awaitMessages({ filter, time: 30000, max: 1, errors: ['time'] })
              .then(async (messages) => {
                // message.channel.send(`You've entered: ${messages.first().content}`);
                if (messages.first() && (messages.first()!.content.toLowerCase() === 'yes' || messages.first()!.content.toLowerCase() === 'y')) {
                  await changeNamePrefix();
                  message.channel.send('nickname has been updated');
                }
                else {
                  message.channel.send('nickname will remain the same');
                }
              })
              .catch(() => {
                message.channel.send('prefix is now: ' + newPrefix);
              });
          });
        }
        else if (botObject.nickname.substring(0, 1) === '[' && botObject.nickname.substr(2, 1) === ']') {
          await changeNamePrefix();
        }
      });
    });
  });
}

export { changePrefix };
