const {getData} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const scdl = require('soundcloud-downloader').default;
const ytdl = require('ytdl-core-discord');
const {formatDuration, isCoreAdmin, getQueueText, convertYTFormatToMS} = require('./utils');
const {SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, CORE_ADM} = require('./process/constants');

/**
 * Return an object containing the embed and time based on the data provided.
 * @param url {string} The url to create the embed for.
 * @param infos {Object?} Optional - the info metadata to use.
 * @return {Promise<{embed: module:"discord.js".MessageEmbed, infos: {formats}, timeMS: number}>}
 */
async function createEmbed (url, infos) {
  let timeMS;
  let embed;
  if (url.toString().includes(SPOTIFY_BASE_LINK)) {
    if (!infos) infos = await getData(url);
    let artists = '';
    infos.artists.forEach(x => artists ? artists += ', ' + x.name : artists += x.name);
    embed = new MessageEmbed()
      .setTitle(`${infos.name}`)
      .setURL(infos.external_urls.spotify)
      .setColor('#1DB954')
      .addField(`Artist${infos.artists.length > 1 ? 's' : ''}`, artists, true)
      .addField('Duration', formatDuration(infos.duration_ms), true)
      .setThumbnail(infos.album?.images[infos.album.images.length - 1].url);
    timeMS = parseInt(infos.duration_ms);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    if (!infos) infos = await scdl.getInfo(url);
    const artist = infos.user.full_name || infos.user.username || infos.publisher_metadata.artist || 'N/A';
    const title = (infos.publisher_metadata ? (infos.publisher_metadata.release_title || infos.publisher_metadata.album_title) : '') || (infos.title.replace(/"/g, '') || 'SoundCloud');
    embed = new MessageEmbed()
      .setTitle(title)
      .setURL(url)
      .setColor('#ee4900')
      .addField(`Artist`, artist, true)
      .addField('Duration', formatDuration(infos.duration || 0), true)
      .setThumbnail(infos.artwork_url || infos.user?.avatar_url || null);
    timeMS = infos.duration || infos.full_duration || 'N/A';
  } else if (url.includes(TWITCH_BASE_LINK)) {
    const artist = url.substr(url.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1).replace(/\//g, '');
    embed = new MessageEmbed()
      .setTitle(`${artist}'s stream`)
      .setURL(url)
      .setColor('#8a2aef')
      .addField(`Channel`, artist, true)
      .addField('Duration', 'live', true)
      .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/twitchLogo.jpeg');
  } else {
    if (!infos) infos = await ytdl.getBasicInfo(url);
    let duration;
    let videoDetails = infos.videoDetails;
    if (!videoDetails) videoDetails = infos;
    if (videoDetails.isLiveContent || videoDetails.isLive) {
      duration = 'live';
      timeMS = 3600000; // set to 1hr
    } else {
      if (infos.formats && infos.formats[0]) {
        timeMS = parseInt(infos.formats[0].approxDurationMs || videoDetails.lengthSeconds * 1000);
        duration = formatDuration(timeMS || 0);
      } else {
        timeMS = videoDetails.durationSec * 1000 || convertYTFormatToMS(videoDetails.duration.split(':'));
        duration = formatDuration(timeMS);
      }
      if (duration === 'NaNm NaNs') {
        duration = 'N/A';
        timeMS = 0;
      }
    }
    embed = new MessageEmbed()
      .setTitle(`${videoDetails.title}`)
      .setURL(videoDetails.video_url || videoDetails.shortUrl || infos.url)
      .setColor('#c40d00')
      .addField('Channel', `[${videoDetails.author.name || videoDetails.ownerChannelName || 'N/A'}]` +
        `(${videoDetails.author.url || videoDetails.author.channel_url})`, true)
      .addField('Duration', duration || videoDetails.duration, true)
      .setThumbnail(videoDetails.thumbnails[0].url);
  }
  return {
    embed,
    timeMS,
    infos
  };
}

/**
 * Sends an updated playback embed with the fields updated. Assumes that a session is ongoing.
 * @param server The server.
 * @returns {Promise<void>}
 */
async function updateActiveEmbed (server) {
  try {
    if (!server.currentEmbed && server.queue[0]?.url) return;
    let embed = await createEmbed(server.queue[0].url, server.queue[0].infos);
    server.queue[0].infos = embed.infos;
    embed = embed.embed;
    embed.addField('Queue', getQueueText(server), true);
    server.currentEmbed.edit(embed);
  } catch (e) {
    console.log(e);
  }
}

/**
 * Send a recommendation to a user. EXPERIMENTAL.
 * @param message The message metadata.
 * @param content Optional - text to add to the recommendation.
 * @param url The url to recommend.
 * @param uManager bot.users
 * @returns {Promise<void>}
 */
async function sendRecommendation (message, content, url, uManager) {
  if (!isCoreAdmin(message.member.id)) return;
  if (!url) return;
  try {
    let recUser = await uManager.fetch((message.member.id === CORE_ADM[0] ? CORE_ADM[1] : CORE_ADM[0]));
    await recUser.send({
      content: `**${message.member.user.username}** has a recommendation for you${(content ? `:\n*${content}*` : '')}\n<${url}>`,
      embed: (await createEmbed(url)).embed
    });
    message.channel.send(`*recommendation sent to ${recUser.username}*`);
  } catch (e) {
    console.log(e);
  }
}



module.exports = {updateActiveEmbed, sendRecommendation, createEmbed}