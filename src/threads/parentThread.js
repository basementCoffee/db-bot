/* eslint-disable camelcase */
const {Worker} = require('worker_threads');
const processStats = require('../utils/lib/ProcessStats');
const {logError} = require('../utils/utils');
const worker = new Worker(__dirname + '/worker.js');

/**
 * Send computationally heavy commands to a worker process.
 * @param commandName {string} A unique name/id of the command to execute. This name should be expected by the worker.
 * @param cReqs {{channelId?: string | null, messageId?: string | null}} Data requirements for proper setup of the command args.
 * @param commandArgs {Array<any>} A list of arguments to pass to a function.
 */
function parentThread(commandName, cReqs, commandArgs = []) {
  worker.postMessage({
    content: {
      commandName,
      cReqs,
      commandArgs,
    },
  });
}

/**
 * Initializes the worker process.
 */
function initialize() {
  // what is received by the worker thread
  worker.on('message', function(m) {
    switch (m.content.commandName) {
    case 'lyrics':
      const server = processStats.servers.get(m.content.guildId);
      if (server) server.numSinceLastEmbed = 10;
      break;
    }
  });

  worker.on('exit', (code) => {
    const closeMsg = `worker process exited with code ${code}`;
    if (code === 1) {
      initialize();
      logError(closeMsg);
    }
    console.log(closeMsg);
  });
}

initialize();

module.exports = {parentThread};
