const {setOfBotsOn, bot} = require('../utils/process/constants');
const CH = require('../../channel.json');
const processStats = require('../utils/process/ProcessStats');
const buildNo = require('../utils/process/BuildNumber');
const {shutdown} = require('../utils/shutdown');
const {gsrun} = require('../commands/database/api/api');

let resHandlerTimeout = null;

/**
 * Sends a message to a shared channel to see all active processes, responds accordingly using responseHandler.
 */
function checkToSeeActive () {
  setOfBotsOn.clear();
  // see if any bots are active
  // noinspection JSUnresolvedFunction
  bot.channels.fetch(CH.process).then(channel => channel.send('=gzk').then(() => {
    if (!resHandlerTimeout) resHandlerTimeout = setTimeout(responseHandler, 9000);
  }));
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 */
async function responseHandler () {
  resHandlerTimeout = null;
  if (setOfBotsOn.size < 1 && processStats.isInactive) {
    processStats.servers.clear();
    const xdb = await gsrun('A', 'B', 'prefixes');
    for (const [gid, pfx] of xdb.congratsDatabase) {
      processStats.initializeServer(gid);
      processStats.servers.get(gid).prefix = pfx;
    }
    processStats.setProcessActive();
    processStats.devMode = false;
    // noinspection JSUnresolvedFunction
    bot.channels.fetch(CH.process)
      .then(channel => channel.send('~db-process-off' + buildNo.getBuildNo() + '-' + process.pid.toString()));
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 18) + 9) * 1000)); // 9 - 27 seconds
  } else if (setOfBotsOn.size > 1) {
    setOfBotsOn.clear();
    // noinspection JSUnresolvedFunction
    bot.channels.fetch(CH.process)
      .then(channel => channel.send('~db-process-off' + buildNo.getBuildNo() + '-' + process.pid.toString()));
    setTimeout(() => {
      if (processStats.isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 5) + 3) * 1000)); // 3 - 7 seconds
  } else if (process.pid === 4) {
    if ((new Date()).getHours() === 5 && bot.uptime > 3600000 && bot.voice.connections.size < 1) {
      shutdown('HOUR(05)');
    }
  }
}

module.exports = {checkToSeeActive};