import { Channel, TextBasedChannel } from "discord.js";
import { bot, PREFIX_SN, setOfBotsOn } from "../utils/lib/constants";
import processStats from "../utils/lib/ProcessStats";
import buildNumber from "../utils/lib/BuildNumber";
import { gsrun } from "../database/api/api";
import config from "../../../config.json";

let resHandlerTimeout: NodeJS.Timeout | null = null;

/**
 * Sends a message to a shared channel to see all active processes, responds accordingly using responseHandler.
 */
function checkToSeeActive() {
  setOfBotsOn.clear();
  // see if any bots are active
  // noinspection JSUnresolvedFunction
  bot.channels.fetch(config.process).then((channel: Channel | null) =>
    (<TextBasedChannel>channel).send("=gzk").then(() => {
      processStats.isPendingStatus = true;
      // Active bots should populate the setOfBotsOn set.
      if (!resHandlerTimeout) resHandlerTimeout = setTimeout(responseHandler, 11000);
    })
  );
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 */
async function responseHandler() {
  resHandlerTimeout = null;
  if (!processStats.isPendingStatus) return;
  if (setOfBotsOn.size < 1 && processStats.isInactive) {
    await becomeActiveProcess();
    // waits 9 - 27 seconds
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, (Math.floor(Math.random() * 18) + 9) * 1000);
  } else if (setOfBotsOn.size > 1) {
    await becomeActiveProcess();
    // waits 3 - 7 seconds
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, (Math.floor(Math.random() * 5) + 3) * 1000);
  }
}

/**
 * Computation to become the main active process.
 * @returns {Promise<void>}
 */
async function becomeActiveProcess() {
  processStats.setProcessActive();
  processStats.setDevMode(false);
  // noinspection JSUnresolvedFunction
  bot.channels.fetch(config.process).then((channel: Channel | null) => {
    (<TextBasedChannel>channel).send("~db-process-off" + buildNumber.getBuildNo() + "-" + process.pid.toString());
  });
  const xdb = await gsrun("A", "B", PREFIX_SN);
  for (const [gid, pfx] of xdb.congratsDatabase) {
    processStats.getServer(gid).prefix = pfx;
  }
}

export { checkToSeeActive };
