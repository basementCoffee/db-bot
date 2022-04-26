const {verifyUrl, verifyPlaylist, linkFormatter} = require('../utils/utils');
const {SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, botID} = require('../utils/process/constants');
const {reactions} = require('../utils/reactions');
const {addToDatabase_P} = require('./database/add');

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
function runAddCommandWrapper_P (message, args, sheetName, printMsgToChannel, prefixString, server) {
  let playlistName;
  let keyName;
  let link;
  if (args.length === 3) {
    playlistName = args[0];
    keyName = args[1];
    link = args[2];
  } else if (args.length === 2) {
    keyName = args[0];
    link = args[1];
  } else {
    message.channel.send('*incorrect number of args provided*');
  }
  if (keyName) {
    if (link) {
      if (link.substring(0, 1) === '[' && link.substr(link.length - 1, 1) === ']') {
        link = link.substr(1, link.length - 2);
      }
      if (!verifyUrl(link) && !verifyPlaylist(link))
        return message.channel.send(`You can only add links to the keys list. (Names cannot be more than one word) \` Ex: ${prefixString}add [name] [link]\``);
      server.userKeys.set(sheetName, null);
      if (link.includes(SPOTIFY_BASE_LINK)) link = linkFormatter(link, SPOTIFY_BASE_LINK);
      else if (link.includes(SOUNDCLOUD_BASE_LINK)) link = linkFormatter(link, SOUNDCLOUD_BASE_LINK);
      addToDatabase_P(server, [keyName, link], message.channel, sheetName, printMsgToChannel, playlistName);
      return;
    } else if (message.member.voice?.channel && server.queue[0]) {
      link = server.queue[0].url;
      if (keyName.includes('.')) return message.channel.send('cannot add names with \'.\'');
      message.channel.send('Would you like to add what\'s currently playing as **' + (keyName) + '**?').then(sentMsg => {
        sentMsg.react(reactions.CHECK).then(() => sentMsg.react(reactions.X));
        const filter = (reaction, user) => {
          return botID !== user.id && [reactions.CHECK, reactions.X].includes(reaction.emoji.name) && message.member.id === user.id;
        };
        const collector = sentMsg.createReactionCollector(filter, {time: 60000, dispose: true});
        collector.once('collect', (reaction) => {
          sentMsg.delete();
          if (reaction.emoji.name === reactions.CHECK) {
            server.userKeys.set(sheetName, null);
            addToDatabase_P(server, [keyName, link], message.channel, sheetName, printMsgToChannel);
          } else {
            message.channel.send('*cancelled*');
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
  return message.channel.send('Could not add to ' + (prefixString === 'm' ? 'your' : 'the server\'s')
    + ' keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + prefixString + 'add [key] [link]\`)*');
}

module.exports = {runAddCommandWrapper, runAddCommandWrapper_P};