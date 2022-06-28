const {Worker} = require('worker_threads');
const processStats = require('../utils/process/ProcessStats');
const {logError} = require('../utils/utils');
let worker = new Worker(__dirname + '/worker.js');

/**
 * Send computationally heavy commands to a worker process.
 * @param commandName {string} A unique name/id of the command to execute. This name should be expected by the worker.
 * @param messageId {string} The message id.
 * @param channelId {string} The channel id.
 * @param commandArgs {any} A list of arguments to pass to a function.
 */
function parent_thread (commandName, messageId, channelId, commandArgs = []) {
  worker.postMessage({
    content: {
      commandName,
      messageId: messageId,
      channelId: channelId,
      commandArgs: commandArgs
    }
  });
}

function initialize () {
  // what is received by the worker thread
  worker.on('message', function (m) {
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

module.exports = {parent_thread};
