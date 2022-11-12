const { startupDevMode } = require('./constants');
const LocalServer = require('./LocalServer');

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
   * @param server {LocalServer} The server metadata.
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
    this.servers.set(mgid, new LocalServer(mgid));
  }
}

module.exports = new ProcessStats();
