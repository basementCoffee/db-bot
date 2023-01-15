import { Message, MessageReaction, User } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { botID } from '../utils/lib/constants';
import { getHelpList } from '../utils/help';
import reactions from '../utils/lib/reactions';

/**
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server {LocalServer} The server.
 * @param version {string} The version.
 */
function runHelpCommand(message: Message, server: LocalServer, version: string) {
  server.numSinceLastEmbed += 10;
  const helpPages = getHelpList(server.prefix!, 2, version);
  helpPages[0].send(message.channel).then((sentMsg: Message) => {
    let currentHelp = 0;

    sentMsg.react(reactions.ARROW_R).then();
    const filter = (reaction: MessageReaction, user: User) => {
      return user.id !== botID;
    };

    const collector = sentMsg.createReactionCollector({ filter, time: 600000, dispose: true });
    collector.on('collect', (reaction: MessageReaction, user: User) => {
      if (user.bot) return;
      if (reaction.emoji.name === reactions.ARROW_R) {
        helpPages[++currentHelp % helpPages.length].edit(sentMsg);
      }
    });
    collector.on('remove', (reaction: MessageReaction) => {
      if (reaction.emoji.name === reactions.ARROW_R) {
        helpPages[++currentHelp % helpPages.length].edit(sentMsg);
      }
    });
    collector.on('end', () => {
      if (sentMsg.reactions) sentMsg.reactions.removeAll().then();
    });
  });
}

export { runHelpCommand };
