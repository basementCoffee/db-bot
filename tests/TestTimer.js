/**
 * Class to set and end timers for debugging.
 */
class TestTime {
  timerMap;

  constructor () {
    this.timerMap = new Map();
  }

  startTimer (id) {
    if (!id) {
      throw new Error('invalid id');
    }
    if (this.timerMap.get(id)) {
      console.log(`timer already started for [${id}]\nrestarting timer...`);
    }
    const currentDate = Date.now();
    this.timerMap.set(id, currentDate);
    return currentDate;
  }

  endTimer (id) {
    if (!id || !this.timerMap.get(id)) throw new Error('invalid id');
    const timeElapsed = Date.now() - this.timerMap.get(id);
    console.log(`time for [${id}]: ${timeElapsed} `);
    this.timerMap.delete(id);
    return timeElapsed;
  }

}

const tt = new TestTime();

module.exports = tt;