const { setOfBotsOn, bot, PREFIX_SN } = require('../utils/lib/constants');
const CH = require('../../channel.json');
const processStats = require('../utils/lib/ProcessStats');
const buildNo = require('../utils/lib/BuildNumber');
const { gsrun } = require('../database/api/api');

let resHandlerTimeout = null;

/**
 * Sends a message to a shared channel to see all active processes, responds accordingly using responseHandler.
 */
function checkToSeeActive() {
  setOfBotsOn.clear();
  // see if any bots are active
  // noinspection JSUnresolvedFunction
  bot.channels.fetch(CH.process).then((channel) => channel.send('=gzk').then(() => {
    processStats.isPendingStatus = true;
    // Active bots should populate the setOfBotsOn set.
    if (!resHandlerTimeout) resHandlerTimeout = setTimeout(responseHandler, 11000);
  }));
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 */
async function responseHandler() {
  if (!processStats.isPendingStatus) return;
  resHandlerTimeout = null;
  if (setOfBotsOn.size < 1 && processStats.isInactive) {
    processStats.servers.clear();
    const xdb = await gsrun('A', 'B', PREFIX_SN);
    for (const [gid, pfx] of xdb.congratsDatabase) {
      processStats.getServer(gid).prefix = pfx;
    }
    processStats.setProcessActive();
    processStats.setDevMode(false);
    // noinspection JSUnresolvedFunction
    bot.channels.fetch(CH.process)
      .then((channel) => channel.send('~db-process-off' + buildNo.getBuildNo() + '-' + process.pid.toString()));
    // waits 9 - 27 seconds
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 18) + 9) * 1000));
  }
  else if (setOfBotsOn.size > 1) {
    setOfBotsOn.clear();
    // noinspection JSUnresolvedFunction
    bot.channels.fetch(CH.process)
      .then((channel) => channel.send('~db-process-off' + buildNo.getBuildNo() + '-' + process.pid.toString()));
    // waits 3 - 7 seconds
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 5) + 3) * 1000));
  }
}

module.exports = { checkToSeeActive };
