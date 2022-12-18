const { startupDevMode } = require('./constants');
const LocalServer = require('./LocalServer');
const { formatDuration } = require('../formatUtils');

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
  devMode;
  // if the process is sidelined
  isInactive;
  // A message for users on first VC join
  startUpMessage = '';
  // list of server playback metadata
  servers = new Map();
  // the interval to view the active process
  checkActiveInterval;
  // is null | XDB of the server prefixes. (see database/api for XDB reference)
  serverPrefixes;
  // a logging function for debugging
  debugFunc;

  // may run multiple times, once per thread
  constructor() {
    if (startupDevMode) {
      this.setDevMode(true);
      this.isInactive = false;
    }
    else {
      this.setDevMode(false);
      this.isInactive = true;
    }
  }

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
   * Sets the status of devMode.
   * @param status {boolean} Whether to set devMode on or off.
   */
  setDevMode(status) {
    this.devMode = status;
    if (status) {
      this.debugFunc = (...args) => {
        console.log(...args);
      };
    }
    else {
      this.debugFunc = () => {};
    }
    console.log(`-devMode ${status ? 'on' : 'off'}-`);
  }

  /**
   * Used for logging during debugging. Should only log when in devMode (not in production).
   * @param args {...any} Arguments to log.
   */
  debug(...args) {
    this.debugFunc(...args);
  }

  /**
   * This method SHOULD be used instead of connection.disconnect. It will properly clean up the dispatcher and
   * the player.
   * @param server {LocalServer} The server metadata.
   */
  disconnectConnection(server) {
    server.audio.reset();
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
   * Retrieves the server for the provided guid id. Creates a new server if one does not exist.
   * @param guildId {string} The guild id.
   * @returns {LocalServer} The LocalServer object for the guild.
   */
  getServer(guildId) {
    let localServer = this.servers.get(guildId);
    if (!localServer) {
      localServer = new LocalServer(guildId);
      this.servers.set(guildId, localServer);
    }
    return localServer;
  }

  /**
   * Get the amount of time that this process has been active as a formatted string.
   * @returns {string}
   */
  getTimeActive() {
    if (this.dateActive) {
      return formatDuration(this.activeMS + Date.now() - this.dateActive);
    }
    else {
      return formatDuration(this.activeMS);
    }
  }
}

module.exports = new ProcessStats();
