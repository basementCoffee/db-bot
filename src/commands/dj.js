const {MessageEmbed} = require('discord.js');
const {formatDuration, botInVC, notInVoiceChannelErrorMsg, getVCMembers} = require('../utils/utils');

/**
 * Run the command to enable a music mode allowing only one user to control music commands in a server.
 * @param message The message metadata
 * @param mgid The message guild id
 * @param prefixString The prefix string for the guild
 * @param server The server playback metadata
 * @returns {*}
 */
function runDictatorCommand(message, mgid, prefixString, server) {
  if (!(botInVC(message) && message.member.voice && message.member.voice.channel)) {
    return message.channel.send(notInVoiceChannelErrorMsg(message.guild));
  }
  const vcMembersId = getVCMembers(mgid).map((x) => x.id);
  if (!vcMembersId.includes(message.member.id)) return message.channel.send(notInVoiceChannelErrorMsg(message.guild));
  if (server.voteAdmin.length > 0) {
    return message.channel.send('cannot have a dictator while there is a DJ');
  }
  if (server.dictator) {
    if (server.dictator === message.member) {
      return message.channel.send('***You are the dictator.*** *If you want to forfeit your powers say \`' + prefixString + 'resign\`*');
    } else {
      const dic = server.dictator;
      for (const i of vcMembersId) {
        if (i === dic.id) {
          return message.channel.send((dic.nickname ? dic.nickname : dic.user.username) + ' is the dictator, and has control over ' +
            (message.guild.me.nickname ? message.guild.me.nickname : message.guild.me.user.username));
        }
      }
      server.dictator = message.member;
      message.channel.send('The dictator is missing! ***' + (message.member.nickname ?
        message.member.nickname : message.member.user.username) + ' is now the new dictator.***');
    }
  } else {
    server.dictator = message.member;
    message.channel.send('***' + (message.member.nickname ?
      message.member.nickname : message.member.user.username) + ', you are the dictator.***');
  }
  const dictatorEmbed = new MessageEmbed();
  dictatorEmbed.setTitle('Dictator Commands')
    .setDescription('\`resign\` - forfeit being dictator')
    .setFooter('The dictator has control over all music commands for the session. Enjoy!');
  message.channel.send({embeds: [dictatorEmbed]});
}

/**
 * Creates the DJ timer.
 * @param message The message for channel info
 * @param server The server info
 * @param duration The duration of the timer
 */
function createDJTimer(message, server, duration) {
  clearDJTimer(server);
  server.djTimer.timer = setTimeout(() => {
    const mem = server.voteAdmin[0];
    let resignMsg;
    if (message.guild.voice.channel.members.map((x) => x.id).includes(mem.id)) {
      resignMsg = '*Time\'s up: ' + (mem.nickname ? mem.nickname : mem.user.username) + ' is no longer the DJ.*\n';
    } else {
      resignMsg = '*No DJ detected.*\n';
    }
    server.voteAdmin.pop();
    if (server.voteAdmin.length < 1) {
      server.voteSkipMembersId = [];
      server.voteRewindMembersId = [];
      server.votePlayPauseMembersId = [];
      server.lockQueue = false;
      resignMsg += '***DJ mode disabled.***';
    }
    message.channel.send(resignMsg);
    server.djTimer.timer = false;
  }, duration);
  server.djTimer.startTime = Date.now();
  server.djTimer.duration = duration;
}

/**
 * Clears the DJ timer.
 * @param {*} server The server object.
 */
function clearDJTimer(server) {
  if (server.djTimer.timer) {
    clearTimeout(server.djTimer.timer);
    server.djTimer.timer = false;
  }
}

/**
 * Get the time left for a timer.
 * @param duration The total duration of the timer in ms.
 * @param startTime The Date.now() representing when the timer began.
 * @returns {string} A string representing a formatted duration of how much time is left.
 */
function getTimeLeft(duration, startTime) {
  return formatDuration(Math.abs(Date.now() - startTime - duration));
}

/**
 * Handles the validation and provision of DJ permissions to members within a server.
 * @param message The message metadata
 * @param server The server playback metadata
 * @returns {*}
 */
function runDJCommand(message, server) {
  if (!botInVC(message) || !message.member.voice || !message.member.voice.channel) {
    return message.channel.send(notInVoiceChannelErrorMsg(message.guild));
  }
  const vcMembersId = getVCMembers(message.guild.id).map((x) => x.id).map((x) => x.id);
  if (!vcMembersId.includes(message.member.id)) return message.channel.send(notInVoiceChannelErrorMsg(message.guild));
  if (server.dictator) return message.channel.send('There is a dictator, cannot enable DJ mode.');
  if (server.voteAdmin.length < 1) {
    server.voteAdmin.push(message.member);
    const dj = (message.member.nickname ? message.member.nickname : message.member.user.username);
    message.channel.send('***DJ mode has been enabled for this session (DJ: ' + dj + ')*** *[30 min]*');
    createDJTimer(message, server, 1800000);
  } else {
    let ix = 0;
    let newMemAdded = false;
    for (const x of server.voteAdmin) {
      if (!vcMembersId.includes(x.id)) {
        let oldMem = server.voteAdmin[ix];
        oldMem = (oldMem.nickname ? oldMem.nickname : oldMem.user.username);
        if (!newMemAdded) {
          let newMem = message.member;
          server.voteAdmin[ix] = newMem;
          newMem = (newMem.nickname ? newMem.nickname : newMem.user.username);
          message.channel.send('*DJ ' + oldMem + ' is missing.* ***' + newMem + ' is now the new DJ.***');
          createDJTimer(message, server, 1800000);
          newMemAdded = true;
        } else {
          message.channel.send('*DJ ' + oldMem + ' is also missing and has forfeit being DJ*');
        }
      }
      ix++;
    }
    const currentAdmin = server.voteAdmin[0];
    message.channel.send('***' + (currentAdmin.nickname ? currentAdmin.nickname : currentAdmin.user.username) + ' is ' +
      'the DJ.*** *(' + getTimeLeft(server.djTimer.duration, server.djTimer.startTime).split(' ')[0] + ' remaining)*');
  }
  const msgEmbed = new MessageEmbed();
  msgEmbed.setTitle('DJ Commands').setDescription('\`forceskip\` - force skip a track [fs]\n' +
    '\`forcerewind\`- force rewind a track [fr]\n' +
    '\`force[play/pause]\` - force play/pause a track f[pl/pa]\n' +
    '\`lock-queue\` - Prevent the queue from being added to [toggle]\n' +
    '\`resign\` - forfeit DJ permissions')
    .setFooter('DJ mode requires users to vote to skip, rewind, play, and pause tracks. ' +
      'The DJ can override voting by using the force commands above.');
  message.channel.send({embeds: [msgEmbed]});
}

/**
 * Resigns the active DJ. Uses message.member.
 * @param message The message metadata.
 * @param server The server.
 */
function runResignCommand(message, server) {
  if (!server.voteAdmin.length && !server.dictator) {
    message.channel.send('There is no DJ or dictator right now');
  } else if (server.dictator) {
    if (message.member.id === server.dictator.id) {
      server.dictator = false;
      message.channel.send((message.member.nickname ? message.member.nickname : message.member.user.username) +
        ' has resigned from being the dictator!');
    } else {
      message.channel.send('Only the dictator can resign');
    }
  } else if (server.voteAdmin.includes(message.member)) {
    server.voteAdmin.splice(server.voteAdmin.findIndex((val) => val.id === message.member.id), 1);
    let resignMsg = (message.member.nickname ? message.member.nickname : message.member.user.username) +
      ' has resigned from being DJ.';
    if (server.voteAdmin.length < 1) {
      server.voteSkipMembersId = [];
      server.voteRewindMembersId = [];
      server.votePlayPauseMembersId = [];
      server.lockQueue = false;
      resignMsg += ' DJ mode disabled.';
    }
    message.channel.send(resignMsg);
  } else {
    message.channel.send('Only the DJ can resign');
  }
}

module.exports = {runDictatorCommand, runDJCommand, clearDJTimer, runResignCommand};
