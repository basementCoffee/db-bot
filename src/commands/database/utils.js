const {getXdb2} = require('./retrieval');
const {gsUpdateOverwrite} = require('./api/api');
/**
 *
 * @param keysMap {Map}
 * @param playlistName
 * @return {{keysString: string, valuesString: string}}
 */
function serializeData (keysMap, playlistName) {
  if (!keysMap) keysMap = new Map();
  let keysString;
  let valuesString = '';

  let tempObj = {
    pn: playlistName,
    ks: []
  };
  keysMap.forEach((val) => {
    tempObj.ks.push({
      kn: val.name,
      ts: val.ts
    });
    valuesString += `${val.link},`;
  });
  valuesString = valuesString.substring(0, valuesString.length - 1);
  keysString = JSON.stringify(tempObj);
  return {
    keysString,
    valuesString
  };
}

module.exports = {
  // serialize and update the playlist within the database
  serializeAndUpdate : async (server, sheetName, playlistName, xdb) => {
    const serializedData = serializeData(xdb.playlists.get(playlistName.toUpperCase()), playlistName);
    const playlistArrayUpper = xdb.playlistArray.map(item => item.toUpperCase());
    let row = playlistArrayUpper.indexOf(playlistName.toUpperCase());
    if (row === -1) row = xdb.playlistArray.length;
    await gsUpdateOverwrite([serializedData.keysString, serializedData.valuesString],
      sheetName, 'E', row + 2 , "F", row + 2);
    server.userKeys.clear();
  }
}