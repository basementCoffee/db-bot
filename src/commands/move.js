const utils = require('../utils/utils');
const { serializeAndUpdate } = require('../database/utils');

/**
 * Mutates the provided array by moving an element at posA to posB.
 * @param channel The channel object.
 * @param arr The array.
 * @param posA The first position.
 * @param posB THe second position.
 * @returns {void}
 */
function runMoveItemCommand(channel, arr, posA, posB) {
  if (!utils.botInVC_Guild(channel.guild)) return;
  posA = Math.floor(posA);
  posB = Math.floor(posB);
  const MIN_POS = 1;
  const MIN_ARR_SIZE = 3;
  if (!(posA && posB)) {
    channel.send('*two numbers expected: the position of the item to move and it\'s new position*\n`ex: move 1 5`');
  }
  else if (arr.length < MIN_ARR_SIZE) {channel.send('*not enough items in the queue*');}
  else if (posA < MIN_POS || posB < MIN_POS) {
    channel.send(`positions must be greater than ${MIN_POS - 1}`);
  }
  else {
    if (posA > arr.length - 1) posA = arr.length - 1;
    if (posB > arr.length - 1) posB = arr.length - 1;
    const item = arr.splice(posA, 1)[0];
    arr.splice(posB, 0, item);
    channel.send(`*moved item to position ${posB}*`);
  }
}

/**
 * Moves an item from one playlist to another.
 * @param server {LocalServer} The local server object.
 * @param channel The channel to send the message to.
 * @param sheetName The name of the sheet.
 * @param xdb The database object.
 * @param args A list of keys and single playlist (the playlist should be the one to move the keys into).
 */
function moveKeysWrapper(server, channel, sheetName, xdb, args) {
  let playlist;
  let playlistName;
  args = args.join(' ').split(/,|, | /).filter((i) => i);
  for (let i = args.length - 1; i > -1; i--) {
    playlist = xdb.playlists.get(args[i].toUpperCase());
    if (playlist) {
      playlistName = args[i];
      args.splice(i, 1);
      break;
    }
  }
  if (!playlist) {
    channel.send('*error: expected a playlist-name to move the key to (i.e. move-key [key] [playlist])*');
    return;
  }
  moveKeysCommand(server, channel, sheetName, xdb, args, playlistName);
}

/**
 * Move keys from one playlist to another.
 * @param server {LocalServer} The local server object.
 * @param channel {any}
 * @param sheetName {string}
 * @param xdb {any}
 * @param listOfKeys {Array<string>}
 * @param playlistNameTo {string}
 */
async function moveKeysCommand(server, channel, sheetName, xdb, listOfKeys, playlistNameTo) {
  const insertPlaylist = xdb.playlists.get(playlistNameTo.toUpperCase());
  if (!insertPlaylist) {
    channel.send(`*could not find playlist ${playlistNameTo}*`);
    return;
  }
  const unknownKeys = [];
  const errorKeys = [];
  // set of playlists names where keys were removed from
  const removedPlaylistsSet = new Set();
  let keyObj;
  let keyName;
  const playlistArray = xdb.playlistArray;
  const playlistArrayUpper = playlistArray.map((val) => val.toUpperCase());
  const index = playlistArrayUpper.indexOf(playlistNameTo.toUpperCase());
  const insertPlaylistName = playlistArray[index];
  for (keyName of listOfKeys) {
    keyObj = xdb.globalKeys.get(keyName.toUpperCase());
    if (!keyObj) {
      unknownKeys.push(keyName);
      continue;
    }
    const fromPlaylist = xdb.playlists.get(keyObj.playlistName.toUpperCase());
    const fromPlaylistName = keyObj.playlistName;
    if (fromPlaylist && index !== -1) {
      insertPlaylist.set(keyName.toUpperCase(), keyObj);
      keyObj.name = keyName;
      keyObj.playlistName = insertPlaylistName;
      if (fromPlaylistName.toUpperCase() !== insertPlaylistName.toUpperCase()) {
        fromPlaylist.delete(keyName.toUpperCase());
        removedPlaylistsSet.add(fromPlaylistName);
      }
    }
    else {
      errorKeys.push(keyName);
    }
  }
  if (errorKeys.length > 0) {
    const errorKeysStr = errorKeys.join(', ');
    channel.send(`there was an error with the keys: ${errorKeysStr.substring(0, errorKeysStr.length - 2)}`);
  }
  if (unknownKeys.length > 0) {
    const unfoundKeysStr = errorKeys.join(', ');
    console.log(unknownKeys);
    channel.send(`could not find the keys: ${unfoundKeysStr.substring(0, unfoundKeysStr.length - 2)}`);
  }
  // insert new data first
  await serializeAndUpdate(server, sheetName, playlistNameTo, xdb);
  // remove old data
  for (const updatedPlaylist of removedPlaylistsSet) {
    await serializeAndUpdate(server, sheetName, updatedPlaylist, xdb);
  }
  if ((errorKeys.length + unknownKeys.length) < listOfKeys.length) {
    channel.send(`*moved keys to **${playlistNameTo}***`);
  }
}

module.exports = { runMoveItemCommand, moveKeysWrapper };
