const {getData} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const ytdl = require('ytdl-core-discord');

let bot;

/**
 * Given a duration in ms, it returns a formatted string separating
 * the hours, minutes, and seconds.
 * @param duration a duration in milliseconds
 * @returns {string} a formatted string duration
 */
function formatDuration (duration) {
  const seconds = duration / 1000;
  const min = (seconds / 60);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${Math.floor(hours % 24)}h`;
  }
  if (hours > 0) {
    return `${hours}h ${Math.floor(min % 60)}m`;
  }
  return `${Math.floor(min)}m ${Math.floor(seconds % 60)}s`;
}

/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param message The message that triggered the bot.
 * @returns {Boolean} True if the bot is in a voice channel.
 */
function botInVC (message) {
  return message.guild.voice && message.guild.voice.channel;
}

/**
 * Return an object containing the embed and time based on the data provided
 * @param url The url to create the embed for
 * @param infos Optional - the info metadata to use
 * @returns {Promise<{embed: module:"discord.js".MessageEmbed, timeMS: number}>}
 */
async function createEmbed (url, infos) {
  let timeMS;
  let embed;
  if (url.toString().includes('spotify.com')) {
    if (!infos) infos = await getData(url);
    let artists = '';
    infos.artists.forEach(x => artists ? artists += ', ' + x.name : artists += x.name);
    embed = new MessageEmbed()
      .setTitle(`${infos.name}`)
      .setURL(infos.external_urls.spotify)
      .setColor('#1DB954')
      .addField(`Artist${infos.artists.length > 1 ? 's' : ''}`, artists, true)
      .addField('Duration', formatDuration(infos.duration_ms), true)
      .setThumbnail(infos.album.images[infos.album.images.length - 1].url);
    timeMS = parseInt(infos.duration_ms);
    // .addField('Preview', `[Click here](${infos.preview_url})`, true) // adds a preview
  } else {
    if (!infos) infos = await ytdl.getInfo(url);
    let duration = formatDuration(infos.formats ? infos.formats[0].approxDurationMs : 0);
    timeMS = parseInt(duration);
    if (duration === 'NaNm NaNs') {
      duration = 'N/A';
    }
    embed = new MessageEmbed()
      .setTitle(`${infos.videoDetails.title}`)
      .setURL(infos.videoDetails.video_url)
      .setColor('#c40d00')
      .addField('Duration', duration, true)
      .setThumbnail(infos.videoDetails.thumbnails[0].url);
  }
  return {
    embed,
    timeMS
  };
}

/**
 * Send a recommendation to a user. EXPERIMENTAL.
 * @param message The message metadata.
 * @param content Optional - text to add to the recommendation.
 * @param url The url to recommend.
 * @returns {Promise<void>}
 */
async function sendRecommendation (message, content, url) {
  if (message.member.id !== '443150640823271436' && message.member.id !== '268554823283113985') return;
  if (!url) return;
  try {
    let recUser = await bot.users.fetch((message.member.id === '443150640823271436' ? '268554823283113985' : '443150640823271436'));
    await recUser.send(`${message.member.user.username} has a recommendation for you${(content ? `:\n *${content}*` : '')}`);
    await recUser.send((await createEmbed(url)).embed);
    message.channel.send(`*recommendation sent to ${recUser.username}*`);
  } catch (e) {
    console.log(e);
  }
}

/**
 * Initializes global variables for utils
 * @param b The Discord bot instancec.
 */
function initUtils (b) {
  bot = b;
}

module.exports = {formatDuration, createEmbed, sendRecommendation, initUtils, botInVC};