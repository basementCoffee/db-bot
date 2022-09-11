const processStats = require('./utils/ProcessStats');
const {checkToSeeActive} = require('./checkToSeeActive');
const {checkActiveMS} = require('../utils/process/constants');

// a standard controller to handle functions involving process management
class ProcessController {
  /**
   * Sets the process as inactive, enables the 'checkActiveInterval' to ensure that a process is active.
   */
  setProcessInactive() {
    processStats.setProcessInactive();
    if (!processStats.checkActiveInterval) {
      processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
    }
  }
}

module.exports = new ProcessController();
