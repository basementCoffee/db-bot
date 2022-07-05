const {botInVC, setSeamless, resetSession, pushQueue} = require('../../utils/utils');
const {bot, SPOTIFY_BASE_LINK, CORE_ADM} = require('../../utils/process/constants');
const {playLinkToVC} = require('./stream');
const {updateActiveEmbed, createEmbed} = require('../../utils/embed');
const {addLinkToQueue} = require('../../utils/playlist');
const {isCoreAdmin} = require('../../utils/permissions');

/**
 * Send a recommendation to a user. EXPERIMENTAL.
 * @param message The message metadata.
 * @param content Optional - text to add to the recommendation.
 * @param url The url to recommend.
 * @param uManager bot.users
 * @returns {Promise<void>}
 */
async function sendRecommendation(message, content, url, uManager) {
  if (!isCoreAdmin(message.member.id)) return;
  if (!url) return;
  try {
    const recUser = await uManager.fetch((message.member.id === CORE_ADM[0] ? CORE_ADM[1] : CORE_ADM[0]));
    // formatting for the content
    const desc = (content ? `:\n*${content}*` : '');
    await recUser.send({
      content: `**${message.member.user.username}** has a recommendation for you${desc}\n<${url}>`,
      embed: (await createEmbed(url)).embed,
    });
    message.channel.send(`*recommendation sent to ${recUser.username}*`);
  } catch (e) {
    console.log(e);
  }
}

/**
 * Plays a recommendation.
 * NOTE: Is in testing phase - allows only isCoreAdmin() usage.
 * @param message The message metadata.
 * @param server The server metadata.
 * @param args The message content in an array.
 * @returns {Promise<void>}
 */
async function playRecommendation(message, server, args) {
  if (!isCoreAdmin(message.member.id)) return;
  if (!message.member.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message)) {
      setSeamless(server, playRecommendation, [message, server, args], sentMsg);
    }
    return;
  }
  if (!botInVC(message)) resetSession(server);
  const user = await bot.users.fetch(message.member.id);
  const channel = await user.createDM();
  let num = parseInt(args[1]);
  let isRelevant = () => {}; // will be redefined
  if (num < 1) {
    message.channel.send('*provided number must be positive*');
    return;
  }
  if (num) isRelevant = () => num > 0;
  else {
    num = 0;
    // if the message was created in the last 48 hours
    isRelevant = (m) => Date.now() - m.createdTimestamp < 172800000;
  }
  // attempts to get a valid url from a regex.exec or message
  const getUrl = (res, m) => {
    if (res && res[1]) return res[1];
    else if (m.embeds.length > 0) {
      return m.embeds[0].url;
    }
    return undefined;
  };
  // links that should be forwarded by default (meet func criteria)
  const recs = [];
  // array of messages, the earliest message are in the front
  const messages = await channel.messages.fetch({limit: 99});
  const filterUrlArgs = (link) => {
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
  const isInQueue = (queue, link) => queue.some((val) => val.url === link);
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
      } else {
        isMore = true;
        break;
      }
    }
  }
  if (recs.length < 1) {
    if (isMore) {
      message.channel.send('***no new recommendations***, *provide a number to get a specific number of recs*');
    } else message.channel.send('*no more recommendations (the queue contains all of them)*');
    return;
  }
  const wasEmpty = !server.queue[0];
  for (const link of recs) {
    await addLinkToQueue(link, message, server, message.guild.id, false, pushQueue);
  }
  if (!botInVC(message) || wasEmpty) {
    playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
  } else {
    message.channel.send(`*added ${recs.length} recommendation${recs.length > 1 ? 's' : ''} to queue*`);
    updateActiveEmbed(server);
  }
}

module.exports = {playRecommendation, sendRecommendation};
