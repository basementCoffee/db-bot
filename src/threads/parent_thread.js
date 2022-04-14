// Write Javascript code here
const cp = require('child_process');
let child = cp.fork(__dirname + '/child_thread.js');
const processStats = require('../utils/process/ProcessStats');

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
  console.log(closeMsg);
});

module.exports = {parent_thread};