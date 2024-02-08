import processStats from '../utils/lib/ProcessStats';

module.exports = async (e: Error) => {
  console.log('BOT ERROR:\n', e);
  processStats.logError(`BOT ERROR: ${processStats.devMode ? '(development)' : ''}:\n${e.stack}`);
};
