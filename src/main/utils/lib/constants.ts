// the max size of the queue
import { Client, GatewayIntentBits, Partials } from 'discord.js';

// the db bot instance
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});
// the id of the bot
const botID = '987108278486065283';
// the sheet-name for the list of prefixes in the database
const PREFIX_SN = 'prefixes-vibe';
// boolean for dev process - used for debugging, default is false
const startupDevMode = process.argv.includes('--dev');
// true if 'test' flag is active
const startupTest = process.argv.includes('--test');
// max queue size
const MAX_QUEUE_S = 500;
// max key length
const MAX_KEY_LENGTH = 30;
// active process interval (9min)
const checkActiveMS = 540000;
// number of active processes
const setOfBotsOn = new Set();
// commands frequency
const commandsMap = new Map<string, number>();
// What's playing, uses voice channel id
const whatspMap = new Map<string, string>();
// open.spotify.com
const SPOTIFY_BASE_LINK = 'open.spotify.com';
// soundcloud.com
const SOUNDCLOUD_BASE_LINK = 'soundcloud.com';
// twitch.tv
const TWITCH_BASE_LINK = 'twitch.tv';
// 45 minutes
const LEAVE_VC_TIMEOUT = 2700000;
// a zero-width space, useful for preventing responses from becoming commands
const ZWSP = '​';
// z, k, b
const ADMINS = Object.freeze(['443150640823271436 ', '268554823283113985 ', '987108278486065283 ']);
const CORE_ADM = Object.freeze(['443150640823271436', '268554823283113985']);

/**
 * Enum - Acceptable link sources.
 * @type {{TWITCH: string, SOUNDCLOUD: string, SPOTIFY: string, YOUTUBE: string}}
 */
enum StreamType {
  'SOUNDCLOUD' = 'sc',
  'SPOTIFY' = 'sp',
  'YOUTUBE' = 'yt',
  'TWITCH' = 'tw'
}

const INVITE_LINK = 'https://discord.com/oauth2/authorize?client_id=987108278486065283&permissions=1076288&scope=bot';
const INVITE_MSG = `Here's the invite link!\n<${INVITE_LINK}>`;
const DB_BOT_ICON_MED = 'https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/dbBotIconMedium.jpg';

const DB_SPOTIFY_EMBED_ICON = 'https://github.com/Reply2Zain/db-bot/blob/master/assets/dbBotspotifyIcon.jpg?raw=true';

export {
  ADMINS,
  MAX_QUEUE_S,
  bot,
  checkActiveMS,
  setOfBotsOn,
  commandsMap,
  whatspMap,
  botID,
  SPOTIFY_BASE_LINK,
  SOUNDCLOUD_BASE_LINK,
  TWITCH_BASE_LINK,
  LEAVE_VC_TIMEOUT,
  StreamType,
  startupDevMode,
  CORE_ADM,
  MAX_KEY_LENGTH,
  INVITE_MSG,
  PREFIX_SN,
  startupTest,
  ZWSP,
  DB_BOT_ICON_MED,
  DB_SPOTIFY_EMBED_ICON
};