const {verifyUrl, verifyPlaylist, linkFormatter} = require('../utils/utils');
const {SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, botID} = require('../utils/process/constants');
const {reactions} = require('../utils/reactions');
const {hasDJPermissions} = require('../utils/permissions');
const {addToDatabase} = require('./database/add');

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
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  if (args[1]) {
    if (args[2]) {
      if (args[2].substring(0, 1) === '[' && args[2].substr(args[2].length - 1, 1) === ']') {
        args[2] = args[2].substr(1, args[2].length - 2);
      }
      if (!verifyUrl(args[2]) && !verifyPlaylist(args[2]))
        return message.channel.send(`You can only add links to the keys list. (Names cannot be more than one word) \` Ex: ${prefixString}add [name] [link]\``);
      server.userKeys.set(sheetName, null);
      if (args[2].includes(SPOTIFY_BASE_LINK)) args[2] = linkFormatter(args[2], SPOTIFY_BASE_LINK);
      else if (args[2].includes(SOUNDCLOUD_BASE_LINK)) args[2] = linkFormatter(args[2], SOUNDCLOUD_BASE_LINK);
      runAddCommand(server, args, message, sheetName, printMsgToChannel);
      return;
    } else if (message.member.voice?.channel && server.queue[0]) {
      args[2] = server.queue[0].url;
      if (args[1].includes('.')) return message.channel.send('cannot add names with \'.\'');
      message.channel.send('Would you like to add what\'s currently playing as **' + (args[1]) + '**?').then(sentMsg => {
        sentMsg.react(reactions.CHECK).then(() => sentMsg.react(reactions.X));
        const filter = (reaction, user) => {
          return botID !== user.id && [reactions.CHECK, reactions.X].includes(reaction.emoji.name) && message.member.id === user.id;
        };
        const collector = sentMsg.createReactionCollector(filter, {time: 60000, dispose: true});
        collector.once('collect', (reaction) => {
          sentMsg.delete();
          if (reaction.emoji.name === reactions.CHECK) {
            server.userKeys.set(sheetName, null);
            addToDatabase(server, args, message, sheetName, printMsgToChannel);
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
    + ' keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + prefixString +
    args[0].substr(prefixString ? 2 : 1).toLowerCase() + ' [key] [link]\`)*');
}

module.exports = {runAddCommandWrapper}