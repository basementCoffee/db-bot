#!/usr/bin/env node
const pm2 = require('pm2');
const { exec } = require('child_process');
const name = process.argv[2] || 'vibe';

// wait time before checking PM2's status
const WAIT_TIME = 12000;
// the maximum number of PM2 restarts allowed
const MAX_RESTARTS = 5;
// The last supported version that this project can be safely rolled back to
const MIN_SUPPORTED_VERSION = '8.4.0';

pm2.connect(async function(err) {
  if (err) {
    console.error(err);
    process.exit(2);
  }
  console.log(`determining pm2 process health of ${name}....`);
  await new Promise((res) => setTimeout(res, WAIT_TIME));
  pm2.list(function(err, processes) {
    if (err) throw err;
    processes = processes.filter((x) => x.name === name);

    processes.forEach(function(process) {
      if (process.pm2_env.restart_time > MAX_RESTARTS) {
        console.log(`[ERROR] process is in bad standing {restarts: ${process.pm2_env.restart_time}}`);
        // The current program version in this project [major | minor | patch]
        const currentVersionArr = process.pm2_env.version.split('.').map((x) => Number(x));
        // The last supported version [major | minor | patch]
        const supportedVersionArr = MIN_SUPPORTED_VERSION.split('.').map((x) => Number(x));
        const isOutdated = (num) => {
          if (!currentVersionArr[num]) return false;
          // positive when current version section is larger than supported version section
          const difference = currentVersionArr[num] - supportedVersionArr[num];
          if (difference < 0) {
            return true;
          }
          else if (difference === 0) {
            return isOutdated(num + 1);
          }
          else {return false;}
        };
        if (isOutdated(0)) {
          console.log('version too old to rollback');
        }
        else {
          console.log('attempting rollback...');
          const fileName = 'getCommitIds.bash';
          exec(`bash scripts/${fileName}`, (err, commitId, stderr) => {
            if (err) console.log('there was an error getting the previous commit id:\n', err);
            if (stderr) console.log(`there was an error in ${fileName}:\n`, stderr);
            console.log(commitId);
            exec('git stash', (err2, stdout2, stderr2) => {
              if (!stderr2 && !err2) {
                exec(`git reset --hard ${commitId.trim()} && npm run pm2`);
              }
            });
          });
        }
      }
      else {
        console.log('[PASS] process is in good standing');
      }
    });
    pm2.disconnect();
  });
});
