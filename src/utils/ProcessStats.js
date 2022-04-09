
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

  constructor () {
    this.activeMS = 0;
    this.dateActive = null;
    this.totalStreamTime = 0;
    // [gid] => Date.now()
    this.activeStreamsMap = new Map();
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

}

module.exports = new ProcessStats();