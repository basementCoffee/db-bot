import processStats from '../utils/lib/ProcessStats';
import { checkToSeeActive } from './checkToSeeActive';
import { checkActiveMS } from '../utils/lib/constants';

/**
 * Sets the process as inactive, enables the 'checkActiveInterval' to ensure that a process is active.
 */
export function setProcessInactiveAndMonitor() {
  processStats.setProcessInactive();
  if (!processStats.checkActiveInterval) {
    processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
  }
}
