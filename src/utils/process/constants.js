// the max size of the queue
const {Client} = require('discord.js');
// the db bot instance
const bot = new Client();
// the id of the bot
const botID = '730350452268597300';
// boolean for dev process - used for debugging, default is false
let startupDevMode = process.argv[2] === '--dev';
// max queue size
const MAX_QUEUE_S = 500;
// max key length
const MAX_KEY_LENGTH = 30;
// active process interval (9min)
const checkActiveMS = 540000;
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
// open.spotify.com
const SPOTIFY_BASE_LINK = 'open.spotify.com';
// soundcloud.com
const SOUNDCLOUD_BASE_LINK = 'soundcloud.com';
// twitch.tv
const TWITCH_BASE_LINK = 'twitch.tv';
// 45 minutes
const LEAVE_VC_TIMEOUT = 2700000;
const CORE_ADM = Object.freeze(['443150640823271436', '268554823283113985']); // z, k
/**
 * Enum - Acceptable link sources.
 * @type {{TWITCH: string, SOUNDCLOUD: string, SPOTIFY: string, YOUTUBE: string}}
 */
const StreamType = {
  SOUNDCLOUD: 'sc',
  SPOTIFY: 'sp',
  YOUTUBE: 'yt',
  TWITCH: 'tw'
};

const dbVibeLink = 'https://discord.com/oauth2/authorize?client_id=987108278486065283&permissions=1076288&scope=bot';
const dbBotLink = 'https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot';

module.exports = {
  MAX_QUEUE_S, bot, checkActiveMS, setOfBotsOn, commandsMap, whatspMap, dispatcherMap, dispatcherMapStatus, botID,
  SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, LEAVE_VC_TIMEOUT, StreamType, startupDevMode, CORE_ADM,
  MAX_KEY_LENGTH, dbVibeLink, dbBotLink
};
