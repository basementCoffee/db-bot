const {getTracks} = require('spotify-url-info');
const ytpl = require('ytpl');
const {MAX_QUEUE_S} = require('../utils/constants');

/**
 * Adds playlists to the queue.
 * @param message The message metadata
 * @param server The server.
 * @param mgid The message guild id
 * @param pNums {number} The number of items added to queue
 * @param playlistUrl {string} The url of the playlist
 * @param linkType {string} Either 'sp' 'sc' or 'yt' depending on the type of link.
 * @param addToFront {boolean=} Optional - true if to add to the front of the queue
 * @param position {number=} Optional - the position of the queue to add the item to
 * @returns {Promise<Number>} The number of items added to the queue
 */
async function addPlaylistToQueue (message, server, mgid, pNums, playlistUrl, linkType, addToFront, position) {
  let playlist;
  try {
    if (linkType === 'sp') {
      playlist = await getTracks(playlistUrl);
    } else if (linkType === 'yt') {
      playlist = await ytpl(await ytpl.getPlaylistID(playlistUrl), {pages: 1});
      playlist = playlist.items;
    } else if (linkType === 'sc') {
      return message.channel.send('soundcloud playlists are not supported yet');
    } else {
      console.log(`Error: invalid linkType argument within addPlaylistToQueue`);
      return 0;
    }
    let url;
    if (addToFront) {
      let itemsLeft = MAX_QUEUE_S - server.queue.length;
      let lowestLengthIndex = Math.min(playlist.length, itemsLeft) - 1;
      let item;
      while (lowestLengthIndex > -1) {
        item = playlist[lowestLengthIndex];
        lowestLengthIndex--;
        url = getUrl(item, linkType);
        if (itemsLeft > 0) {
          if (url) {
            server.queue.unshift(url);
            pNums++;
            itemsLeft--;
          }
        } else {
          message.channel.send('*queue is full*');
          break;
        }
      }
    } else {
      let itemsLeft = MAX_QUEUE_S - server.queue.length;
      for (let j of playlist) {
        url = getUrl(j, linkType);
        if (itemsLeft > 0) {
          if (url) {
            if (position && !(position > server.queue.length)) {
              server.queue.splice(position, 0, url);
              position++;
            } else server.queue.push(url);
            pNums++;
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
  return pNums;
}

/**
 * Gets the url of the item from the infos.
 * @param item The playlist item.
 * @param type {string} Either 'sp' 'sc' or 'yt' depending on the source of the infos.
 * @returns {string} The url.
 */
function getUrl (item, type) {
  switch (type) {
    case 'sp':
      return item.external_urls.spotify;
    case 'yt':
      return item.shortUrl || item.url;
    default:
      console.log('Error: Incorrect type provided.');
      throw 'Error: Incorrect type provided.';
  }
}

/**
 * Un-package the playlist url and push it to the given array.
 * @param url A Spotify or YouTube playlist link.
 * @param tempArray The array to push to.
 * @returns {Promise<number>} The number of items pushed to the array.
 */
async function getPlaylistItems (url, tempArray) {
  let playlist;
  let itemCounter = 0;
  try {
    let isSpotify = url.toLowerCase().includes('spotify');
    // add all the songs from the playlist to the tempArray
    if (isSpotify) {
      playlist = (await getTracks(url)).filter(track => track);
      for (let j of playlist) {
        url = j.external_urls.spotify;
        if (url) {
          tempArray.push(url);
          itemCounter++;
        }
      }
    } else {
      playlist = (await ytpl(url, {pages: 1})).items;
      for (let j of playlist) {
        url = j.shortUrl ? j.shortUrl : j.url;
        if (url) {
          tempArray.push(url);
          itemCounter++;
        }
      }
    }
  } catch (e) {
    console.log(`Error in getPlaylistItems: ${url}\n`, e);
  }
  return itemCounter;
}

module.exports = {addPlaylistToQueue, getPlaylistItems};
