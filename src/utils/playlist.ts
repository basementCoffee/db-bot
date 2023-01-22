import { Message } from 'discord.js';
import { createQueueItem, getLinkType, isPlaylistSpotifyLink, verifyPlaylist } from './utils';
import { MAX_QUEUE_S, SOUNDCLOUD_BASE_LINK, SPOTIFY_BASE_LINK, StreamType, TWITCH_BASE_LINK } from './lib/constants';
import LocalServer from './lib/LocalServer';
import { linkFormatter } from './formatUtils';
import ytpl from 'ytpl';
import processStats from '../utils/lib/ProcessStats';
import spotifyAuth from './lib/SpotifyAuthenticator';
import fetch from 'isomorphic-unfetch';

const { SoundCloud: scdl } = require('scdl-core');
scdl.connect();
const { getData, getTracks } = require('spotify-url-info')(fetch);

/**
 * Gets the url of the item from the metadata (infos).
 * @param item A single track's metadata.
 * @param type The StreamType that the link is. This method does not support twitch.
 * @returns {string} The url.
 */
function getUrlFromInfos(item: any, type: StreamType): string {
  switch (type) {
    case StreamType.SPOTIFY:
      return item.external_urls.spotify;
    case StreamType.YOUTUBE:
      if (item.videoId) return `https://youtube.com/watch?v=${item.videoId}`;
      return item.shortUrl || item.url;
    case StreamType.SOUNDCLOUD:
      return item.permalink_url;
    default:
      const errString = `Error: Incorrect type provided, provided ${type}`;
      processStats.debug(errString);
      throw errString;
  }
}

/**
 * A wrapper for getTracks to handle errors regarding Spotify requests.
 * @param playlistUrl {string} The url to get the tracks for.
 * @param retries {number=} Used within the function for error handling.
 * @returns { Promise<Tracks[]> | Tracks[]}
 */
async function getTracksWrapper(playlistUrl: string, retries = 0): Promise<any> {
  try {
    return await getTracks(playlistUrl);
  } catch (e) {
    if (retries < 2) {
      return getTracksWrapper(playlistUrl, ++retries);
    } else {
      processStats.debug(e);
      return [];
    }
  }
}

/**
 * Un-package the playlist url and pushes each url to the given array.
 * @param url A Spotify or YouTube playlist link.
 * @param tempArray The array to push to.
 * @returns {Promise<number>} The number of items pushed to the array.
 */
async function getPlaylistItems(url: string, tempArray: any[]): Promise<number> {
  const linkType = getLinkType(url);
  const playlist = await getPlaylistArray(url, linkType);
  let itemCounter = 0;
  try {
    // add all the songs from the playlist to the tempArray
    for (const j of playlist) {
      url = getUrlFromInfos(j, linkType);
      if (url) {
        tempArray.push(createQueueItem(url, linkType, j));
        itemCounter++;
      }
    }
  } catch (e) {
    processStats.debug(`Error in getPlaylistItems: ${url}\n`, e);
  }
  return itemCounter;
}

/**
 * Gets the array of playlist items.
 * @param playlistUrl The playlist URL.
 * @param type {string} The StreamType that the link is. This method does not support twitch.
 * @returns {Promise<[]>} An Array of link metadata.
 */
async function getPlaylistArray(playlistUrl: string, type: StreamType) {
  switch (type) {
    case StreamType.SPOTIFY:
      try {
        const spotifyWebApi = await spotifyAuth.getSpotifyApiNode();
        let tracks: any[] = [];
        if (isPlaylistSpotifyLink(playlistUrl)) {
          let additionalRequests;
          let i = 0;
          do {
            const requestBody = (
              await spotifyWebApi.getPlaylistTracks(playlistUrl.split('/').pop(), { offset: i * 100 })
            ).body;
            const requestData = requestBody.tracks ?? requestBody;
            const requestItems = requestData.items;
            if (additionalRequests) {
              additionalRequests--;
            } else {
              // floor would not work instead of ceil for cases where total == limit
              additionalRequests = Math.min(5, Math.ceil(requestData.total / (requestData.limit || 100))) - 1;
            }
            tracks = tracks.concat(requestItems.map((x: any) => x.track).filter((x: any) => x));
            i++;
          } while (additionalRequests > 0);
          if (tracks[0] && !tracks[0].album) {
            const firstTrack = await getData(playlistUrl);
            tracks.map((item) => (item.album = { images: firstTrack.images }));
          }
        } else {
          const trackItem = (await spotifyWebApi.getTracks([playlistUrl.split('/').pop()])).body.tracks[0];
          tracks.push(trackItem);
        }
        return tracks;
      } catch (e) {
        processStats.debug(`[ERROR] in ${getPlaylistArray.name} `, e);
      }
      // filter ensures that each element exists
      return (await getTracksWrapper(playlistUrl)).filter((track: any) => track);
    case StreamType.YOUTUBE:
      const items = (await ytpl(playlistUrl, { pages: 5 })).items;
      // index of -1 means that items will repeat
      if (items[0].index === -1) items.splice(100);
      return items;
    case StreamType.SOUNDCLOUD:
      return (await scdl.playlists.getPlaylist(linkFormatter(playlistUrl, SOUNDCLOUD_BASE_LINK))).tracks;
    default:
      processStats.logError(`Error: invalid linkType argument within addPlaylistToQueue (provided '${type}'`);
      throw new Error(`Incorrect type provided, provided ${type}`);
  }
}

/**
 * Adds playlists to the reference array passed in. Can handle Spotify and SoundCloud tracks.
 * @param message The message metadata
 * @param qArray {Array} The queue to add to.
 * @param numItems {number} The number of items added to queue
 * @param playlistUrl {string} The url of the playlist
 * @param linkType {string} A StreamType. Does not support twitch.
 * @param addToFront {boolean=} Optional - true if to add to the front of the queue
 * @param position {number=} Optional - the position of the queue to add the item to
 * @returns {Promise<Number>} The number of items added to the queue
 */
async function addPlaylistToQueue(
  message: Message,
  qArray: any[],
  numItems: number,
  playlistUrl: string,
  linkType: StreamType,
  addToFront = false,
  position = 0
) {
  const playlist = (await getPlaylistArray(playlistUrl, linkType)) || [];
  if (playlist.length < 1) {
    message.channel.send('*could not get data from the link provided*');
    return 0;
  }
  try {
    let url;
    if (addToFront) {
      let itemsLeft = numItems || MAX_QUEUE_S - qArray.length;
      let lowestLengthIndex = Math.min(playlist.length, itemsLeft) - 1;
      let pItem;
      while (lowestLengthIndex > -1) {
        pItem = playlist[lowestLengthIndex];
        lowestLengthIndex--;
        url = getUrlFromInfos(pItem, linkType);
        if (itemsLeft > 0) {
          if (url) {
            qArray.unshift(createQueueItem(url, linkType, pItem));
            numItems++;
            itemsLeft--;
          }
        } else {
          message.channel.send('*queue is full*');
          break;
        }
      }
    } else {
      let itemsLeft = MAX_QUEUE_S - qArray.length;
      for (const pItem of playlist) {
        url = getUrlFromInfos(pItem, linkType);
        if (itemsLeft > 0) {
          if (url) {
            if (position && !(position > qArray.length)) {
              qArray.splice(position, 0, createQueueItem(url, linkType, pItem));
              position++;
            } else {
              qArray.push(createQueueItem(url, linkType, pItem));
            }
            numItems++;
            itemsLeft--;
          }
        } else {
          message.channel.send('*queue is full*');
          break;
        }
      }
    }
  } catch (e) {
    processStats.debug(e);
    message.channel.send('there was an error');
  }
  return numItems;
}

/**
 * Adds the link to the queue. Also works for playlist links.
 * @param url The link to add to the queue.
 * @param message The message metadata.
 * @param server {LocalServer} The server.
 * @param mgid The message guild id.
 * @param addToFront {boolean} If to add to the front.
 * @param queueFunction {(arr: Array, {type, url, infos})=>void}
 * A function that adds a given link to the server queue. Used for YT only.
 * @returns {Promise<Number>} The number of items added.
 */
async function addLinkToQueue(
  url: string,
  message: Message,
  server: LocalServer,
  mgid: string,
  addToFront = false,
  queueFunction: (array: any[], obj: { type: StreamType; url: string; infos: any }) => void
) {
  if (url.includes(SPOTIFY_BASE_LINK)) {
    url = linkFormatter(url, SPOTIFY_BASE_LINK);
    return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.SPOTIFY, addToFront);
  } else if (ytpl.validateID(url) || url.includes('music.youtube')) {
    url = url.replace(/music.youtube/, 'youtube');
    return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.YOUTUBE, addToFront);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    if (verifyPlaylist(linkFormatter(url, SOUNDCLOUD_BASE_LINK))) {
      url = linkFormatter(url, SOUNDCLOUD_BASE_LINK);
      return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.SOUNDCLOUD, addToFront);
    }
    queueFunction(server.queue, createQueueItem(url, StreamType.SOUNDCLOUD, null));
  } else {
    queueFunction(
      server.queue,
      createQueueItem(url, url.includes(TWITCH_BASE_LINK) ? StreamType.TWITCH : StreamType.YOUTUBE, null)
    );
  }
  return 1;
}

export { getPlaylistItems, addPlaylistToQueue, addLinkToQueue };
