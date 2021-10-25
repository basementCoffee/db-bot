// the max size of the queue
const {Client} = require('discord.js');
const servers = {};
// the db bot instance
const bot = new Client();
// the id of the bot
const botID = '730350452268597300';
// max queue size
const MAX_QUEUE_S = 500;
// active process timeout
const checkActiveMS = 600000;
// number of active processes
const setOfBotsOn = new Set();
// commands frequency
const commandsMap = new Map();
// What's playing, uses voice channel id
const whatspMap = new Map();
// The video stream, uses voice channel id
const dispatcherMap = new Map();
// The status of a dispatcher, either true for paused or false for playing
const dispatcherMapStatus = new Map();

module.exports = {
  MAX_QUEUE_S, servers, bot, checkActiveMS, setOfBotsOn, commandsMap, whatspMap, dispatcherMap, dispatcherMapStatus,
  botID
};
