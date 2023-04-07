import LocalServer from './lib/LocalServer';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import ytdl from 'ytdl-core-discord';
import { getQueueText, isSpotifyLink } from './utils';
import { convertYTFormatToMS, formatDuration } from './formatUtils';
import { DB_SPOTIFY_EMBED_ICON, SOUNDCLOUD_BASE_LINK, SPOTIFY_BASE_LINK, TWITCH_BASE_LINK } from './lib/constants';
import processStats from './lib/ProcessStats';
import spotifyAuth from './lib/SpotifyAuthenticator';
import fetch from 'isomorphic-unfetch';

const { getData } = require('spotify-url-info')(fetch);
const scdl = require('soundcloud-downloader').default;
const { isNumber } = require('node-os-utils/util');

/**
 * Gets the cover art of a spotify track url.
 * @param url {string} The url of the track.
 * @returns {Promise<string|null>} The raw coverArt link or null.
 */
async function getSpotifyCoverArt(url: string): Promise<string | undefined> {
  // Extract the Spotify track or album ID from the URL
  const id = url.split('/').pop();
  let data;
  const spotifyApi = await spotifyAuth.getSpotifyApiNode();
  try {
    // Use the Spotify Web API to get information about the track or album
    data = await spotifyApi.getTrack(id);
    // Return the cover art image URL from the track data
    if (data) {
      return data.body.album.images.length ? data.body.album.images[data.body.album.images.length - 1].url : null;
    }
  } catch (e) {
    processStats.debug(`${getSpotifyCoverArt.name} error1: `, e);
    try {
      // If the track was not found, try getting the cover art for an album
      data = await spotifyApi.getAlbum(id);
      if (data) {
        return data.body.images.length ? data.body.images[data.body.images.length - 1].url : null;
      }
    } catch (e2) {
      processStats.debug(`${getSpotifyCoverArt.name} error2: `, e2);
    }
  }
  return undefined;
}

/**
 * Gets a thumbnail to display for the spotify embed player.
 * @param infos {*} The track metadata.
 * @param url {string} The url of the track to get the coverArt for.
 * @returns {Promise<string>} Either the track's coverArt or a default thumbnail icon.
 */
async function getSpotifyIcon(infos: any, url: string) {
  let icon;
  if (infos.coverArt?.sources && infos.coverArt.sources.length) {
    icon = infos.coverArt.sources[infos.coverArt.sources.length - 1]?.url;
  }
  if (!icon && infos.album?.images && infos.album.images.length) {
    icon = infos.album.images[infos.album.images.length - 1]?.url;
  }
  return icon || (await getSpotifyCoverArt(url)) || DB_SPOTIFY_EMBED_ICON;
}

/**
 * Return an object containing the embed and time based on the data provided.
 * @param url {string} The url to create the embed for.
 * @param infos {Object?} Optional - the info metadata to use.
 * @returns {Promise<{embed: EmbedBuilderLocal, infos: any, timeMS: number}>}
 */
async function createEmbed(url: string, infos: any): Promise<{ embed: EmbedBuilderLocal; infos: any; timeMS: number }> {
  let timeMS;
  let embed;
  if (isSpotifyLink(url)) {
    if (!infos) infos = await getData(url);
    let artists = '';
    infos.artists.forEach((x: any) => (artists ? (artists += ', ' + x.name) : (artists += x.name)));
    infos.thumbnailUrl = infos.thumbnailUrl ?? (await getSpotifyIcon(infos, url));
    embed = new EmbedBuilderLocal()
      .setTitle(`${infos.name}`)
      .setURL(infos.external_urls.spotify)
      .setColor('#1DB954')
      .addFields(
        {
          inline: true,
          name: `Artist${infos.artists.length > 1 ? 's' : ''}`,
          value: artists
        },
        {
          inline: true,
          name: 'Duration',
          value: formatDuration(infos.duration || infos.duration_ms)
        }
      )
      .setThumbnail(infos.thumbnailUrl);
    timeMS = parseInt(infos.duration || infos.duration_ms);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    if (!infos) infos = await scdl.getInfo(url);
    const artist = infos.user.full_name || infos.user.username || infos.publisher_metadata.artist || 'N/A';
    const title =
      (infos.publisher_metadata
        ? infos.publisher_metadata.release_title || infos.publisher_metadata.album_title
        : '') ||
      infos.title.replace(/"/g, '') ||
      'SoundCloud';
    embed = new EmbedBuilderLocal()
      .setTitle(title)
      .setURL(url)
      .setColor('#ee4900')
      .addFields(
        {
          inline: true,
          name: 'Artist',
          value: artist
        },
        {
          inline: true,
          name: 'Duration',
          value: formatDuration(infos.duration || 0)
        }
      )
      .setThumbnail(infos.artwork_url || infos.user?.avatar_url || null);
    timeMS = infos.duration || infos.full_duration || 'N/A';
  } else if (url.includes(TWITCH_BASE_LINK)) {
    const artist = url.substr(url.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1).replace(/\//g, '');
    embed = new EmbedBuilderLocal()
      .setTitle(`${artist}'s stream`)
      .setURL(url)
      .setColor('#8a2aef')
      .addFields(
        {
          inline: true,
          name: 'Channel',
          value: artist
        },
        {
          inline: true,
          name: 'Duration',
          value: 'live'
        }
      )
      .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/twitchLogo.jpeg');
  } else {
    if (!infos) infos = await ytdl.getBasicInfo(url);
    let duration;
    let videoDetails = infos.videoDetails;
    if (!videoDetails) videoDetails = infos;
    if (videoDetails.isLiveContent || videoDetails.isLive) {
      duration = 'live';
      // set to 1hr
      timeMS = 3600000;
    } else {
      if (infos.formats && infos.formats[0]) {
        timeMS = parseInt(infos.formats[0].approxDurationMs || videoDetails.lengthSeconds * 1000);
        duration = formatDuration(timeMS || 0);
      } else {
        timeMS =
          videoDetails.durationSec * 1000 ||
          (() => (isNumber(videoDetails.duration) ? videoDetails.duration : false))() ||
          convertYTFormatToMS(videoDetails.duration.split(':'));
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
          value:
            `[${videoDetails.author.name || videoDetails.ownerChannelName || 'N/A'}]` +
            `(${videoDetails.author.url || videoDetails.author.channel_url})`
        },
        {
          inline: true,
          name: 'Duration',
          value: duration || videoDetails.duration
        }
      )
      .setThumbnail(videoDetails.thumbnails[0].url);
  }
  return {
    embed,
    timeMS,
    infos
  };
}

/**
 * Sends an updated playback embed with the fields updated. Verifies that there is a currentEmbed within the server.
 * Assumes that a session is ongoing.
 * @param server {LocalServer} The server.
 * @returns {Promise<void>}
 */
async function updateActiveEmbed(server: LocalServer) {
  const queueItem = server.queue[0] || server.queueHistory[server.queueHistory.length - 1];
  try {
    if (!server.currentEmbed || !queueItem) return;
    const embedObject = await createEmbed(queueItem.url, queueItem.infos);
    queueItem.infos = embedObject.infos;
    const embed = embedObject.embed;
    embed.addFields({
      inline: true,
      name: 'Queue',
      value: getQueueText(server)
    });
    // server.currentEmbed.edit({embeds: [embed]});
    embed.edit(server.currentEmbed).then();
  } catch (e) {
    console.log(e);
  }
}

/**
 * Provided a queue item. Sends a session ended embed.
 * @param server {LocalServer} The server metadata.
 * @param queueItem The QueueItem to display.
 * @returns {Promise<void>}
 */
async function sessionEndEmbed(server: LocalServer, queueItem: any) {
  try {
    if (!server.currentEmbed || !queueItem) return;
    const embed = (await createEmbed(queueItem.url, queueItem.infos)).embed;
    sessionEndEmbedWEmbed(server, embed);
  } catch (e: any) {
    processStats.logError(e);
  }
}

/**
 * Assuming that there is a current session embed. Attaches the 'session ended' tag to the provided embed and sends the final session ended embed.
 * @param server {LocalServer} The server metadata.
 * @param embed {EmbedBuilderLocal} The embed to send.
 * @returns {void}
 */
function sessionEndEmbedWEmbed(server: LocalServer, embed: EmbedBuilderLocal) {
  if (!server.currentEmbed) return;
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
    value: 'Session ended'
  });
  embed.edit(server.currentEmbed);
  setTimeout(() => {
    server.currentEmbed = undefined;
  }, 500);
}

export { updateActiveEmbed, createEmbed, sessionEndEmbed };
