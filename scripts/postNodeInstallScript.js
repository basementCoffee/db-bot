#!/usr/bin/env node
const fs = require('fs');

// async
function replaceContents(file, replacement, cb) {

  fs.readFile(replacement, (err, contents) => {
    if (err) return cb(err);
    fs.writeFile(file, contents, cb);
  });
}


replaceContents('./node_modules/ytdl-core/lib/sig.js', './scripts/ytdlCoreSig.txt', err => {
  if (err) {
    // handle errors here
    throw err;
  }
  console.log('[loaded updated ytdl-core scripts]');
});

replaceContents('./node_modules/spotify-url-info/src/index.js', './scripts/spotify-url-info-index.txt', err => {
  if (err) {
    // handle errors here
    throw err;
  }
  console.log('[loaded updated spotify-url-info scripts]');
});
