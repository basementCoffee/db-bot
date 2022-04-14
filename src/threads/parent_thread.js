const cp = require('child_process');
const processStats = require('../utils/process/ProcessStats');
const {logError} = require('../utils/utils');
let child;

/**
 * Send computationally heavy commands to a child process.
 * @param commandName
 * @param messageId
 * @param channelId
 * @param commandArgs
 */
function parent_thread (commandName, messageId, channelId, commandArgs = []) {
  child.send({
    content: {
      commandName,
      messageId: messageId,
      channelId: channelId,
      commandArgs: commandArgs
    }
  });
}

function initialize () {
  child = cp.fork(__dirname + '/child_thread.js');
  // what is received by the child thread
  child.on('message', function (m) {
    switch (m.content.commandName) {
      case 'lyrics':
        const server = processStats.servers[m.content.guildId];
        if (server) server.numSinceLastEmbed = 10;
        break;
    }
  });

  child.on('close', (code) => {
    const closeMsg = `child process exited with code ${code}`;
    if (code === 1) {
      initialize();
      logError(closeMsg);
    }
    console.log(closeMsg);
  });
}

initialize();

module.exports = {parent_thread};