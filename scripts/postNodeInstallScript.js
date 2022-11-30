#!/usr/bin/env node
const fs = require('fs');

// async
function replaceContents(file, replacement, cb) {

  fs.readFile(replacement, (err, contents) => {
    if (err) return cb(err);
    fs.writeFile(file, contents, cb);
  });
}

// replace contents of file 'b' with contents of 'a'
// print 'done' when done
replaceContents('./node_modules/ytdl-core/lib/sig.js', './scripts/ytdlCoreSig.txt', err => {
  if (err) {
    // handle errors here
    throw err;
  }
  console.log('done');
});
