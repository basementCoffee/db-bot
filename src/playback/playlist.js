const {getTracks} = require('spotify-url-info');
const ytpl = require('ytpl');
const {MAX_QUEUE_S, SOUNDCLOUD_BASE_LINK, StreamType} = require('../utils/constants');
const {linkFormatter, createQueueItem, getLinkType} = require('../utils/utils');
// should be completed before first query
let scpl = require("scdl-core").SoundCloud.create().then(x => scpl = x);

/**
 * Adds playlists to the reference array passed in.
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
 * Gets the array of playlist items.
 * @param playlistUrl The playlist URL.
 * @param type {string} Either 'sp', 'yt' or 'sc' regarding the type of URL.
 * @returns {Promise<[]>} An Array of link metadata.
 */
async function getPlaylistArray (playlistUrl, type) {
  switch (type) {
    case StreamType.SPOTIFY:
      // filter ensures that each element exists
      return (await getTracks(playlistUrl)).filter(track => track);
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

module.exports = {addPlaylistToQueue, getPlaylistItems};
