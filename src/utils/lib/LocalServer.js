const { AudioImpl } = require('./AudioImpl');

class LocalServer {
  guildId;
  // now playing is the first element
  queue;
  // newest items are pushed
  queueHistory;
  /*
    a log of completed links and their metadata
    Map<url, {queueItem, numOfPlays: number}>
     */
  mapFinishedLinks;
  // continue playing after queue end
  autoplay;
  // boolean status of looping
  loop;
  // the number of items sent since embed generation
  numSinceLastEmbed;
  // the embed message
  currentEmbed;
  // the collector for the current embed message
  collector;
  // the playback status message
  followUpMessage;
  // the id of the channel for now-playing embeds
  currentEmbedChannelId;
  // boolean status of verbose mode - save embeds on true
  verbose;
  // A list of vote admins (members) in a server
  voteAdmin;
  // the ids of members who voted to skip
  voteSkipMembersId;
  // the ids of members who voted to rewind
  voteRewindMembersId;
  // the ids of members who voted to play/pause the link
  votePlayPauseMembersId;
  // locks the queue for dj mode
  lockQueue;
  // The member that is the acting dictator
  dictator;
  // If a start-up message has been sent
  startUpMessage;
  // the timeout IDs for the bot to leave a VC
  leaveVCTimeout;
  // the number of consecutive playback errors
  skipTimes;
  // a map of user ids to an active query message [id => Message]
  activeUserQuestion;
  // persistent user settings
  userSettings;
  // the specific server's audio class
  audio;
  // properties pertaining to the active stream
  streamData = {
    // the StreamType enum
    type: undefined,
    // the readable stream
    stream: undefined,
    // urlAlt is added if it's a YT stream
  };
  // if a twitch notification was sent
  twitchNotif = {
    t: undefined,
    er: undefined,
  };
  // hold a ready-to-go function in case of vc join
  seamless = {
    // the name of the type of function
    function: undefined,
    // args for the function
    args: undefined,
    // optional message to delete
    message: undefined,
  };
  // [id, xdb]
  // use getXdb2() for user data
  userKeys;
  // the server's prefix
  prefix;
  // the timeout for the YT search results
  searchReactionTimeout;
  // the timer for the active DJ
  djTimer = {
    timer: undefined,
    startTime: undefined,
    duration: undefined,
  };
  // the last time a DJ tip was sent to a group
  djMessageDate;
  // error manager - keep track of errors
  errors = {
    // if a reaction permissions error occurred
    permissionReaction: undefined,
  };

  /**
   * Constructor for LocalServer.
   * @param guildId {string} The id of the server.
   */
  constructor(guildId) {
    this.guildId = guildId;
    this.queue = [];
    this.queueHistory = [];
    this.mapFinishedLinks = new Map();
    this.autoplay = false;
    this.loop = false;
    this.numSinceLastEmbed = 0;
    this.currentEmbed = undefined;
    this.collector = undefined;
    this.followUpMessage = undefined;
    this.currentEmbedChannelId = undefined;
    this.verbose = false;
    this.voteAdmin = [];
    this.voteSkipMembersId = [];
    this.voteRewindMembersId = [];
    this.votePlayPauseMembersId = [];
    this.lockQueue = false;
    this.dictator = false;
    this.startUpMessage = false;
    this.leaveVCTimeout = false;
    this.skipTimes = 0;
    this.activeUserQuestion = new Map();
    this.userSettings = new Map();
    this.audio = new AudioImpl();
    this.streamData = {
      type: null,
      stream: null,
    };
    this.twitchNotif = {
      t: false,
      er: false,
    };
    this.seamless = {
      function: undefined,
      args: undefined,
      message: undefined,
    };
    this.userKeys = new Map();
    this.prefix = undefined;
    this.searchReactionTimeout = undefined;
    this.djTimer = {
      timer: false,
      startTime: false,
      duration: 1800000,
    };
    this.djMessageDate = false;
    this.errors = {
      permissionReaction: false,
    };
  }
}

module.exports = LocalServer;
