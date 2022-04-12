const {startupDevMode} = require('./constants');

// process related statistics
class ProcessStats {
  // total time active in MS
  activeMS;
  // if active, the current Date.now()
  dateActive;
  // total streaming time
  totalStreamTime;
  // map of active streams
  activeStreamsMap;
  // if in developer mode
  devMode;
  // if the process is sidelined
  isInactive;
  // A message for users on first VC join
  startUpMessage;
  // list of server playback metadata
  servers = new Map();

  constructor () {
    this.activeMS = 0;
    this.dateActive = null;
    this.totalStreamTime = 0;
    // [gid] => Date.now()
    this.activeStreamsMap = new Map();
    this.devMode = startupDevMode;
    this.isInactive = !startupDevMode;
    this.startUpMessage = '';
    this.servers = {};
  }

  // adds an active stream
  addActiveStream (gid) {
    this.activeStreamsMap.set(gid, Date.now());
  }

  // remove an active stream
  removeActiveStream (gid) {
    const streamStart = this.activeStreamsMap.get(gid);
    if (streamStart) {
      this.totalStreamTime += Date.now() - streamStart;
      this.activeStreamsMap.delete(gid);
    }
  }

  getActiveStreamSize () {
    return this.activeStreamsMap.size;
  }

  /**
   * Gets the total stream time in milliseconds
   * @return {number}
   */
  getTotalStreamTime () {
    let activeTimes = 0;
    this.activeStreamsMap.forEach((val) => {
      activeTimes += Date.now() - val;
    });
    return (this.totalStreamTime + activeTimes);
  }

  /**
   * Sets the process as inactive.
   */
  setProcessInactive () {
    this.isInactive = true;
    console.log('-sidelined-');
    if (this.dateActive) {
      this.activeMS += Date.now() - this.dateActive;
      this.dateActive = null;
    }
  }

  /**
   * Sets the process as active.
   */
  setProcessActive () {
    this.isInactive = false;
    console.log('-active-');
    this.dateActive = Date.now();
  }

  /**
   * Initializes the server with all the required params.
   * @param mgid The message guild id.
   */
  initializeServer (mgid) {
    this.servers[mgid] = {
      // now playing is the first element
      queue: [],
      // newest items are pushed
      queueHistory: [],
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
      // properties pertaining to the active stream
      streamData: {
        // the StreamType enum
        type: null,
        // the readable stream
        stream: null
        // urlAlt is added if it's a YT stream
      },
      // if a twitch notification was sent
      twitchNotif: {
        isSent: false,
        isTimer: false
      },
      // hold a ready-to-go function in case of vc join
      seamless: {
        // the name of the type of function
        function: undefined,
        // args for the function
        args: undefined,
        // optional message to delete
        message: undefined
      },
      userKeys: new Map(),
      // the server's prefix
      prefix: undefined,
      // the timeout for the YT search results
      searchReactionTimeout: undefined,
      // the timer for the active DJ
      djTimer: {
        timer: false,
        startTime: false,
        duration: 1800000
      },
      // the last time a DJ tip was sent to a group
      djMessageDate: false
    };
  }
}

module.exports = new ProcessStats();