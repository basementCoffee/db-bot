/**
 * Class to set and end a stopwatch. Is for debugging purposes.
 */
class StopwatchTest {
  stopwatchMap;

  constructor () {
    this.stopwatchMap = new Map();
  }

  startStopwatch (id) {
    if (!id) {
      throw new Error('invalid id');
    }
    if (this.stopwatchMap.get(id)) {
      console.log(`stopwatch already started for [${id}]\nrestarting stopwatch...`);
    }
    const currentDate = Date.now();
    this.stopwatchMap.set(id, currentDate);
    return currentDate;
  }

  endStopwatch (id) {
    if (!id || !this.stopwatchMap.get(id)) throw new Error('invalid id');
    const timeElapsed = Date.now() - this.stopwatchMap.get(id);
    console.log(`time for [${id}]: ${timeElapsed} `);
    this.stopwatchMap.delete(id);
    return timeElapsed;
  }

}

module.exports = new StopwatchTest();
