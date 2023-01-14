/* eslint-disable camelcase */
import LocalServer from "../utils/lib/LocalServer";
import {GuildMember, MessageReaction, TextChannel, User} from "discord.js";
import { botID, MAX_KEY_LENGTH } from'../utils/lib/constants';
import reactions from'../utils/lib/reactions';
import { addToDatabase_P } from'../database/add';
import { linkValidator } from'../utils/utils';
import { getXdb2 } from'../database/retrieval';
import { universalLinkFormatter } from'../utils/formatUtils';


/**
 * create a string that warns the user that the itemName of type 'type' is exceeding a maximum length.
 * @param {*} type {string} The type of error.
 * @param {*} itemName {string} The name of the item that is exceeding the maximum length.
 * @param {*} maxLength {string} The maximum length allowed.
 * @returns {string}
 */
function lengthErrorString(type: any, itemName: any, maxLength: any): string {
  return `*error: ${type}-name **${itemName}** exceeds max character limit of ${maxLength}*`;
}

/**
 * Adds a custom playlist to the database.
 * @param {*} server The server.
 * @param {*} channel The channel to send the response to.
 * @param {*} sheetName The name of the sheet to add to.
 * @param {*} playlistName The name of the playlist to add.
 * @returns {void}
 */
async function addCustomPlaylist(server: LocalServer, channel: TextChannel, sheetName: string, playlistName: string) {
  if (playlistName.length > MAX_KEY_LENGTH) {
    channel.send(lengthErrorString('playlist', playlistName, MAX_KEY_LENGTH));
    return;
  }
  const xdb = await getXdb2(server, sheetName, false);
  if (xdb.playlists.get(playlistName.toUpperCase())) {
    channel.send(`*playlist **${playlistName}** already exists*`);
    return;
  }
  await addToDatabase_P(server, [], channel, sheetName, false, playlistName);
  channel.send(`*added **${playlistName}** as a playlist*`);
}

/**
 * Wrapper for the function 'addToDatabase', for the purpose of error checking. Expects the provided playlist to exist.
 * @param channel The channel that triggered the bot
 * @param args {Array<string>} [playlist-name (optional), key-name, link]
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param server {LocalServer} The server.
 * @param member The member that is requesting the add.
 * @returns {*}
 */
async function runAddCommandWrapper(channel: TextChannel, args: string[], sheetName: string, printMsgToChannel: boolean, server: LocalServer, member: GuildMember) {
  let playlistName: string | undefined;
  let keyName = args[0];
  let link = args[1];
  let xdb: any;
  if (args.length === 3) {
    playlistName = args[0];
    keyName = args[1];
    link = args[2];
    xdb = await getXdb2(server, sheetName, false);
    if (!xdb.playlists.get(playlistName.toUpperCase())) {
      // eslint-disable-next-line max-len
      const doesNotExist = `*playlist **${playlistName}** does not exist: add a new playlist using the \`add-playlist\` command*`;
      channel.send(doesNotExist);
      return;
    }
  }
  if (keyName) {
    if (keyName.length > MAX_KEY_LENGTH) {
      channel.send(lengthErrorString('key', keyName, MAX_KEY_LENGTH));
      return;
    }
    if (link) {
      link = universalLinkFormatter(link);
      if (linkValidator(link)) {
        server.userKeys.set(sheetName, null);
        addToDatabase_P(server, [keyName, link], channel, sheetName, printMsgToChannel, playlistName, xdb);
        return;
      }
      xdb = await getXdb2(server, sheetName, false);
      const playlistArray = Array.from(xdb.playlists.keys());
      if (playlistArray.includes(link.toUpperCase())) {
        playlistName = link;
      }
      else if (playlistArray.includes(keyName.toUpperCase())) {
        playlistName = keyName;
        keyName = link;
      }
    }
    if (member.voice?.channel && server.queue[0]) {
      link = server.queue[0].url;
      if (keyName.includes('.') || keyName.includes(',')) return channel.send('cannot add names with \'.\' or \',\'');
      channel.send(`Would you like to add what's currently playing as **${keyName}**? ${playlistName ? `*[to ${playlistName}]*` : ''}`).then((sentMsg) => {
        sentMsg.react(reactions.CHECK).then(() => sentMsg.react(reactions.X));
        const filter = (reaction: MessageReaction, user: User) => {
          return botID !== user.id &&
          [reactions.CHECK, reactions.X].includes(reaction.emoji.name!) && member.id === user.id;
        };
        const collector = sentMsg.createReactionCollector({ filter, time: 60000, dispose: true });
        collector.once('collect', (reaction) => {
          sentMsg.delete();
          if (reaction.emoji.name === reactions.CHECK) {
            server.userKeys.set(sheetName, null);
            addToDatabase_P(server, [keyName, link], channel, sheetName, printMsgToChannel, playlistName, xdb);
          }
          else {
            channel.send('*cancelled*');
          }
        });
        collector.on('end', () => {
          if (sentMsg.deletable && sentMsg.reactions) {
            sentMsg.reactions.removeAll().then(() => sentMsg.edit('*cancelled*'));
          }
        });
      });
      return;
    }
    else {
      channel.send(`You can only add links to the keys list. (Names cannot be more than one word) \` Ex: ${server.prefix || ''}add [name] [link]\``);
      return;
    }
  }
  if (member.voice?.channel && server.queue[0]) channel.send('*error: expected a key-name to add*');
  else channel.send('Could not add to your keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + 'add [key] [link]\`)*');
}

export { runAddCommandWrapper, addCustomPlaylist };
