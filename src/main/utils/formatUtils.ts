import { SOUNDCLOUD_BASE_LINK, SPOTIFY_BASE_LINK } from "./lib/constants";

/**
 * Given a positive duration in ms, returns a formatted string separating
 * the time in days, hours, minutes, and seconds. Otherwise, returns 0m 0s.
 * Will always return two time identifiers (ex: 2d 5h, 3h 12m, 1m 2s, 0m, 30s)
 * @param duration A duration in milliseconds
 * @returns A formatted string duration
 */
function formatDuration(duration: number): string {
  const seconds = duration / 1000;
  const min = seconds / 60;
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
  return "0m 0s";
}

/**
 * Converts a provided seek format (ex: 1s 10m2s 1h31s) to seconds. If a number without an appending letter
 * is provided, then assumes it is already provided in seconds.
 * @param seekString The string to parse.
 * @returns The seek time in seconds.
 */
function convertSeekFormatToSec(seekString: string): number {
  let numSeconds;
  if (Number.isFinite(Number(seekString))) {
    numSeconds = Number(seekString);
  } else {
    const array: any = [];
    const testVals = ["h", "m", "s"];
    const convertToArray = (formattedNum: string) => {
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
function linkFormatter(url: string, baseLink: string): string {
  return `https://${url.substr(url.indexOf(baseLink))}`;
}

/**
 * Removes <> and [] from links. If provided a spotify or soundcloud link then properly formats those as well.
 * @param link The link to format.
 * @returns {string} The formatted link.
 */
function universalLinkFormatter(link: string): string {
  if (link[0] === "[" && link[link.length - 1] === "]") {
    link = link.substring(1, link.length - 1);
  } else if (link[0] === "<" && link[link.length - 1] === ">") {
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
function removeFormattingLink(link: string): string {
  if (link[0] === "<" && link[link.length - 1] === ">") {
    link = link.substring(1, link.length - 2);
  }
  return link;
}

/**
 * Given an array of durations with hours, minutes, seconds, return the duration.
 * @param durationArray An array of durations.
 * @returns {number} The duration in MS or 0 if there was an error.
 */
function convertYTFormatToMS(durationArray: Array<any>): number {
  try {
    if (durationArray) {
      let duration = 0;
      durationArray.reverse();
      if (durationArray[1]) duration += durationArray[1] * 60000;
      if (durationArray[2]) duration += durationArray[2] * 3600000;
      duration += durationArray[0] * 1000;
      return duration;
    }
  } catch (e) {
  }
  return 0;
}

export {
  formatDuration,
  linkFormatter,
  convertSeekFormatToSec,
  removeFormattingLink,
  universalLinkFormatter,
  convertYTFormatToMS
};
