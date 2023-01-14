import { botInVC, setSeamless, resetSession, pushQueue, verifyUrl } from '../../utils/utils';
import { bot, SPOTIFY_BASE_LINK, CORE_ADM } from '../../utils/lib/constants';
import { playLinkToVC } from './stream';
import { updateActiveEmbed, createEmbed } from '../../utils/embed';
import { addLinkToQueue } from '../../utils/playlist';
import { isCoreAdmin } from '../../utils/permissions';
import {Message} from "discord.js";
import LocalServer from "../../utils/lib/LocalServer";

/**
 * Sends a recommendation to a user. EXPERIMENTAL. This is a wrapper for sendRecommendation.
 * The args is expected to contain the message contents which includes a url and a message.
 * @param message The message metadata.
 * @param args The message contents in an array.
 * @param uManager bot.users
 * @param server {LocalServer} The server metadata.
 * @return {Promise<void>}
 */
async function sendRecommendationWrapper(message: Message, args: string[], uManager: any, server: LocalServer) {
  let url;
  let infos;
  if (args[1] && verifyUrl(args[1])) {
    url = args[1];
    args[1] = '';
  }
  else if (args.length > 2 && verifyUrl(args[args.length - 1])) {
    url = args[args.length - 1];
    args[args.length - 1] = '';
  }
  else {
    url = server.queue[0]?.url;
    infos = server.queue[0]?.infos;
  }
  sendRecommendation(message, args.join(' '), url, uManager, infos);
}

/**
 * Send a recommendation to a user. EXPERIMENTAL.
 * @param message {import('discord.js').Message} The message metadata.
 * @param content {string?} Optional - Text/description to add to the recommendation.
 * @param url {string} The url to recommend.
 * @param uManager bot.users
 * @param infos {Object?} Optional - The url infos data.
 * @returns {Promise<void>}
 */
async function sendRecommendation(message: Message, content = '', url: string, uManager: any, infos: any) {
  if (!isCoreAdmin(message.author.id)) return;
  if (!url) return;
  else url = url.trim();
  try {
    const recUser = await uManager.fetch((message.author.id === CORE_ADM[0] ? CORE_ADM[1] : CORE_ADM[0]));
    // formatting for the content
    const desc = (content.trim() ? `:\n*${content.trim()}*` : '');
    await recUser.send({
      content: `**${message.author.username}** has a recommendation for you${desc}\n\<${url}\>`,
      embeds: [(await createEmbed(url, infos)).embed.build()],
    });
    message.channel.send(`*recommendation sent to ${recUser.username}*`);
  }
  catch (e) {
    console.log(e);
  }
}

/**
 * Plays a recommendation.
 * NOTE: Is in testing phase - allows only isCoreAdmin() usage.
 * @param message The message metadata.
 * @param server {LocalServer} The server metadata.
 * @param args The message content in an array.
 * @returns {Promise<void>}
 */
async function playRecommendation(message: Message, server: LocalServer, args: string[]) {
  if (!isCoreAdmin(message.member!.id)) return;
  if (!message.member!.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message)) {
      setSeamless(server, playRecommendation, [message, server, args], sentMsg);
    }
    return;
  }
  if (!botInVC(message)) resetSession(server);
  const user = await bot.users.fetch(message.member!.id);
  const channel = await user.createDM();
  let num = parseInt(args[1]);
  // hot-swap function on whether a link is relevant/applicable
  let isRelevant = (m: Message) => {return false;};
  if (num < 1) {
    message.channel.send('*provided number must be positive*');
    return;
  }
  if (num) {isRelevant = (m: Message) => num > 0;}
  else {
    num = 0;
    // if the message was created in the last 48 hours
    isRelevant = (m: Message) => (Date.now() - m.createdTimestamp) < 172800000;
  }
  // attempts to get a valid url from a regex.exec or message
  const getUrl = (res: any, m: Message) => {
    if (res && res[1]) {return res[1];}
    else if (m.embeds.length > 0) {
      return m.embeds[0].url;
    }
    return undefined;
  };
  // links that should be forwarded by default (meet func criteria)
  const recs = [];
  // array of messages, the earliest message are in the front
  const messages = await channel.messages.fetch({ limit: 99 });
  const filterUrlArgs = (link: string) => {
    if (link.includes(SPOTIFY_BASE_LINK) && link.includes('?si=')) return link.split('?si=')[0];
    else return link;
  };
  // if there are more links available
  let isMore = false;
  /**
   * Determines if a link is within an array.
   * Expects the queue param to have a '.url' field.
   * @param queue {Array<Object>} The queue to check.
   * @param link {string} The link to filter.
   * @returns {Boolean} Returns true if the item exists within the queue.
   */
  const isInQueue = (queue: any[], link: string) => queue.some((val) => val.url === link);
  for (const [, m] of messages) {
    if (m.author.id !== bot.user.id) continue;
    const regex = /<(((?!discord).)*)>/g;
    const res = regex.exec(m.content);
    let url = getUrl(res, m);
    if (url) {
      url = filterUrlArgs(url);
      if (isInQueue(server.queue, url) || recs.slice(-1)[0] === url) continue;
      if (isRelevant(m)) {
        recs.push(url);
        num--;
      }
      else {
        isMore = true;
        break;
      }
    }
  }
  if (recs.length < 1) {
    if (isMore) {
      message.channel.send('***no new recommendations***, *provide a number to get a specific number of recs*');
    }
    else {message.channel.send('*no more recommendations (the queue contains all of them)*');}
    return;
  }
  const wasEmpty = !server.queue[0];
  for (const link of recs) {
    await addLinkToQueue(link, message, server, message.guild!.id, false, pushQueue);
  }
  if (!botInVC(message) || wasEmpty) {
    playLinkToVC(message, server.queue[0], message.member!.voice.channel, server);
  }
  else {
    message.channel.send(`*added ${recs.length} recommendation${recs.length > 1 ? 's' : ''} to queue*`);
    updateActiveEmbed(server);
  }
}

export { playRecommendation, sendRecommendationWrapper };
