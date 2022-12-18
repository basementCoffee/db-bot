const {SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK} = require('./lib/constants');

/**
 * Given a positive duration in ms, returns a formatted string separating
 * the time in days, hours, minutes, and seconds. Otherwise, returns 0m 0s.
 * Will always return two time identifiers (ex: 2d 5h, 3h 12m, 1m 2s, 0m, 30s)
 * @param duration a duration in milliseconds
 * @returns {string} a formatted string duration
 */
function formatDuration(duration) {
  const seconds = duration / 1000;
  const min = (seconds / 60);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${Math.floor(hours % 24)}h`;
  }
  if (hours > 0) {
    return `${hours}h ${Math.floor(min % 60)}m`;
  }
  if (seconds >= 0) {
    return `${Math.floor(min)}m ${Math.floor(seconds % 60)}s`;
  }
  return '0m 0s';
}

/**
 * Converts a provided seek format (ex: 1s 10m2s 1h31s) to seconds. If a number without an appending letter
 * is provided, then assumes it is already provided in seconds.
 * @param seekString The string to parse.
 * @returns {number} The seek time in seconds.
 */
function convertSeekFormatToSec(seekString) {
  let numSeconds;
  if (Number(seekString)) {
    numSeconds = seekString;
  }
  else {
    const array = [];
    const testVals = ['h', 'm', 's'];
    const convertToArray = (formattedNum) => {
      for (const val of testVals) {
        const search = new RegExp(`(\\d*)${val}`);
        const res = search.exec(formattedNum);
        if (res) array.push(Number(res[1]) || 0);
        else array.push(0);
      }
    };
    convertToArray(seekString);
    numSeconds = convertYTFormatToMS(array) / 1000;
  }
  return numSeconds;
}

/**
 * Given a link, formats the link with https://[index of base -> end].
 * Ex: url = m.youtube.com/test & suffix = youtube.com --> https://youtube.com/test
 * @param url {string} The link to format.
 * @param baseLink {string}  The starting of the remainder of the link to always add after the prefix.
 * @returns {string} The formatted URL.
 */
function linkFormatter(url, baseLink) {
  return `https://${url.substr(url.indexOf(baseLink))}`;
}


/**
 * Removes <> and [] from links. If provided a spotify or soundcloud link then properly formats those as well.
 * @param link {string} The link to format.
 * @returns {string} The formatted link.
 */
function universalLinkFormatter(link) {
  if (link[0] === '[' && link[link.length - 1] === ']') {
    link = link.substring(1, link.length - 1);
  }
  else if (link[0] === '<' && link[link.length - 1] === '>') {
    link = link.substring(1, link.length - 1);
  }
  if (link.includes(SPOTIFY_BASE_LINK)) link = linkFormatter(link, SPOTIFY_BASE_LINK);
  else if (link.includes(SOUNDCLOUD_BASE_LINK)) link = linkFormatter(link, SOUNDCLOUD_BASE_LINK);
  return link;
}

/**
 * Removes extra formatting from a link (< and >).
 * @param link {string} The link to format.
 * @returns {string} The formatted link.
 */
function removeFormattingLink(link) {
  if (link[0] === '<' && link[link.length - 1] === '>') {
    link = link.substring(1, link.length - 1);
  }
  return link;
}


module.exports = {formatDuration, linkFormatter, convertSeekFormatToSec}
