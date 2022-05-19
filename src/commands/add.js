const {botID, MAX_KEY_LENGTH} = require('../utils/process/constants');
const {reactions} = require('../utils/reactions');
const {addToDatabase_P} = require('./database/add');
const {universalLinkFormatter, linkValidator} = require('../utils/utils');
const {getXdb2} = require('./database/retrieval');

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
 * @param args The arguments provided to the command
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param server The server.
 * @param member The member that is requesting the add.
 * @returns {*}
 */
async function runAddCommandWrapper_P (channel, args, sheetName, printMsgToChannel, server, member) {
  let playlistName;
  let keyName = args[0];
  let link = args[1];
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
      } else {
        channel.send(`You can only add links to the keys list. (Names cannot be more than one word) \` Ex: ${server.prefix || ''}add [name] [link]\``);
      }
      return;
    } else if (member.voice?.channel && server.queue[0]) {
      link = server.queue[0].url;
      if (keyName.includes('.') || keyName.includes(',')) return channel.send('cannot add names with \'.\' or \',\'');
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
  if (member.voice?.channel && server.queue[0]) channel.send('*error: expected a key-name to add*');
  else channel.send('Could not add to your keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + 'add [key] [link]\`)*');
}

module.exports = {runAddCommandWrapper_P, addNewPlaylist};