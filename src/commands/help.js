const {botID} = require('../utils/process/constants');
const {getHelpList} = require('../utils/help');

/**
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server The server.
 * @param version {string} The version.
 */
function runHelpCommand (message, server, version) {
  server.numSinceLastEmbed += 10;
  let helpPages = getHelpList(server.prefix, 2, version);
  message.channel.send(helpPages[0]).then((sentMsg) => {
    let currentHelp = 0;
    const hr = '➡️';
    sentMsg.react(hr).then();
    const filter = (reaction, user) => {
      return user.id !== botID;
    };

    const collector = sentMsg.createReactionCollector(filter, {time: 600000, dispose: true});
    collector.on('collect', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % helpPages.length)]);
      }
    });
    collector.on('remove', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % helpPages.length)]);
      }
    });
    collector.on('end', () => {
      if (sentMsg.reactions) sentMsg.reactions.removeAll().then();
    });
  });
}

module.exports = {runHelpCommand};
