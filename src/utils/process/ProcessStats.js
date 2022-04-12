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

  constructor () {
    this.activeMS = 0;
    this.dateActive = null;
    this.totalStreamTime = 0;
    // [gid] => Date.now()
    this.activeStreamsMap = new Map();
    this.devMode = startupDevMode;
    this.isInactive = !startupDevMode;
    this.startUpMessage = '';
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
}

module.exports = new ProcessStats();