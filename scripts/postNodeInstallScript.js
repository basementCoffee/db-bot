#!/usr/bin/env node
const fs = require('fs');

// async
function replaceContents(file, replacement, cb) {
  fs.readFile(replacement, (err, contents) => {
    if (err) return cb(err);
    fs.writeFile(file, contents, cb);
  });
}

const fileReplacementCallback = (err, name) => {
  if (err) {
    console.log(`[ERROR] could not load ${name}`);
    // handle errors here
    throw err;
  } else {
    console.log(`[SUCCESS] loaded updated ${name}`);
  }
};

// replaceContents('./node_modules/ytdl-core/lib/sig.js', './scripts/textFileAssets/ytdlCoreSig.txt', (err) => {
//   fileReplacementCallback(err, 'ytdl-core scripts');
// });

replaceContents(
  './node_modules/spotify-url-info/src/index.js',
  './scripts/textFileAssets/spotify-url-info-index.txt',
  (err) => {
    fileReplacementCallback(err, 'spotify-url-info scripts');
  }
);

replaceContents('./node_modules/ytsr/lib/parseItem.js', './scripts/textFileAssets/ytsr-parseItem.txt', (err) => {
  fileReplacementCallback(err, 'ytsr scripts');
});
