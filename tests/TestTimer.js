class TestTime {
  timerMap;
  constructor () {
    this.timerMap = new Map();
  }
  startTimer (id) {
    if (!id || this.timerMap.get(id)) throw new Error('invalid id');
    this.timerMap.set(id, Date.now());
  }

  endTimer (id) {
    if (!id || !this.timerMap.get(id)) throw new Error('invalid id');
    const timeElapsed = Date.now() - this.timerMap.get(id);
    console.log(`time for [${id}]: ${timeElapsed} `);
    this.timerMap.delete(id);
  }

}

const tt = new TestTime();

module.exports = tt;