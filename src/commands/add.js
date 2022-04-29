const {botID, MAX_KEY_LENGTH} = require('../utils/process/constants');
const {reactions} = require('../utils/reactions');
const {addToDatabase_P} = require('./database/add');
const {universalLinkFormatter, linkValidator} = require('../utils/utils');
const {getXdb2} = require('./database/retrieval');

/**
 * Wrapper for the function 'addToDatabase', for the purpose of error checking.
 * @param message The message that triggered the bot
 * @param args The args that of the message contents
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param prefixString The prefix string
 * @param server The server.
 * @returns {*}
 */
function runAddCommandWrapper (message, args, sheetName, printMsgToChannel, prefixString, server) {
  throw Error('INCORRECT COMMAND USED');
}

// create a string that warns the user that the itemName of type 'type' is exceeding a maximum length.
function lengthErrorString (type, itemName, maxLength) {
  return `*error: ${type}-name **${itemName}** exceeds max character limit of ${maxLength}*`;
}

async function addNewPlaylist (server, channel, sheetName, playlistName) {
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
 * @param args The args that of the message contents
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param prefixString The prefix string
 * @param server The server.
 * @param member The member that is requesting the add.
 * @returns {*}
 */
async function runAddCommandWrapper_P (channel, args, sheetName, printMsgToChannel, prefixString, server, member) {
  let playlistName;
  let keyName;
  let link;
  let xdb;
  if (args.length === 3) {
    playlistName = args[0];
    keyName = args[1];
    link = args[2];
    xdb = await getXdb2(server, sheetName, false);
    if (!xdb.playlists.get(playlistName.toUpperCase())) {
      channel.send(`*playlist **${playlistName}** does not exist: add a new playlist using the \`add-playlist\` command*`);
      return;
    }
  } else if (args.length === 2) {
    keyName = args[0];
    link = args[1];
  } else if (args.length === 0){

  }
  else {
    channel.send('*incorrect number of args provided*');
    return;
  }
  if (keyName.length > MAX_KEY_LENGTH) {
    channel.send(lengthErrorString('key', keyName, MAX_KEY_LENGTH));
    return;
  }
  if (keyName) {
    if (link) {
      link = universalLinkFormatter(link);
      if (linkValidator(server, channel, link, prefixString, true)) {
        server.userKeys.set(sheetName, null);
        addToDatabase_P(server, [keyName, link], channel, sheetName, printMsgToChannel, playlistName, xdb);
      }
      return;
    } else if (member.voice?.channel && server.queue[0]) {
      link = server.queue[0].url;
      if (keyName.includes('.')) return channel.send('cannot add names with \'.\'');
      channel.send('Would you like to add what\'s currently playing as **' + (keyName) + '**?').then(sentMsg => {
        sentMsg.react(reactions.CHECK).then(() => sentMsg.react(reactions.X));
        const filter = (reaction, user) => {
          return botID !== user.id && [reactions.CHECK, reactions.X].includes(reaction.emoji.name) && member.id === user.id;
        };
        const collector = sentMsg.createReactionCollector(filter, {time: 60000, dispose: true});
        collector.once('collect', (reaction) => {
          sentMsg.delete();
          if (reaction.emoji.name === reactions.CHECK) {
            server.userKeys.set(sheetName, null);
            addToDatabase_P(server, [keyName, link], channel, sheetName, printMsgToChannel, playlistName, xdb);
          } else {
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
  }
  return channel.send('Could not add to ' + (prefixString === 'm' ? 'your' : 'the server\'s')
    + ' keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + prefixString + 'add [key] [link]\`)*');
}

module.exports = {runAddCommandWrapper, runAddCommandWrapper_P, addNewPlaylist};