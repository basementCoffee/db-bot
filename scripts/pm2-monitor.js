#!/usr/bin/env node
const pm2 = require('pm2');
const { exec } = require('child_process');
const name = process.argv[2] || 'vibe';
const fs = require('fs');

// wait time before checking PM2's status
const WAIT_TIME = 12000;
// the maximum number of PM2 restarts allowed
const MAX_RESTARTS = 5;
// The last supported version that this project can be safely rolled back to
let minSupportedVersion = '9.0.7';
// path of where the minSupportedVersion is stored (to be stored outside the git project)
const FILE_PATH_MIN_VERSION = './.min_version_vibe.txt';

fs.readFile(FILE_PATH_MIN_VERSION, (err, contents) => {
  if (contents) {
    const minVersionInFile = contents.toString();
    if (minVersionInFile && minVersionInFile.includes('.')) {
      const diff = compareTwoVersions(minSupportedVersion, minVersionInFile);
      if (diff <= 0) {
        // if the local variable has a smaller/same version
        minSupportedVersion = minVersionInFile;
        return;
      }
    }
  }
  // if the local variable has a larger version
  fs.writeFile(FILE_PATH_MIN_VERSION, minSupportedVersion, (e) => {
    if (e) console.log(e);
  });
});

// returns a negative if versionA is smaller, 0 if they are equal, positive if version A is larger
function compareTwoVersions(versionA, versionB) {
  if (!versionA || !versionB) {
    console.error('error: mission version');
    return 0;
  }
  const versionArr1 = versionA.split('.').map((x) => Number(x));
  const versionArr2 = versionB.split('.').map((x) => Number(x));
  const smallerArraySize = versionArr1.length < versionArr2.length ? versionArr1.length : versionArr2.length;
  if (versionArr1.length !== versionArr2.length) {
    console.error('error: versions are incompatible');
  }
  const determineDifference = (num = 0) => {
    if (num > smallerArraySize) return 0;
    // positive when current version section is larger than supported version section
    const difference = versionArr1[num] - versionArr2[num];
    if (difference === 0) {
      return determineDifference(num + 1);
    } else {
      return difference;
    }
  };
  return determineDifference();
}

pm2.connect(async function (err) {
  if (err) {
    console.error(err);
    process.exit(2);
  }
  console.log(`determining pm2 process health of ${name}....`);
  await new Promise((res) => setTimeout(res, WAIT_TIME));
  pm2.list(function (err, processes) {
    if (err) throw err;
    processes = processes.filter((x) => x.name === name);

    processes.forEach(function (process) {
      if (process.pm2_env.restart_time > MAX_RESTARTS) {
        console.log(`[ERROR] process is in bad standing {restarts: ${process.pm2_env.restart_time}}`);
        const res = compareTwoVersions(process.pm2_env.version, minSupportedVersion);
        if (res > 0) {
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
        } else {
          console.log('version too old to rollback');
        }
      } else {
        console.log('[PASS] process is in good standing');
      }
    });
    pm2.disconnect();
  });
});
