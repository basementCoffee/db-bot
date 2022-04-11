
/**
 * Searches a Map for the given key. Provides the keys that contain the given key.
 * @param keyName {string} the key to search for.
 * @param cdb {Map<>} A map containing all the keys and their links.
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values.
 */
function runSearchCommand (keyName, cdb) {
  const keyNameLen = keyName.length;
  const keyArray = Array.from(cdb.keys());
  let ss = '';
  let ssi = 0;
  let searchKey;
  keyName = keyName.toUpperCase();
  for (let ik = 0; ik < keyArray.length; ik++) {
    searchKey = keyArray[ik].toUpperCase();
    if (keyName === searchKey.substring(0, keyNameLen) || (keyNameLen > 1 && searchKey.includes(keyName))) {
      ssi++;
      ss += `${keyArray[ik]}, `;
    }
  }
  if (ssi) ss = ss.substring(0, ss.length - 2);
  return {
    // the search string
    ss: ss,
    // the number of searches found
    ssi: ssi
  };
}

/**
 * Tries to get a close match of a valid existing key from the word provided.
 * Otherwise, returns false.
 * @param word {string} The word to check.
 * @param cdb {Map<>} A map containing all the keys and their links.
 * @return {string | false} The closest valid assumption or false.
 */
function getAssumption (word, cdb) {
  const sObj = runSearchCommand(word, cdb);
  const ss = sObj.ss;
  if (sObj.ssi === 1 && ss && word.length > 1 && (ss.length - word.length) < Math.floor((ss.length / 2) + 2)) {
    return ss;
  }
  return false;
}

module.exports = {runSearchCommand, getAssumption}