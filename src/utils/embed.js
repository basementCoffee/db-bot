const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);
const scdl = require('soundcloud-downloader').default;
const ytdl = require('ytdl-core-discord');
const { formatDuration, getQueueText, convertYTFormatToMS, logError } = require('./utils');
const { SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK } = require('./lib/constants');
const { EmbedBuilderLocal } = require('./lib/EmbedBuilderLocal');
const { isNumber } = require('node-os-utils/util');
const DB_SPOTIFY_EMBED_ICON = 'https://github.com/Reply2Zain/db-bot/blob/master/assets/dbBotspotifyIcon.jpg?raw=true';
const SpotifyWebApi = require('spotify-web-api-node');
const processStats = require('./lib/ProcessStats');

// Set up the Spotify Web API client with your client ID and secret
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_SECRET_CLIENT_ID,
});

spotifyApi.clientCredentialsGrant().then((data) => {
  spotifyApi.setAccessToken(data.body.access_token);
});

async function getCoverArt(url) {
  // Extract the Spotify track or album ID from the URL
  const id = url.split('/').pop();
  let data;
  try {
    // Use the Spotify Web API to get information about the track or album
    data = await spotifyApi.getTrack(id);
    // Return the cover art image URL from the track data
    if (data) return data.body.album.images[0].url;
  }
  catch (e) {
    processStats.debug(e);
    try {
      // If the track was not found, try getting the cover art for an album
      data = await spotifyApi.getAlbum(id);
      if (data) return data.body.images[0].url;
    }
    catch (e2) {
      processStats.debug(e2);
      return null;
    }
  }
}


async function getSpotifyIcon(infos, url) {
  let icon;
  if (infos.coverArt?.sources) {
    icon = infos.coverArt.sources[infos.coverArt.sources.length - 1]?.url;
  }
  if (!icon) {
    if (infos.album?.images) {
      icon = infos.album.images[infos.album.images.length - 1]?.url;
    }
  }
  return icon || (await getCoverArt(url)) || DB_SPOTIFY_EMBED_ICON;
}

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
      .setThumbnail(await getSpotifyIcon(infos, url));
    timeMS = parseInt(infos.duration || infos.duration_ms);
  }
  else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
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
  }
  else if (url.includes(TWITCH_BASE_LINK)) {
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
  }
  else {
    if (!infos) infos = await ytdl.getBasicInfo(url);
    let duration;
    let videoDetails = infos.videoDetails;
    if (!videoDetails) videoDetails = infos;
    if (videoDetails.isLiveContent || videoDetails.isLive) {
      duration = 'live';
      // set to 1hr
      timeMS = 3600000;
    }
    else {
      if (infos.formats && infos.formats[0]) {
        timeMS = parseInt(infos.formats[0].approxDurationMs || videoDetails.lengthSeconds * 1000);
        duration = formatDuration(timeMS || 0);
      }
      else {
        timeMS = videoDetails.durationSec * 1000 || (() =>
          isNumber(videoDetails.duration) ? videoDetails.duration : false
        )() || convertYTFormatToMS(videoDetails.duration.split(':'));
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
 * @param server {LocalServer} The server.
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
  }
  catch (e) {
    console.log(e);
  }
}

/**
 * Provided a queue item. Sends a session ended embed.
 * @param server {LocalServer} The server metadata.
 * @param queueItem The QueueItem to display.
 * @returns {Promise<void>}
 */
async function sessionEndEmbed(server, queueItem) {
  try {
    if (!server.currentEmbed || !queueItem) return;
    const embed = (await createEmbed(queueItem.url, queueItem.infos)).embed;
    sessionEndEmbedWEmbed(server, embed);
  }
  catch (e) {
    logError(e);
  }
}

/**
 * Provided an embed. Attaches the 'session ended' tag and sends the final session ended embed.
 * @param server {LocalServer} The server metadata.
 * @param embed {EmbedBuilderLocal} The embed to send.
 * @returns {void}
 */
function sessionEndEmbedWEmbed(server, embed) {
  if (server.currentEmbed.reactions) {
    if (server.collector) {
      server.collector.stop();
      server.collector = null;
    }
  }
  server.currentEmbedChannelId = '0';
  server.numSinceLastEmbed = 0;
  embed.addFields({
    inline: true,
    name: '-',
    value: 'Session ended',
  });
  embed.edit(server.currentEmbed);
  setTimeout(() => {
    server.currentEmbed = null;
  }, 500);
}

module.exports = { updateActiveEmbed, createEmbed, sessionEndEmbed };
