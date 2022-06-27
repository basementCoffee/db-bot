let scpl = require("scdl-core").SoundCloud.create().then(x => scpl = x);
const {createQueueItem, getLinkType, linkFormatter, verifyPlaylist} = require('./utils');
const {
  StreamType, SOUNDCLOUD_BASE_LINK, MAX_QUEUE_S, SPOTIFY_BASE_LINK, TWITCH_BASE_LINK
} = require('./process/constants');
const fetch = require('isomorphic-unfetch');
const {getData, getTracks} = require('spotify-url-info')(fetch);
const ytpl = require('ytpl');

/**
 * Gets the url of the item from the infos.
 * @param item A single track's metadata.
 * @param type {string} Either 'sp' 'sc' or 'yt' depending on the source of the infos.
 * @returns {string} The url.
 */
function getUrl (item, type) {
  switch (type) {
    case 'sp':
      return item.external_urls.spotify;
    case 'yt':
      if (item.videoId) return `https://youtube.com/watch?v=${item.videoId}`;
      return item.shortUrl || item.url;
    case 'sc':
      return item.permalink_url;
    default:
      const errString = `Error: Incorrect type provided, provided ${type}`;
      console.log(errString);
      throw errString;
  }
}

/**
 * A wrapper for getTracks to handle errors regarding Spotify requests.
 * @param playlistUrl {string} The url to get the tracks for.
 * @param retries {number=} Used within the function for error handling.
 * @returns { Promise<Tracks[]> | Tracks[]}
 */
async function getTracksWrapper (playlistUrl, retries = 0) {
  try {
    return await getTracks(playlistUrl);
  } catch {
    if (retries < 2) return getTracksWrapper(playlistUrl, ++retries);
    else return [];
  }
}

/**
 * Un-package the playlist url and pushes each url to the given array.
 * @param url A Spotify or YouTube playlist link.
 * @param tempArray The array to push to.
 * @returns {Promise<number>} The number of items pushed to the array.
 */
async function getPlaylistItems (url, tempArray) {
  const linkType = getLinkType(url);
  const playlist = await getPlaylistArray(url, linkType);
  let itemCounter = 0;
  try {
    // add all the songs from the playlist to the tempArray
    for (let j of playlist) {
      url = getUrl(j, linkType);
      if (url) {
        tempArray.push(createQueueItem(url, linkType, j));
        itemCounter++;
      }
    }
  } catch (e) {
    console.log(`Error in getPlaylistItems: ${url}\n`, e);
  }
  return itemCounter;
}

/**
 * Gets the array of playlist items.
 * @param playlistUrl The playlist URL.
 * @param type {string} Either 'sp', 'yt' or 'sc' regarding the type of URL.
 * @returns {Promise<[]>} An Array of link metadata.
 */
async function getPlaylistArray (playlistUrl, type) {
  switch (type) {
    case StreamType.SPOTIFY:
      // filter ensures that each element exists
      const tracks = (await getTracksWrapper(playlistUrl)).filter(track => track);
      if (tracks[0] && !tracks[0].album) {
        const firstTrack = await getData(playlistUrl);
        tracks.map(item => item.album = {images: firstTrack.images});
      }
      return tracks;
    case StreamType.YOUTUBE:
      const items = (await ytpl(playlistUrl, {pages: 5})).items;
      // index of -1 means that items will repeat
      if (items[0].index === -1) items.splice(100);
      return items;
    case StreamType.SOUNDCLOUD:
      return (await scpl.playlists.getPlaylist(linkFormatter(playlistUrl, SOUNDCLOUD_BASE_LINK))).tracks;
    default:
      console.log(`Error: invalid linkType argument within addPlaylistToQueue`);
      throw `Error: Incorrect type provided, provided ${type}`;
  }
}

/**
 * Adds playlists to the reference array passed in. Can handle Spotify and SoundCloud tracks.
 * @param message The message metadata
 * @param qArray {Array} The queue to add to.
 * @param numItems {number} The number of items added to queue
 * @param playlistUrl {string} The url of the playlist
 * @param linkType {string} Either 'sp' 'sc' or 'yt' depending on the type of link.
 * @param addToFront {boolean=} Optional - true if to add to the front of the queue
 * @param position {number=} Optional - the position of the queue to add the item to
 * @returns {Promise<Number>} The number of items added to the queue
 */
async function addPlaylistToQueue (message, qArray, numItems, playlistUrl, linkType, addToFront, position) {
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
        url = getUrl(pItem, linkType);
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
      for (let pItem of playlist) {
        url = getUrl(pItem, linkType);
        if (itemsLeft > 0) {
          if (url) {
            if (position && !(position > qArray.length)) {
              qArray.splice(position, 0, createQueueItem(url, linkType, pItem));
              position++;
            } else qArray.push(createQueueItem(url, linkType, pItem));
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
    console.log(e);
    message.channel.send('there was an error');
  }
  return numItems;
}

/**
 * Adds the link to the queue. Also works for playlist links.
 * @param url The link to add to the queue.
 * @param message The message metadata.
 * @param server The server.
 * @param mgid The message guild id.
 * @param addToFront {boolean} If to add to the front.
 * @param queueFunction {(arr: Array, {type, url, infos})=>void}
 * A function that adds a given link to the server queue. Used for YT only.
 * @returns {Promise<Number>} The number of items added.
 */
async function addLinkToQueue (url, message, server, mgid, addToFront, queueFunction) {
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
    queueFunction(server.queue, createQueueItem(url, (url.includes(TWITCH_BASE_LINK) ? StreamType.TWITCH : StreamType.YOUTUBE), null));
  }
  return 1;
}

module.exports = {getPlaylistItems, addPlaylistToQueue, addLinkToQueue};
