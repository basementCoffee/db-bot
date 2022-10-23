const {startupDevMode} = require('./constants');
const {AudioImpl} = require('./AudioImpl');

// process related statistics
class ProcessStats {
  // total time active in MS
  activeMS = 0;
  // if active, the current Date.now()
  dateActive;
  // total streaming time
  totalStreamTime = 0;
  // map of active streams [guildId , Date.now()]
  activeStreamsMap = new Map();
  // if in developer mode
  devMode = startupDevMode;
  // if the process is sidelined
  isInactive = !startupDevMode;
  // A message for users on first VC join
  startUpMessage = '';
  // list of server playback metadata
  servers = new Map();
  // the interval to view the active process
  checkActiveInterval;
  // is null | XDB of the server prefixes. (see database/api for XDB reference)
  serverPrefixes;

  constructor() {}

  // adds an active stream
  addActiveStream(gid) {
    this.activeStreamsMap.set(gid, Date.now());
  }

  // remove an active stream
  removeActiveStream(gid) {
    const streamStart = this.activeStreamsMap.get(gid);
    if (streamStart) {
      this.totalStreamTime += Date.now() - streamStart;
      this.activeStreamsMap.delete(gid);
    }
  }

  addActiveStreamIfNoneExists(gid) {
    if (!this.activeStreamsMap.has(gid)) {
      this.addActiveStream(gid);
    }
  }

  getActiveStreamSize() {
    return this.activeStreamsMap.size;
  }

  /**
   * Gets the total stream time in milliseconds
   * @returns {number}
   */
  getTotalStreamTime() {
    let activeTimes = 0;
    this.activeStreamsMap.forEach((val) => {
      activeTimes += Date.now() - val;
    });
    return (this.totalStreamTime + activeTimes);
  }

  /**
   * Sets the process as inactive.
   * This does NOT activate 'checkToSeeActive' interval, which ensures that an active process is up.
   */
  setProcessInactive() {
    this.serverPrefixes = null;
    this.isInactive = true;
    console.log('-sidelined-');
    if (this.dateActive) {
      this.activeMS += Date.now() - this.dateActive;
      this.dateActive = null;
    }
  }

  /**
   * This method SHOULD be used instead of connection.disconnect. It will properly clean up the dispatcher and
   * the player.
   * @param server The server metadata.
   * @param connection The voice connection.
   */
  disconnectConnection(server, connection) {
    server.audio.reset();
    connection?.disconnect();
    this.removeActiveStream(server.guildId);
  }

  /**
   * Sets the process as active.
   */
  setProcessActive() {
    this.servers.clear();
    this.isInactive = false;
    console.log('-active-');
    this.dateActive = Date.now();
  }

  /**
   * Initializes the server with all the required params.
   * @param mgid The message guild id.
   */
  initializeServer(mgid) {
    this.servers.set(mgid, {
      guildId: mgid,
      // now playing is the first element
      queue: [],
      // newest items are pushed
      queueHistory: [],
      /*
      a log of completed links and their metadata
      Map<url, {queueItem, numOfPlays: number}>
       */
      mapFinishedLinks: new Map(),
      // continue playing after queue end
      autoplay: false,
      // boolean status of looping
      loop: false,
      // the number of items sent since embed generation
      numSinceLastEmbed: 0,
      // the embed message
      currentEmbed: undefined,
      // the collector for the current embed message
      collector: false,
      // the playback status message
      followUpMessage: undefined,
      // the id of the channel for now-playing embeds
      currentEmbedChannelId: undefined,
      // boolean status of verbose mode - save embeds on true
      verbose: false,
      // A list of vote admins (members) in a server
      voteAdmin: [],
      // the ids of members who voted to skip
      voteSkipMembersId: [],
      // the ids of members who voted to rewind
      voteRewindMembersId: [],
      // the ids of members who voted to play/pause the link
      votePlayPauseMembersId: [],
      // locks the queue for dj mode
      lockQueue: false,
      // The member that is the acting dictator
      dictator: false,
      // If a start-up message has been sent
      startUpMessage: false,
      // the timeout IDs for the bot to leave a VC
      leaveVCTimeout: false,
      // the number of consecutive playback errors
      skipTimes: 0,
      // a map of user ids to an active query message [id => Message]
      activeUserQuestion: new Map(),
      // persistent user settings
      userSettings: new Map(),
      // the specific server's audio class
      audio: new AudioImpl(),
      // properties pertaining to the active stream
      streamData: {
        // the StreamType enum
        type: null,
        // the readable stream
        stream: null,
        // urlAlt is added if it's a YT stream
      },
      // if a twitch notification was sent
      twitchNotif: {
        isSent: false,
        isTimer: false,
      },
      // hold a ready-to-go function in case of vc join
      seamless: {
        // the name of the type of function
        function: undefined,
        // args for the function
        args: undefined,
        // optional message to delete
        message: undefined,
      },
      // [id, xdb]
      // use getXdb2() for user data
      userKeys: new Map(),
      // the server's prefix
      prefix: undefined,
      // the timeout for the YT search results
      searchReactionTimeout: undefined,
      // the timer for the active DJ
      djTimer: {
        timer: false,
        startTime: false,
        duration: 1800000,
      },
      // the last time a DJ tip was sent to a group
      djMessageDate: false,
      // error manager - keep track of errors
      errors: {
        // if a reaction permissions error occurred
        permissionReaction: false
      }
    });
  }
}

module.exports = new ProcessStats();
