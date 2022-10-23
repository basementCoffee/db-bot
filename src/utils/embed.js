const fetch = require('isomorphic-unfetch');
const {getData} = require('spotify-url-info')(fetch);
const scdl = require('soundcloud-downloader').default;
const ytdl = require('ytdl-core-discord');
const {formatDuration, getQueueText, convertYTFormatToMS} = require('./utils');
const {SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK} = require('./lib/constants');
const {EmbedBuilderLocal} = require('./lib/EmbedBuilderLocal');

/**
 * Return an object containing the embed and time based on the data provided.
 * @param url {string} The url to create the embed for.
 * @param infos {Object?} Optional - the info metadata to use.
 * @returns {Promise<{embed: EmbedBuilderLocal, infos: any, timeMS: number}>}
 */
async function createEmbed(url, infos) {
  let timeMS;
  let embed;
  if (url.includes(SPOTIFY_BASE_LINK)) {
    if (!infos) infos = await getData(url);
    let artists = '';
    infos.artists.forEach((x) => artists ? artists += ', ' + x.name : artists += x.name);
    embed = new EmbedBuilderLocal()
      .setTitle(`${infos.name}`)
      .setURL(infos.external_urls.spotify)
      .setColor('#1DB954')
      .addFields({
        inline: true,
        name: `Artist${infos.artists.length > 1 ? 's' : ''}`,
        value: artists,
      },
      {
        inline: true,
        name: 'Duration',
        value: formatDuration(infos.duration || infos.duration_ms),
      },
      )
      .setThumbnail(
        infos.coverArt?.sources[infos.coverArt.sources.length - 1]?.url ||
        infos.album?.images[infos.album.images.length - 1]?.url,
      );
    timeMS = parseInt(infos.duration || infos.duration_ms);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    if (!infos) infos = await scdl.getInfo(url);
    const artist = infos.user.full_name || infos.user.username || infos.publisher_metadata.artist || 'N/A';
    const title = (infos.publisher_metadata ? (infos.publisher_metadata.release_title ||
       infos.publisher_metadata.album_title) : '') || (infos.title.replace(/"/g, '') || 'SoundCloud');
    embed = new EmbedBuilderLocal()
      .setTitle(title)
      .setURL(url)
      .setColor('#ee4900')
      .addFields({
        inline: true,
        name: 'Artist',
        value: artist,
      },
      {
        inline: true,
        name: 'Duration',
        value: formatDuration(infos.duration || 0),
      },
      )
      .setThumbnail(infos.artwork_url || infos.user?.avatar_url || null);
    timeMS = infos.duration || infos.full_duration || 'N/A';
  } else if (url.includes(TWITCH_BASE_LINK)) {
    const artist = url.substr(url.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1).replace(/\//g, '');
    embed = new EmbedBuilderLocal()
      .setTitle(`${artist}'s stream`)
      .setURL(url)
      .setColor('#8a2aef')
      .addFields({
        inline: true,
        name: 'Channel',
        value: artist,
      },
      {
        inline: true,
        name: 'Duration',
        value: 'live',
      },
      )
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
    embed = new EmbedBuilderLocal()
      .setTitle(`${videoDetails.title}`)
      .setURL(videoDetails.video_url || videoDetails.shortUrl || infos.url)
      .setColor('#c40d00')
      .addFields(
        {
          inline: true,
          name: 'Channel',
          value: `[${videoDetails.author.name || videoDetails.ownerChannelName || 'N/A'}]` +
            `(${videoDetails.author.url || videoDetails.author.channel_url})`,
        },
        {
          inline: true,
          name: 'Duration',
          value: duration || videoDetails.duration,
        },
      )
      .setThumbnail(videoDetails.thumbnails[0].url);
  }
  return {
    embed,
    timeMS,
    infos,
  };
}

/**
 * Sends an updated playback embed with the fields updated. Verifies that there is a currentEmbed within the server.
 * Assumes that a session is ongoing.
 * @param server The server.
 * @returns {Promise<void>}
 */
async function updateActiveEmbed(server) {
  const queueItem = server.queue[0] || server.queueHistory[server.queueHistory.length - 1];
  try {
    if (!server.currentEmbed || !queueItem) return;
    let embed = await createEmbed(queueItem.url, queueItem.infos);
    queueItem.infos = embed.infos;
    embed = embed.embed;
    embed.addFields({
      inline: true,
      name: 'Queue',
      value: getQueueText(server),
    });
    // server.currentEmbed.edit({embeds: [embed]});
    embed.edit(server.currentEmbed).then();
  } catch (e) {
    console.log(e);
  }
}

/**
 * Sends a session ended embed.
 * @param server The server metadata.
 * @param item The QueueItem to display.
 * @returns {Promise<void>}
 */
async function sessionEndEmbed(server, item) {
  try {
    if (!server.currentEmbed || !item) return;
    let embed = await createEmbed(item.url, item.infos);
    embed = embed.embed;
    server.currentEmbedChannelId = '0';
    server.numSinceLastEmbed = 0;
    embed.addFields({
      inline: true,
      name: '-',
      value: 'Session ended',
    });
    embed.edit(server.currentEmbed).then();
  } catch (e) {
    console.log(e);
  }
}

module.exports = {updateActiveEmbed, createEmbed, sessionEndEmbed};
