const {botID} = require('../utils/lib/constants');
const {getHelpList} = require('../utils/help');
const {reactions} = require('../utils/lib/reactions');

/**
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server The server.
 * @param version {string} The version.
 */
function runHelpCommand(message, server, version) {
  server.numSinceLastEmbed += 10;
  const helpPages = getHelpList(server.prefix, 2, version);
  message.channel.send({embeds: [helpPages[0]]}).then((sentMsg) => {
    let currentHelp = 0;

    sentMsg.react(reactions.ARROW_R).then();
    const filter = (reaction, user) => {
      return user.id !== botID;
    };

    const collector = sentMsg.createReactionCollector({filter, time: 600000, dispose: true});
    collector.on('collect', (reaction, user) => {
      if (user.bot) return;
      if (reaction.emoji.name === reactions.ARROW_R) {
        sentMsg.edit({embeds: [helpPages[(++currentHelp % helpPages.length)]]});
      }
    });
    collector.on('remove', (reaction) => {
      if (reaction.emoji.name === reactions.ARROW_R) {
        sentMsg.edit({embeds: [helpPages[(++currentHelp % helpPages.length)]]});
      }
    });
    collector.on('end', () => {
      if (sentMsg.reactions) sentMsg.reactions.removeAll().then();
    });
  });
}

module.exports = {runHelpCommand};
