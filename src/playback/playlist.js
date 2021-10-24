const {getTracks} = require('spotify-url-info');
const ytpl = require('ytpl');
const {MAX_QUEUE_S} = require('../utils/constants');

/**
 *
 * @param message The message metadata
 * @param server The server.
 * @param mgid The message guild id
 * @param pNums The number of items added to queue
 * @param playlistUrl The url of the playlist
 * @param isSpotify If the playlist is a spotify playlist
 * @param addToFront Optional - true if to add to the front of the queue
 * @param position Optional - the position of the queue to add the item to
 * @returns {Promise<Number>} The number of items added to the queue
 */
async function addPlaylistToQueue (message, server, mgid, pNums, playlistUrl, isSpotify, addToFront, position) {
  let playlist;
  try {
    if (isSpotify) {
      //playlink
      playlist = await getTracks(playlistUrl);
    } else {
      playlist = await ytpl(await ytpl.getPlaylistID(playlistUrl), {pages: 1});
      playlist = playlist.items;
    }
    let url;
    if (addToFront) {
      let itemsLeft = MAX_QUEUE_S - server.queue.length;
      let lowestLengthIndex = Math.min(playlist.length, itemsLeft) - 1;
      let item;
      while (lowestLengthIndex > -1) {
        item = playlist[lowestLengthIndex];
        lowestLengthIndex--;
        url = isSpotify ? item.external_urls.spotify : (item.shortUrl ? item.shortUrl : item.url);
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
        url = isSpotify ? j.external_urls.spotify : (j.shortUrl ? j.shortUrl : j.url);
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

module.exports = {addPlaylistToQueue};
