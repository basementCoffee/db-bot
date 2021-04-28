const {google} = require('googleapis');
require('dotenv').config();

const client_email = process.env.CLIENT_EMAIL.replace(/\\n/gm, '\n');
const private_key = process.env.PRIVATE_KEY.replace(/\\n/gm, '\n');
const stoken = process.env.STOKEN.replace(/\\n/gm, '\n');
const token = process.env.TOKEN.replace(/\\n/gm, '\n');
const spotifyCID = process.env.SPOTIFY_CLIENT_ID.replace(/\\n/gm, '\n');
const spotifySCID = process.env.SPOTIFY_SECRET_CLIENT_ID.replace(/\\n/gm, '\n');

const client2 = new google.auth.JWT(client_email, null, private_key, [
  'https://www.googleapis.com/auth/spreadsheets'
]);

/**
 * Authorizes the google client
 */
client2.authorize(function (err, tokens) {
  if (err) {
    console.log(err);
  } else {
    console.log('Connected to google apis.');
  }
});

/**
 * Runs an update over the sheet and updates local variables. Returns the respective keys
 * and links within two maps (CongratsDatabase and ReferenceDatabase). The CongratsDatabase represents
 * unaltered keys and values while the ReferenceDatabase contains toUpper key names.
 * @param cl The google client
 * @param columnToRun The column letter/string to get the keys
 * @param secondColumn The column letter/string to get the values
 * @param nameOfSheet The name of the sheet to get the values from
 * @returns {Promise<{congratsDatabase: Map<any, any>, line: [], referenceDatabase: Map<any, any>}|*>}
 */
async function gsrun (cl, columnToRun, secondColumn, nameOfSheet) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: cl
  });

  nameOfSheet = nameOfSheet.toString();
  const spreadsheetSizeObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet + '!D1'
  };
  // String.fromCharCode(my_string.charCodeAt(columnToRun) + 1)
  let dataSizeFromSheets;
  try {
    dataSizeFromSheets = await gsapi.spreadsheets.values.get(
      spreadsheetSizeObjects
    );
    dataSize.set(nameOfSheet, dataSizeFromSheets.data.values);
  } catch (e) {
    await createSheetNoMessage(nameOfSheet);
    // gsUpdateAdd2(client2, 1,"D", nameOfSheet);
    dataSize.set(nameOfSheet, 1);
    return gsrun(cl, columnToRun, secondColumn, nameOfSheet);
  }

  if (!dataSize.get(nameOfSheet)) {
    dataSize.set(nameOfSheet, 1);
    gsUpdateAdd2(cl, 1, 'D', nameOfSheet);
    console.log('Data Size prev undef: ' + dataSize.get(nameOfSheet));
    return gsrun(cl, columnToRun, secondColumn, nameOfSheet);
  }

  const songObjects = {
    spreadsheetId: stoken,
    range: nameOfSheet +
      '!' +
      columnToRun +
      '2:' +
      secondColumn +
      'B' +
      dataSize.get(nameOfSheet).toString()
  };

  const dataSO = await gsapi.spreadsheets.values.get(songObjects);
  const arrayOfSpreadsheetValues = dataSO.data.values;

  let line;
  let keyT;
  let valueT;
  congratsDatabase.clear();
  referenceDatabase.clear();
  const keyArray = [];
  for (let i = 0; i < dataSize.get(nameOfSheet); i++) {
    // the array of rows (has two columns)
    line = arrayOfSpreadsheetValues[i];
    if (!line) {
      continue;
    }
    keyT = line[0];
    keyArray.push(keyT);
    valueT = line[1];
    congratsDatabase.set(keyT, valueT);
    referenceDatabase.set(keyT.toUpperCase(), valueT);
  }
  return {
    congratsDatabase: congratsDatabase,
    referenceDatabase: referenceDatabase,
    line: keyArray
  };
}

/**
 * Creates a sheet within the database for new users
 * @param message A message within the guild that triggered the bot
 * @param nameOfSheet The name of the sheet to create
 */
function createSheet (message, nameOfSheet) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: client2
  });
  gsapi.spreadsheets.batchUpdate({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: nameOfSheet
            }
          }
        }]
      }
    },
    function (err, response) {
      if (err) {
        // console.log('The API returned an error: ' + err);
      } else {
        gsrun(client2, 'A', 'B', message.guild.id).then(() => {
        });
      }
      // console.log("success: ", response);
    }
  );
}

/**
 * Deletes the respective rows within the google sheets
 * @param message The message that triggered the command
 * @param sheetName The name of the sheet to edit
 * @param rowNumber The row to delete
 * @returns {Promise<void>}
 */
async function deleteRows (message, sheetName, rowNumber) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: client2
  });
  let res;
  try {
    const request = {
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      ranges: [sheetName],
      includeGridData: false,
      auth: client2
    };

    res = await gsapi.spreadsheets.get(request);
  } catch (error) {
    console.log('Error get sheetId');
  }

  // gets the sheetId
  const sheetId = res.data.sheets[0].properties.sheetId;

  // ----------------------------------------------------------
  gsapi.spreadsheets.batchUpdate({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber,
              endIndex: rowNumber + 1
            }
          }
        }]
      }
    },
    function (err, response) {
      if (err) {
        // console.log('The API returned an error: ' + err);
      } else {
        gsrun(client2, 'A', 'B', message.guild.id).then(() => {
        });
      }
      // console.log("success: ", response);
    }
  );
}

/**
 * Creates a google sheet with the given name and adds an initial
 * value to the database size column d.
 * @param nameOfSheet The name of the sheet to create
 * @returns {{}}
 */
function createSheetNoMessage (nameOfSheet) {
  console.log('within create sheets');
  const gsapi = google.sheets({
    version: 'v4',
    auth: client2
  });
  gsapi.spreadsheets.batchUpdate({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: nameOfSheet
            }
          }
        }]
      }
    },
    function (err, response) {
      if (err) {
        // console.log('The API returned an error: ' + err);
      } else {
        gsUpdateAdd2(client2, 1, 'D', nameOfSheet);
      }
      // console.log("success: ", response);
      return response;
    }
  );
  return {};
}

/**
 * Adds the entry into the column as a key, value pair.
 * @param {*} cl The google client
 * @param {*} key The name of the key to add, goes into the last row of the firstColumnLetter
 * @param {*} link The name of the value to add, goes into the last row of the LastColumnLetter
 * @param {*} firstColumnLetter The key column letter, should be uppercase
 * @param {*} secondColumnLetter The link column letter, should be uppercase
 * @param nameOfSheet The name of the sheet to update
 */
function gsUpdateAdd (
  cl,
  key,
  link,
  firstColumnLetter,
  secondColumnLetter,
  nameOfSheet
) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: cl
  });
  gsapi.spreadsheets.values
    .append({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!' + firstColumnLetter + '2:' + secondColumnLetter + '2',
      includeValuesInResponse: true,
      insertDataOption: 'INSERT_ROWS',
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      responseValueRenderOption: 'FORMATTED_VALUE',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [key, link]
        ]
      }
    })
    .then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function (err) {
        console.error('Execute error', err);
      }
    );

  gsUpdateOverwrite(cl, -1, 1, nameOfSheet);
}

/**
 * Single cell add to the respective google sheets. Adds to the first row by default.
 * @param cl The google client
 * @param givenValue The value to input into the cell
 * @param firstColumnLetter The column name to update
 * @param nameOfSheet The name of the sheet to add to
 */
function gsUpdateAdd2 (cl, givenValue, firstColumnLetter, nameOfSheet) {
  const gsapi = google.sheets({
    version: 'v4',
    auth: cl
  });
  gsapi.spreadsheets.values
    .append({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!' + firstColumnLetter + '1',
      includeValuesInResponse: true,
      insertDataOption: 'INSERT_ROWS',
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      responseValueRenderOption: 'FORMATTED_VALUE',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [givenValue]
        ]
      }
    })
    .then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function (err) {
        console.error('Execute error', err);
      }
    );
}

/**
 * Overwrites the cell D1.
 * @param cl the client auth
 * @param value the final DB value, overrides addOn unless negative
 * @param addOn the number to mutate the current DB size by
 * @param nameOfSheet the name of the sheet to change
 */
function gsUpdateOverwrite (cl, value, addOn, nameOfSheet) {
  if (value < 0) {
    try {
      value = parseInt(dataSize.get(nameOfSheet)) + addOn;
    } catch (e) {
      // console.log("Error caught gsUpdateOverview", value);
      value = 1;
      // console.log(e);
    }
  }
  const gsapi = google.sheets({
    version: 'v4',
    auth: cl
  });
  gsapi.spreadsheets.values
    .update({
      spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
      range: nameOfSheet + '!D1',
      includeValuesInResponse: true,
      responseDateTimeRenderOption: 'FORMATTED_STRING',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [value]
        ]
      }
    })
    .then(
      function (response) {
        // Handle the results here (response.result has the parsed body).
        // console.log("Response", response);
      },
      function (err) {
        console.error('Execute error', err);
      }
    );
  gsrun(cl, 'A', 'B', 'entries').then();
}

// ----------------------------------Above is Google API implementation --------------------

const {MessageEmbed, Client} = require('discord.js');
// initialization
const bot = new Client();
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');

// SPOTIFY IMPORTS --------------------------
const spdl = require('spdl-core');
spdl.setCredentials(spotifyCID, spotifySCID);

// UPDATE HERE - Before Git Push
const version = '3.1.0';
const buildNo = '03010001'; // major, minor, patch, build
let devMode = false; // default false
let isInactive = !devMode; // default true - (see: bot.on('ready'))
const servers = {};
// the max size of the queue
const maxQueueSize = 500;
let keyArray;
let s;

/**
 * Given a duration in ms, it returns a formatted string separating
 * the hours, minutes, and seconds.
 * @param duration a duration in milliseconds
 * @returns {string} a formatted string duration
 */
function formatDuration (duration) {
  const seconds = duration / 1000;
  const min = (seconds / 60);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${Math.floor(hours % 24)}h`;
  }
  if (hours > 0) {
    return `${hours}h ${Math.floor(min % 60)}m`;
  }
  return `${Math.floor(min)}m ${Math.floor(seconds % 60)}s`;
}

/**
 * Determines whether the message contains a form of congratulations
 * @param message The message that the discord client is parsing
 * @returns {*} true if congrats is detected
 */
function contentsContainCongrats (message) {
  return (
    message.content.includes('grats') ||
    message.content.includes('gratz') ||
    message.content.includes('ongratulations')
  );
}

process.setMaxListeners(0);

/**
 * Skips the song that is currently being played.
 * Use for specific voice channel playback.
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 */
function skipSong (message, voiceChannel, playMessageToChannel) {
  if (!servers[message.guild.id]) {
    servers[message.guild.id] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (
    !message.guild.client.voice ||
    !message.guild.voice ||
    !message.guild.voice.channel
  ) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
    return;
  }
  if (!voiceChannel) {
    voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return;
    }
  }
  // if server queue is not empty
  if (servers[message.guild.id].queue.length > 0) {
    servers[message.guild.id].queueHistory.push(servers[message.guild.id].queue.shift());
    if (playMessageToChannel) message.channel.send('*skipped*');
    // if there is still items in the queue then play next song
    if (servers[message.guild.id].queue.length > 0) {
      whatspMap[voiceChannel.id] = servers[message.guild.id].queue[0];
      // get rid of previous dispatch
      playSongToVC(message, whatspMap[voiceChannel.id], voiceChannel, true);
    } else {
      runStopPlayingCommand(message.guild.id, voiceChannel);
    }
  } else {
    runStopPlayingCommand(message.guild.id, voiceChannel);
  }
}

/**
 * Removes an item from the google sheets music database
 * @param message the message that triggered the bot
 * @param {string} keyName the key to remove
 * @param sheetName the name of the sheet to alter
 * @param sendMsgToChannel whether to send a response to the channel
 */
function runRemoveItemCommand (message, keyName, sheetName, sendMsgToChannel) {
  if (keyName) {
    gsrun(client2, 'A', 'B', sheetName).then(async (xdb) => {
      let couldNotFindKey = true;
      for (let i = 0; i < xdb.line.length; i++) {
        const itemToCheck = xdb.line[i];
        if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
          i += 1;
          couldNotFindKey = false;
          await gsUpdateOverwrite(client2, -1, -1, sheetName);
          await deleteRows(message, sheetName, i);
          if (sendMsgToChannel) {
            message.channel.send("*removed '" + itemToCheck + "'*");
          }
        }
      }
      if (couldNotFindKey && sendMsgToChannel) {
        gsrun(client2, 'A', 'B', sheetName).then(async (xdb) => {
          const foundStrings = runSearchCommand(keyName, xdb).ss;
          if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
            message.channel.send("Could not find '" + keyName + "'.\n*Did you mean: " + foundStrings + '*');
          } else {
            let dbType = "the server's";
            if (message.content.substr(1, 1).toLowerCase() === 'm') {
              dbType = 'your';
            }
            message.channel.send("*could not find '" + keyName + "' in " + dbType + ' database*');
          }
        });
      }
    });
  } else {
    if (sendMsgToChannel) {
      message.channel.send('Need to specify the key to delete.');
    }
  }
}

/**
 * Runs the play now command.
 * @param message the message that triggered the bot
 * @param args the message split into an array
 * @param mgid the message guild id
 * @param sheetName the name of the sheet to reference
 */
async function runPlayNowCommand (message, args, mgid, sheetName) {
  if (!message.member.voice.channel) {
    return;
  }
  if (!args[1]) {
    return message.channel.send('What should I play now? Put a link or some words.');
  }
  if (!servers[mgid]) {
    servers[mgid] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (
    !message.guild.client.voice ||
    !message.guild.voice ||
    !message.guild.voice.channel
  ) {
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  if (servers[mgid].queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1])) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, true, false);
    } else {
      return runYoutubeSearch(message, args, mgid, true);
    }
  }
  // push to queue
  servers[mgid].queue.unshift(args[1]);
  message.channel.send('*playing now*');
  playSongToVC(message, args[1], message.member.voice.channel, true);
}

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand (message, args, mgid, sheetName) {
  if (!message.member.voice.channel) {
    return message.channel.send("must be in a voice channel to play");
  }
  if (!args[1]) {
    if (dispatcherMap[message.member.voice.channel.id] && dispatcherMapStatus[message.member.voice.channel.id] === 'pause') {
      dispatcherMap[message.member.voice.channel.id].resume();
      return message.channel.send('*playing*');
    }
    return message.channel.send('What should I play? Put a link or some words.');
  }
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1])) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, false, false);
    } else {
      return runYoutubeSearch(message, args, mgid, false);
    }
  }
  if (!servers[mgid]) {
    servers[mgid] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  let queueWasEmpty = false;
  if (servers[mgid].queue.length < 1) {
    queueWasEmpty = true;
  }
  let pNums = 1;
  while (args[pNums]) {
    let linkZ = args[pNums];
    if (linkZ.substring(linkZ.length - 1) === ',') {
      linkZ = linkZ.substring(0, linkZ.length - 1);
    }
    // push to queue
    servers[mgid].queue.push(args[pNums]);
    pNums += 1;
  }
  // make pNums the number of added songs
  pNums--;
  // if queue was empty then play
  if (queueWasEmpty) {
    playSongToVC(message, args[1], message.member.voice.channel, true);
  } else if (pNums < 2) {
    message.channel.send('*added to queue*');
  } else {
    message.channel.send('*added ' + pNums + ' to queue*');
  }
}

/**
 * The execution for all of the bot commands
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases (message) {
  const mgid = message.guild.id;
  if (devMode) {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') return; // DEBUG MODE
    prefixMap[mgid] = '=';
  }
  let prefixString = prefixMap[mgid];
  if (!prefixString) {
    try {
      await gsrun(client2, 'A', 'B', 'prefixes').then(async (xdb) => {
        const newPrefix = xdb.congratsDatabase.get(mgid);
        if (!newPrefix) {
          prefixMap[mgid] = '.';
          await gsUpdateAdd(client2, mgid, '.', 'A', 'B', 'prefixes');
        } else {
          prefixMap[mgid] = newPrefix;
        }
      });
    } catch (e) {
      prefixMap[mgid] = '.';
      gsUpdateAdd(client2, mgid, '.', 'A', 'B', 'prefixes');
    }
    prefixString = prefixMap[mgid];
    bot.user.setActivity('[ .help ]', {type: 'WATCHING'}).then();
  }
  const firstWordBegin = message.content.substr(0, 14).trim() + ' ';
  const fwPrefix = firstWordBegin.substr(0, 1);
  if (fwPrefix !== prefixString) {
    if (fwPrefix.toUpperCase() === fwPrefix.toLowerCase() && fwPrefix.charCodeAt(0) < 120 && !devMode) {
      const fwCommand = firstWordBegin.substr(1, 13);
      if (fwPrefix === '.' && (fwCommand === 'changeprefix ' || fwCommand === 'h ' || fwCommand === 'help ')) {
        return message.channel.send('Current prefix is: ' + prefixString);
      }
      if (message.member.guild.me.nickname && message.member.guild.me.nickname.substr(0, 1) === '['
        && message.member.guild.me.nickname.substr(2, 1) === ']') {
        const falsePrefix = message.member.guild.me.nickname.substr(1, 1);
        if (fwPrefix === falsePrefix && (fwCommand === 'changeprefix ' || fwCommand === 'h ' || fwCommand === 'help ')) {
          return message.channel.send('Current prefix is: ' + prefixString);
        }
      }
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  console.log(args); // see recent bot commands within console for testing
  const statement = args[0].substr(1).toLowerCase();
  if (statement.substr(0, 1) === 'g') {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
      return;
    }
  }
  switch (statement) {
    // !p is just the basic rhythm bot
    case 'p':
      runPlayLinkCommand(message, args, mgid, undefined);
      break;
    case 'play':
      runPlayLinkCommand(message, args, mgid, undefined);
      break;
    case 'mp':
      runPlayLinkCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mplay':
      runPlayLinkCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'gp':
      runPlayLinkCommand(message, args, mgid, 'entries');
      break;
    case 'gplay':
      runPlayLinkCommand(message, args, mgid, 'entries');
      break;
    // !pn is the play now command
    case 'gpn':
      runPlayNowCommand(message, args, mgid, 'entries');
      break;
    case 'pn':
      runPlayNowCommand(message, args, mgid, undefined);
      break;
    case 'playnow':
      runPlayNowCommand(message, args, mgid, undefined);
      break;
    case 'mpn':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mplaynow':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    //! e is the Stop feature
    case 'e':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'end':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'leave':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'quit':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'loop':
      if (!message.member.guild.voice || !message.member.guild.voice.channel) {
        return message.channel.send('must be playing a song to loop');
      }
      if (servers[mgid].loop) {
        servers[mgid].loop = false;
        message.channel.send('*looping disabled*');
      } else {
        servers[mgid].loop = true;
        message.channel.send('*looping enabled*');
      }
      break;
    case 'stop':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = 'pause';
        message.channel.send('*stopped*');
      }
      break;
    // !gd is to run database songs
    case 'gd':
      runDatabasePlayCommand(args, message, 'entries', false, true);
      break;
    // !d
    case 'd':
      runDatabasePlayCommand(args, message, mgid, false, false);
      break;
    // !md is the personal database
    case 'md':
      runDatabasePlayCommand(args, message, 'p' + message.member.id, false, true);
      break;
    case 'dn':
      runPlayNowCommand(message, args, mgid, mgid);
      break;
    case 'mdn':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    // !r is a random that works with the normal queue
    case 'r':
      runRandomToQueue(args[1], message, mgid);
      break;
    case 'rand':
      runRandomToQueue(args[1], message, mgid);
      break;
    // !gr is the global random to work with the normal queue
    case 'gr':
      runRandomToQueue(args[1], message, 'entries');
      break;
    // !mr is the personal random that works with the normal queue
    case 'mr':
      runRandomToQueue(args[1], message, 'p' + message.member.id);
      break;
    case 'mrand':
      runRandomToQueue(args[1], message, 'p' + message.member.id);
      break;
    // !keys is server keys
    case 'keys':
      runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    // !key
    case 'key':
      runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    case 'k':
      runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    // !mkeys is personal keys
    case 'mkeys':
      runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    // !mkey is personal keys
    case 'mkey':
      runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    case 'mk':
      runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    // !gkeys is global keys
    case 'gkeys':
      runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // !gkey is global keys
    case 'gkey':
      runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // !search is the search
    case 'search':
      if (!args[1]) {
        return message.channel.send('No argument was given.');
      }
      runUniversalSearchCommand(message, mgid, args[1]);
      break;
    case 'msearch':
      if (!args[1]) {
        return message.channel.send('No argument was given.');
      }
      gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) => {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send(
            'Could not find any keys in your list that start with the given letters.'
          );
        }
      });
      break;
    // !s prints out the db size or searches
    case 's':
      if (!args[1]) {
        return gsrun(client2, 'A', 'B', mgid).then((xdb) =>
          message.channel.send('Server list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      runUniversalSearchCommand(message, mgid, args[1]);
      break;
    case 'ms':
      if (!args[1]) {
        return gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) =>
          message.channel.send('Personal list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) => {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send(
            'Could not find any keys in your list that start with the given letters.'
          );
        }
      });
      break;
    case 'gs':
      if (!args[1]) {
        return gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) =>
          message.channel.send('Global list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      gsrun(client2, 'A', 'B', 'entries').then((xdb) => {
        ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send(
            'Could not find any keys that start with the given letters.'
          );
        }
      });
      break;
    // !? is the command for what's playing?
    case '?':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'np':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'now':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'nowplaying':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'playing':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'current':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'g?':
      await runWhatsPCommand(args, message, mgid, 'entries');
      break;
    case 'm?':
      await runWhatsPCommand(args, message, mgid, 'p' + message.member.id);
      break;
    case 'queue':
      runQueueCommand(message, mgid);
      break;
    case 'q':
      runQueueCommand(message, mgid);
      break;
    case 'que':
      runQueueCommand(message, mgid);
      break;
    case 'list':
      runQueueCommand(message, mgid);
      break;
    case 'upnext':
      runQueueCommand(message, mgid);
      break;
    case 'changeprefix':
      if (!message.member.hasPermission('KICK_MEMBERS')) {
        return message.channel.send('Permissions Error: Only members who can kick other members can change the prefix.');
      }
      if (!args[1]) {
        return message.channel.send('No argument was given. Enter the new prefix after the command.');
      }
      if (args[1].length > 1) {
        return message.channel.send(
          'Prefix length cannot be greater than 1.'
        );
      }
      if (args[1] === '+' || args[1] === '=' || args[1] === '\'') {
        return message.channel.send('Cannot have ' + args[1] + ' as a prefix.');
      }
      if (args[1].toUpperCase() !== args[1].toLowerCase() || args[1].charCodeAt(0) > 120) {
        message.channel.send("cannot have a letter as a prefix.");
        return;
      }
      args[2] = args[1];
      args[1] = mgid;
      message.channel.send('*changing prefix...*');
      await gsrun(client2, 'A', 'B', 'prefixes').then(async () => {
        await runRemoveItemCommand(message, args[1], 'prefixes', false);
        await runAddCommand(args, message, 'prefixes', false);
        await gsrun(client2, 'A', 'B', 'prefixes').then(async (xdb) => {
          await gsUpdateOverwrite(client2, xdb.congratsDatabase.size + 2, 1, 'prefixes');
          prefixMap[mgid] = args[2];
          message.channel.send('Prefix successfully changed to ' + args[2]);
          prefixString = args[2];
          let name = 'db bot';
          let prefixName = '[' + prefixString + ']';
          if (message.member.guild.me.nickname) {
            name = message.member.guild.me.nickname.substring(message.member.guild.me.nickname.indexOf(']') + 1);
          }

          async function changeNamePrefix () {
            if (!message.member.guild.me.nickname) {
              await message.member.guild.me.setNickname('[' + prefixString + '] ' + "db bot");
            } else if (message.member.guild.me.nickname.indexOf('[') > -1 && message.member.guild.me.nickname.indexOf(']') > -1) {
              await message.member.guild.me.setNickname('[' + prefixString + '] ' + message.member.guild.me.nickname.substring(message.member.guild.me.nickname.indexOf(']') + 2));
            } else {
              await message.member.guild.me.setNickname('[' + prefixString + '] ' + message.member.guild.me.nickname);
            }
          }

          if (!message.member.guild.me.nickname || (message.member.guild.me.nickname.substr(0, 1) !== '[' && message.member.guild.me.nickname.substr(2, 1) !== ']')) {
            message.channel.send('---------------------');
            message.channel.send('Would you like me to update my name to reflect this? (yes or no)\nFrom **' + (message.member.guild.me.nickname || 'db bot') + '**  -->  **' + prefixName + " " + name + '**').then(() => {
              const filter = m => message.author.id === m.author.id;

              message.channel.awaitMessages(filter, {time: 30000, max: 1, errors: ['time']})
                .then(async messages => {
                  // message.channel.send(`You've entered: ${messages.first().content}`);
                  if (messages.first().content.toLowerCase() === 'yes' || messages.first().content.toLowerCase() === 'y') {
                    await changeNamePrefix();
                    message.channel.send('name has been updated, prefix is: ' + prefixString);
                  } else {
                    message.channel.send('name remains the same, prefix is: ' + prefixString);
                  }
                })
                .catch(() => {
                  message.channel.send('name remains the same, prefix is: ' + prefixString);
                });
            });
          } else if (message.member.guild.me.nickname.substr(0, 1) === '[' && message.member.guild.me.nickname.substr(2, 1) === ']') {
            await changeNamePrefix();
          }
        });
      });
      break;
    // list commands for public commands
    case 'h':
      sendHelp(message, prefixString);
      break;
    case 'help':
      sendHelp(message, prefixString);
      break;
    // !skip
    case 'skip':
      runSkipCommand(message, args[1]);
      break;
    // !sk
    case 'sk':
      runSkipCommand(message, args[1]);
      break;
    // !pa
    case 'pa':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = 'pause';
        message.channel.send('*paused*');
      }
      break;
    case 'pause':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = 'pause';
        message.channel.send('*paused*');
      }
      break;
    // !pl
    case 'pl':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = 'resume';
        message.channel.send('*playing*');
      }
      break;
    case 'res':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = 'resume';
        message.channel.send('*playing*');
      }
      break;
    case 'resume':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = 'resume';
        message.channel.send('*playing*');
      }
      break;
    case 'time':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'timestamp':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'ts':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    // !v prints out the version number
    case 'v':
      message.channel.send('version: ' + version + '\n' + 'build: ' + buildNo);
      break;
    // !devadd
    case 'devadd':
      if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
        return;
      }
      message.channel.send(
        "Here's link to add to the database:\n" +
        'https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622'
      );
      break;
    // !ga adds to the server database
    case 'ga':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a song name followed by a link.'
        );
      }
      if (!args[2].includes('.')) {
        return message.channel.send('You can only add links to the database.');
      }
      if (args[2].includes('spotify.com')) {
        if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
      } else {
        if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
      }
      // in case the database has not been initialized
      gsrun(client2, 'A', 'B', 'entries').then(() => {
        runAddCommand(args, message, 'entries', true);
      });
      break;
    // !a is normal add
    case 'a':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Incorrect format. Put a desired key-name followed by a link. *(ex: ' +
          prefixString + 'a [key] [link])*'
        );
      }
      if (!args[2].includes('.')) {
        return message.channel.send('You can only add links to the database. (Names cannot be more than one word)');
      }
      if (args[2].includes('spotify.com')) {
        if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
      } else {
        if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
      }
      // in case the database has not been initialized
      gsrun(client2, 'A', 'B', mgid).then(() => {
        if (
          !dataSize.get(mgid.toString()) ||
          dataSize.get(mgid.toString()) < 1
        ) {
          message.channel.send('Please try again.');
        } else {
          runAddCommand(args, message, mgid, true);
        }
      });
      break;
    case 'add':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'a [key] [link])*'
        );
      }
      if (!args[2].includes('.')) {
        return message.channel.send('You can only add links to the database. (Names cannot be more than one word)');
      }
      if (args[2].includes('spotify.com')) {
        if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
      } else {
        if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
      }
      // in case the database has not been initialized
      gsrun(client2, 'A', 'B', mgid).then(() => {
        if (
          !dataSize.get(mgid.toString()) ||
          dataSize.get(mgid.toString()) < 1
        ) {
          message.channel.send('Please try again.');
        } else {
          runAddCommand(args, message, mgid, true);
        }
      });
      break;
    // !ma is personal add
    case 'ma':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'ma [key] [link])*'
        );
      }
      if (!args[2].includes('.')) {
        return message.channel.send('You can only add links to the database. (Names cannot be more than one word)');
      }
      if (args[2].includes('spotify.com')) {
        if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
      } else {
        if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
      }
      // in case the database has not been initialized
      gsrun(client2, 'A', 'B', 'p' + message.member.id).then(() => {
        if (
          !dataSize.get('p' + message.member.id.toString()) ||
          dataSize.get('p' + message.member.id.toString()) < 1
        ) {
          message.channel.send('Please try again.');
        } else {
          runAddCommand(args, message, 'p' + message.member.id, true);
        }
      });
      break;
    case 'madd':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'ma [key] [link])*'
        );
      }
      if (!args[2].includes('.')) {
        return message.channel.send('You can only add links to the database. (Names cannot be more than one word)');
      }
      if (args[2].includes('spotify.com')) {
        if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
      } else {
        if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
      }
      // in case the database has not been initialized
      gsrun(client2, 'A', 'B', 'p' + message.member.id).then(() => {
        if (
          !dataSize.get('p' + message.member.id.toString()) ||
          dataSize.get('p' + message.member.id.toString()) < 1
        ) {
          message.channel.send('Please try again.');
        } else {
          runAddCommand(args, message, 'p' + message.member.id, true);
        }
      });
      break;
    // !rm removes database entries
    case 'rm':
      runRemoveItemCommand(message, args[1], mgid, true);
      break;
    case 'remove':
      runRemoveItemCommand(message, args[1], mgid, true);
      break;
    // !grm removes database entries
    case 'grm':
      runRemoveItemCommand(message, args[1], 'entries', true);
      break;
    // !rm removes database entries
    case 'mrm':
      runRemoveItemCommand(message, args[1], 'p' + message.member.id, true);
      break;
    case 'mremove':
      runRemoveItemCommand(message, args[1], 'p' + message.member.id, true);
      break;
    case 'rewind':
      if (!servers[mgid]) return message.channel.send('must have played a link to rewind');
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to rewind');
      }
      runRewindCommand(message, mgid, message.member.voice.channel, args[1]);
      break;
    case 'rw':
      if (!servers[mgid]) return message.channel.send('must have played a link to rewind');
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to rewind');
      }
      runRewindCommand(message, mgid, message.member.voice.channel, args[1]);
      break;
    case 'replay':
      if (!servers[mgid] || (!servers[mgid].queue[0] && !servers[mgid].queueHistory)) return message.channel.send('must be actively playing to replay');
      if (servers[mgid].queue[0]) {
        playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
      } else {
        playSongToVC(message, servers[mgid].queueHistory.pop(), message.member.voice.channel, true);
      }
      break;
    case 'rp':
      if (!servers[mgid] || (!servers[mgid].queue[0] && !servers[mgid].queueHistory)) return message.channel.send('must be actively playing to replay');
      if (servers[mgid].queue[0]) {
        playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
      } else {
        playSongToVC(message, servers[mgid].queueHistory.pop(), message.member.voice.channel, true);
      }
      break;
    case 'restart':
      if (!servers[mgid] || (!servers[mgid].queue[0] && !servers[mgid].queueHistory)) return message.channel.send('must be actively playing to restart');
      if (servers[mgid].queue[0]) {
        playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
      } else {
        playSongToVC(message, servers[mgid].queueHistory.pop(), message.member.voice.channel, true);
      }
      break;
    case 'rs':
      if (!servers[mgid] || (!servers[mgid].queue[0] && !servers[mgid].queueHistory)) return message.channel.send('must be actively playing to restart');
      if (servers[mgid].queue[0]) {
        playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
      } else {
        playSongToVC(message, servers[mgid].queueHistory.pop(), message.member.voice.channel, true);
      }
      break;
    case 'invite':
      message.channel.send("Here's the invite link!\nhttps://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot");
      break;
    case 'inv':
      message.channel.send("Here's the invite link!\nhttps://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot");
      break;
    case 'silence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to silence');
      }
      if (silenceMap[mgid]) {
        return message.channel.send('*song notifications already silenced*');
      }
      silenceMap[mgid] = true;
      message.channel.send('*song notifications temporarily silenced*');
      break;
    case 'unsilence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to unsilence');
      }
      if (!silenceMap[mgid]) {
        return message.channel.send('*song notifications already unsilenced*');
      }
      silenceMap[mgid] = false;
      generatingEmbedMap[mgid] = false;
      message.channel.send('*song notifications enabled*');
      if (dispatcherMap[message.member.voice.channel.id]) {
        sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel).then();
      }
      break;
    case 'l':
      if (!args[1]) {
        return message.channel.send('no lookup index given (1-5)');
      }
      await runYoutubeSearch(message, args, mgid, false, args[1]);
      break;
    case 'ln':
      if (!args[1]) {
        return message.channel.send('no lookup index given (1-5)');
      }
      await runYoutubeSearch(message, args, mgid, true, args[1]);
      break;
    case 'gzh':
      const devCEmbed = new MessageEmbed()
        .setTitle('Dev Commands')
        .setDescription(
          prefixString + 'gzs - statistics' +
          '\n' + prefixString + 'gzi - user and bot id' +
          '\n' + prefixString + 'gzid - guild id' +
          '\n' + prefixString + 'gzq - quit/restarts the active bot' +
          '\n\n**calibrate multiple bots**' +
          '\n=gzl - return the bot\'s ping and latency' +
          '\n=gzd - toggle dev mode' +
          '\n=gzk - kill a process' +
          '\n=gzp - start a process' +
          '\n=gzc - ensure no two bots are on at the same time\n*(do not call gzc more than once within 5 minutes)*'
        )
        .setFooter('version: ' + version);
      message.channel.send(devCEmbed);
      break;
    case 'gzq':
      message.channel.send("quitting the bot... (may restart)");
      process.exit();
      break;
    case 'gzid':
      message.channel.send(message.member.guild.id);
      break;
    case 'gzs':
      const embed = new MessageEmbed()
        .setTitle('db bot - statistics')
        .setDescription('version: ' + version +
          '\nbuild: ' + buildNo +
          '\nservers: ' + bot.guilds.cache.size +
          '\nuptime: ' + formatDuration(bot.uptime) +
          '\nup since: ' + bot.readyAt.toString().substr(0, 21) +
          '\nactive voice channels: ' + bot.voice.connections.size
        );
      message.channel.send(embed);
      break;
    case 'gzi':
      message.channel.send('bot id: ' + bot.user.id + '\nyour id: ' + message.member.id);
      break;
    case 'gv':
      message.channel.send('version: ' + version);
      break;
    // !rand
    case 'guess':
      if (args[1]) {
        const numToCheck = parseInt(args[1]);
        if (!numToCheck || numToCheck < 1) {
          return message.channel.send('Number has to be positive.');
        }
        const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
        message.channel.send('Assuming ' + numToCheck + ' in total. Your number is ' + randomInt2 + '.');
      } else {
        if (message.member && message.member.voice && message.member.voice.channel) {
          const numToCheck = message.member.voice.channel.members.size;
          if (numToCheck < 1) {
            return message.channel.send('Need at least 1 person in a voice channel.');
          }
          const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
          message.channel.send(
            'Assuming ' + numToCheck + ' people. Your number is ' + randomInt2 + '.'
          );
        }
      }
      break;
  }
}

bot.on('guildCreate', guild => {
  if (isInactive) return;
  guild.systemChannel.send("Thanks for adding me :) \nType '.h' to see my commands.");
});

bot.once('ready', () => {
  // if (!devMode && !isInactive) bot.channels.cache.get("827195452507160627").send("=gzc");
  // bot starts up as inactive, if no response from the channel then activates itself
  if (!devMode) {
    if (isInactive) {
      mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
      console.log('-starting up sidelined-');
      console.log('checking status of other bots...');
      checkToSeeActive();
    } else {
      bot.user.setActivity('[try ".help" ]', {type: 'PLAYING'}).then();
      bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
    }
  } else {
    console.log('-devmode enabled-');
  }
});
const setOfBotsOn = new Set();
let numOfBotsOn = 0;
// calibrate on startup
bot.on('message', async (message) => {
  // turn off active bots -- activates on '~db-bot-process'
  if (message.content.substr(0, 15) === '~db-bot-process' &&
    message.member.id.toString() === '730350452268597300' && !devMode) {
    // if seeing bots that are on
    if (message.content.substr(15, 3) === '-on') {
      const oBuildNo = message.content.substr(18, 8);
      // if the other bot's version number is less than this bot's then turn the other bot off
      if (parseInt(oBuildNo) >= buildNo) {
        numOfBotsOn++;
        setOfBotsOn.add(oBuildNo);
      }
    } else if (!isInactive) {
      console.log('calibrating...');
      const oBuildNo = message.content.substr(15, 8);
      if (parseInt(oBuildNo) > parseInt(buildNo)) {
        isInactive = true;
        clearInterval(mainActiveTimer);
        mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
        return console.log('-sidelined(1)-');
      } else if (parseInt(oBuildNo) === parseInt(buildNo) && parseInt(message.content.substr(message.content.lastIndexOf('ver') + 3, 10)) > process.pid) {
        isInactive = true;
        clearInterval(mainActiveTimer);
        mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
        return console.log('-sidelined(2)-');
      }
    }
  }
});

const mainTimerTimeout = 600000;
let mainActiveTimer;
let resHandlerTimer;

function checkToSeeActive () {
  numOfBotsOn = 0;
  setOfBotsOn.clear();
  if (isInactive) {
    // see if any bots are active
    bot.channels.cache.get('827195452507160627').send('=gzk').then(() => {
      resHandlerTimer = setInterval(responseHandler, 9000);
    });
  }
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 * @returns {boolean} if there was an initial response
 */
function responseHandler () {
  clearInterval(resHandlerTimer);
  if (numOfBotsOn < 1) {
    clearInterval(mainActiveTimer);
    isInactive = false;
    devMode = false;
    bot.channels.cache.get('827195452507160627').send('=gzk').then(() => {
      console.log('-active-');
      const waitForFollowup = setInterval(() => {
        clearInterval(waitForFollowup);
        bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
      }, 2000);
    });
  } else if (numOfBotsOn > 1 && setOfBotsOn.size > 1) {
    bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
  }
}

// parses message, provides a response
bot.on('message', async (message) => {
  if (message.content.substr(0, 2) === '=g' &&
    (message.member.id === '730350452268597300' ||
      message.member.id === '443150640823271436' ||
      message.member.id === '268554823283113985')) {
    const zmsg = message.content.substr(2, 2);
    if (zmsg === 'zp' && isInactive) {
      const zargs = message.content.split(' ');
      let dm = '';
      if (devMode) {
        dm = '(dev mode)';
      }
      if (!zargs[1]) {
        message.channel.send('sidelined: ' + process.pid + ' (' + version + ') ' + dm);
      } else if (zargs[1] === process.pid.toString() || zargs[1] === 'all') {
        clearInterval(mainActiveTimer);
        isInactive = false;
        message.channel.send('db bot ' + process.pid + ' is now active');
        console.log('-active-');
      }
      return;
    } else if (zmsg === 'zk' && !isInactive) {
      const zargs = message.content.split(' ');
      if (message.member.id === '730350452268597300' && !devMode) {
        return message.channel.send('~db-bot-process-on' + buildNo + 'ver' + process.pid);
      }
      if (!zargs[1]) {
        let dm = '';
        if (devMode) {
          dm = '(dev mode)';
        }
        message.channel.send('active: ' + process.pid + ' (' + version + ') ' + dm);
        return;
      } else if (zargs[1] === process.pid.toString() || zargs[1] === 'all') {
        message.channel.send('db bot ' + process.pid + ' has been sidelined');
        isInactive = true;
        clearInterval(mainActiveTimer);
        mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
        console.log('-sidelined-');
      }
      return;
    } else if (zmsg === 'zc') {
      if (!devMode) {
        if (isInactive) {
          if (message.member.id !== '730350452268597300') {
            message.channel.send('inactive bot #' + process.pid + ' (' + version + ') ' + ' **is calibrating...** (may take up to 30 seconds)');
          }
          clearInterval(mainActiveTimer);
          const variation = Math.floor(Math.random() * 20000);
          mainActiveTimer = setInterval(checkToSeeActive, 20000 + variation);
        } else if (message.member.id !== '730350452268597300') {
          message.channel.send('active bot #' + process.pid + ' (' + version + ') ' + ' **is calibrating...** (may take up to 30 seconds)');
        }
        bot.channels.cache.get('827195452507160627').send('~db-bot-process' + buildNo + 'ver' + process.pid);
      }
    } else if (zmsg === 'zd') {
      const zargs = message.content.split(' ');
      let activeStatus = 'active';
      if (isInactive) {
        activeStatus = 'inactive';
      }
      if (!zargs[1]) {
        return message.channel.send(activeStatus + ' bot id: ' + process.pid.toString() + ' (' + 'dev mode: ' + devMode + ')');
      }
      if (devMode && zargs[1] === process.pid.toString()) {
        devMode = false;
        prefixMap[message.member.guild.id] = undefined;
        return message.channel.send('*devmode is off* ' + process.pid.toString());
      } else if (zargs[1] === process.pid.toString()) {
        devMode = true;
        return message.channel.send('*devmode is on* ' + process.pid.toString());
      }
    } else if (zmsg === 'zl') {
      return message.channel.send(`Latency is ${Date.now() - message.createdTimestamp}ms.\nAPI Latency is ${Math.round(bot.ws.ping)}ms`);
    }
  }
  if (message.author.bot || isInactive) {
    return;
  }
  if (contentsContainCongrats(message)) {
    if (!servers[message.guild.id]) {
      servers[message.guild.id] = {
        queue: [],
        queueHistory: [],
        loop: false,
        collector: false
      };
    }
    message.channel.send('Congratulations!').then();
    return playSongToVC(message, 'https://www.youtube.com/watch?v=oyFQVZ2h0V8', message.member.voice.channel, false);
  } else {
    runCommandCases(message).then();
  }
});

/**
 * The command to add a song to a given database.
 * @param {*} args The command arguments
 * @param {*} message The message that triggered the command
 * @param {string} sheetName the name of the sheet to add to
 * @param printMsgToChannel whether to print response to channel
 */
function runAddCommand (args, message, sheetName, printMsgToChannel) {
  let songsAddedInt = 0;
  let z = 1;
  gsrun(client2, 'A', 'B', sheetName).then(async (xdb) => {
    while (args[z] && args[z + 1]) {
      let linkZ = args[z + 1];
      if (linkZ.substring(linkZ.length - 1) === ',') {
        linkZ = linkZ.substring(0, linkZ.length - 1);
      }
      if (args[z].includes('.')) {
        message.channel.send("did not add '" + args[z] + "', names cannot include '.'");
        songsAddedInt--;
      } else {
        let alreadyExists = false;
        if (printMsgToChannel) {
          for (const x of xdb.congratsDatabase.keys()) {
            if (x === args[z]) {
              message.channel.send("'" + args[z] + "' is already in your list");
              alreadyExists = true;
              songsAddedInt--;
              break;
            }
          }
        }
        if (!alreadyExists) {
          gsUpdateAdd(client2, args[z], args[z + 1], 'A', 'B', sheetName);
        }
      }
      z = z + 2;
      songsAddedInt += 1;
    }
    if (printMsgToChannel) {
      const ps = prefixMap[message.guild.id];
      // the specific database user-access character
      let databaseType = args[0].substr(1, 1).toLowerCase();
      if (databaseType === 'a') {
        databaseType = '';
      }
      if (songsAddedInt === 1) {
        let typeString;
        if (databaseType === 'm') {
          typeString = 'your personal';
        } else {
          typeString = "the server's";
        }
        message.channel.send('*song added to ' + typeString + " database. (see '" + ps + databaseType + "keys')*");
      } else if (songsAddedInt > 1) {
        gsrun(client2, 'A', 'B', sheetName).then(() => {
          gsUpdateOverwrite(client2, -1, songsAddedInt, sheetName);
          message.channel.send('*' + songsAddedInt + " songs added to the database. (see '" + ps + databaseType + "keys')*");
        });
      }
    }
  });
}

/**
 * Prints the queue to the console
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @returns {Promise<void>|*}
 */
function runQueueCommand (message, mgid) {
  if (!servers[mgid] || servers[mgid].queue < 1 || !message.member.guild.voice.channel) {
    return message.channel.send('There is no active queue right now');
  }
  const serverQueue = servers[mgid].queue.map((x) => x);
  let qIterations = serverQueue.length;
  if (qIterations > 11) qIterations = 11;
  let title;
  let authorName;

  async function getTitle (url, cutoff) {
    if (url.includes('spotify')) {
      const infos = await spdl.getInfo(url);
      title = infos.title;
    } else {
      const infos = await ytdl.getInfo(url);
      title = infos.videoDetails.title;
    }
    if (cutoff && title.length > cutoff) {
      title = title.substr(0, cutoff) + '...';
    }
    return title;
  }

  async function generateQueue (startingIndex) {
    let queueSB = '';
    const queueMsgEmbed = new MessageEmbed();
    if (!authorName) {
      authorName = await getTitle(serverQueue[0], 50);
    }
    message.channel.send('generating queue...').then(async msg => {
      queueMsgEmbed.setTitle('Up Next')
        .setAuthor('playing:  ' + authorName)
        .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/dbBotIconMedium.jpg');
      for (let qi = startingIndex + 1; (qi < qIterations && qi < servers[mgid].queue.length); qi++) {
        const title = (await getTitle(serverQueue[qi]));
        const url = serverQueue[qi];
        queueSB += qi + '. ' + `[${title}](${url})\n`;
      }
      if (queueSB.length === 0) {
        queueSB = 'queue is empty';
      }
      queueMsgEmbed.setDescription(queueSB);
      if (startingIndex + 10 < serverQueue.length) {
        queueMsgEmbed.setFooter('embed displays 10 at a time');
      }
      msg.delete();
      message.channel.send(queueMsgEmbed).then(sentMsg => {
        if (startingIndex + 10 < serverQueue.length) {
          sentMsg.react('➡️');
        }
        const filter = (reaction, user) => {
          if (message.member.voice.channel) {
            for (const mem of message.member.voice.channel.members) {
              if (user.id === mem[1].id) {
                return user.id !== bot.user.id && ['➡️'].includes(reaction.emoji.name);
              }
            }
          }
          return false;
        };
        const collector = sentMsg.createReactionCollector(filter, {time: 300000});
        const arrowReactionInterval = setInterval(() => {
          clearInterval(arrowReactionInterval);
          sentMsg.reactions.removeAll();
        }, 300500);
        collector.on('collect', (reaction, reactionCollector) => {
          clearInterval(arrowReactionInterval);
          sentMsg.reactions.removeAll();
          let num = serverQueue.length - startingIndex - 11;
          if (num > 10) num = 10;
          qIterations += 10;
          message.channel.send('showing next ' + num).then(generateQueue(startingIndex + 10));
        });
      });
    });
  }

  return generateQueue(0).then();
}

/**
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the google sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @returns whether the play command has been handled accordingly
 */
function runDatabasePlayCommand (args, message, sheetName, playRightNow, printErrorMsg) {
  if (!args[1]) {
    message.channel.send("There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
    return true;
  }
  if (!message.member.voice.channel) {
    message.channel.send('must be in a voice channel to play keys');
    return true;
  }
  if (!servers[message.guild.id]) {
    servers[message.guild.id] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
  }
  if (servers[message.guild.id].queue.length >= maxQueueSize) {
    message.channel.send('*max queue size has been reached*');
    return true;
  }
  gsrun(client2, 'A', 'B', sheetName).then(async (xdb) => {
    let queueWasEmpty = false;
    // if the queue is empty then play
    if (servers[message.guild.id].queue.length < 1) {
      queueWasEmpty = true;
    }
    if (args[2] && !playRightNow) {
      let dbAddInt = 1;
      let unFoundString = '*could not find: ';
      let firstUnfoundRan = false;
      let dbAddedToQueue = 0;
      let otherSheet;
      while (args[dbAddInt]) {
        if (!xdb.referenceDatabase.get(args[dbAddInt].toUpperCase())) {
          // check personal db if applicable
          if (sheetName.substr(0, 1) !== 'p') {
            if (!otherSheet) {
              await gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) => {
                otherSheet = xdb.referenceDatabase;
              });
            }
            if (otherSheet.get(args[dbAddInt].toUpperCase())) {
              // push to queue
              servers[message.guild.id].queue.push(otherSheet.get(args[dbAddInt].toUpperCase()));
              dbAddedToQueue++;
              dbAddInt++;
              continue;
            }
          }
          if (firstUnfoundRan) {
            unFoundString = unFoundString.concat(', ');
          }
          unFoundString = unFoundString.concat(args[dbAddInt]);
          firstUnfoundRan = true;
        } else {
          // push to queue
          servers[message.guild.id].queue.push(xdb.referenceDatabase.get(args[dbAddInt].toUpperCase()));
          dbAddedToQueue++;
        }
        dbAddInt++;
      }
      message.channel.send('*added ' + dbAddedToQueue + ' to queue*');
      if (firstUnfoundRan) {
        unFoundString = unFoundString.concat('*');
        message.channel.send(unFoundString);
      }
    } else {
      if (!xdb.referenceDatabase.get(args[1].toUpperCase())) {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ssi === 1 && ss && ss.length > 0 && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
          message.channel.send(
            "could not find '" + args[1] + "'. **Assuming '" + ss + "'**"
          );
          // push to queue
          if (playRightNow) {
            servers[message.guild.id].queue.unshift(xdb.referenceDatabase.get(ss.toUpperCase()));
            playSongToVC(message, xdb.referenceDatabase.get(ss.toUpperCase()), message.member.voice.channel, true);
            message.channel.send('*playing now*');
            return true;
          } else {
            servers[message.guild.id].queue.push(xdb.referenceDatabase.get(ss.toUpperCase()));
          }
        } else if (playRightNow) {
          if (printErrorMsg) {
            message.channel.send("There's something wrong with what you put there.");
            return true;
          } else {
            runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, true);
          }
          return false;
        } else if (!printErrorMsg) {
          if (sheetName.includes('p')) {
            message.channel.send("There's something wrong with what you put there.");
            return true;
          } else {
            runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, false);
            return true;
          }
        } else if (ss && ss.length > 0) {
          message.channel.send(
            "Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + '*'
          );
          return true;
        } else {
          message.channel.send("Could not find '" + args[1] + "' in database.");
          return true;
        }
      } else { // did find in database
        if (playRightNow) {
          // push to queue
          if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
            servers[message.guild.id].queue.unshift(xdb.referenceDatabase.get(args[1].toUpperCase()));
            playSongToVC(message, xdb.referenceDatabase.get(args[1].toUpperCase()), message.member.voice.channel, true);
            message.channel.send('*playing now*');
            return true;
          } else {
            if (printErrorMsg) {
              message.channel.send("There's something wrong with what you put there.");
            } else {
              runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, true);
            }
            return false;
          }
        } else {
          // push to queue
          servers[message.guild.id].queue.push(xdb.referenceDatabase.get(args[1].toUpperCase()));
        }
      }
      if (!queueWasEmpty && !playRightNow) {
        message.channel.send('*added to queue*');
      }
    }
    // if queue was empty then play
    if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
      playSongToVC(message, servers[message.guild.id].queue[0], message.member.voice.channel, true);
    }
  });
  return true;
}

// the search string
let ss;
// the number of searches found
let ssi;

/**
 * A search command that searches both the server and personal database for the string.
 * @param message The message that triggered the bot
 * @param mgid The guild id
 * @param providedString The string to search for
 */
function runUniversalSearchCommand (message, mgid, providedString) {
  gsrun(client2, 'A', 'B', mgid).then(async (xdb) => {
    ss = runSearchCommand(providedString, xdb).ss;
    if (ss && ss.length > 0) {
      message.channel.send('Server keys found: ' + ss);
    } else if (providedString.length < 2) {
      message.channel.send('Could not find any server keys that start with the given letter.');
    } else {
      message.channel.send('Could not find any server keys that contain \'' + providedString + '\'');
    }
    message.channel.send('Would you like to search your list as well? (yes or no)').then(() => {
      const filter = m => message.author.id === m.author.id;

      message.channel.awaitMessages(filter, {time: 30000, max: 1, errors: ['time']})
        .then(async messages => {
          if (messages.first().content.toLowerCase() === 'y' || messages.first().content.toLowerCase() === 'yes') {
            gsrun(client2, 'A', 'B', 'p' + message.member.id).then(async (xdb) => {
              ss = runSearchCommand(providedString, xdb).ss;
              if (ss && ss.length > 0) {
                message.channel.send('Personal keys found: ' + ss);
              } else if (providedString.length < 2) {
                message.channel.send('Could not find any keys in your list that start with the given letter.');
              } else {
                message.channel.send('Could not find any keys in your list that contain \'' + providedString + '\'');
              }
            });
          }
        });
    });
  });
}

/**
 * Searches the database for the keys matching args[1].
 * @param keyName the keyName
 * @param xdb the object containing multiple DBs
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values
 */
function runSearchCommand (keyName, xdb) {
  const givenSLength = keyName.length;
  const keyArray2 = Array.from(xdb.congratsDatabase.keys());
  ss = '';
  ssi = 0;
  let searchKey;
  for (let ik = 0; ik < keyArray2.length; ik++) {
    searchKey = keyArray2[ik];
    if (
      keyName.toUpperCase() ===
      searchKey.substr(0, givenSLength).toUpperCase() ||
      (keyName.length > 1 &&
        searchKey.toUpperCase().includes(keyName.toUpperCase()))
    ) {
      ssi++;
      if (!ss) {
        ss = searchKey;
      } else {
        ss += ', ' + searchKey;
      }
    }
  }

  return {
    ss: ss,
    ssi: ssi
  };
}

/**
 * Function to skip songs once or multiple times.
 * Recommended if voice channel is not present.
 * @param message the message that triggered the bot
 * @param skipTimes the number of times to skip
 */
function runSkipCommand (message, skipTimes) {
  if (skipTimes) {
    try {
      skipTimes = parseInt(skipTimes);
      if (skipTimes > 0 && skipTimes < 1001) {
        let skipCounter = 0;
        while (skipTimes > 1 && servers[message.guild.id].queue.length > 0) {
          servers[message.guild.id].queueHistory.push(servers[message.guild.id].queue.shift());
          skipTimes--;
          skipCounter++;
        }
        if (skipTimes === 1 && servers[message.guild.id].queue.length > 0) {
          skipCounter++;
        }
        skipSong(message, message.member.voice.channel, false);
        if (skipCounter > 1) {
          message.channel.send('*skipped ' + skipCounter + ' times*');
        } else {
          message.channel.send('*skipped 1 time*');
        }
      } else {
        message.channel.send('*invalid skip amount (must be between 1 - 1000)*');
      }
    } catch (e) {
      skipSong(message, message.member.voice.channel, true);
    }
  } else {
    skipSong(message, message.member.voice.channel, true);
  }
}

/**
 * Function to display help list.
 * @param {*} message the message that triggered the bot
 * @param {*} prefixString the prefix in string format
 */
function sendHelp (message, prefixString) {
  const helpListEmbed = new MessageEmbed();
  const description =
    '-------------  **Music Commands (with aliases)** -------------\n\`' +
    prefixString +
    'play [link] \` Plays YouTube/Spotify links [p] \n\`' +
    prefixString +
    'playnow [link] \` Plays the link now, overrides queue [pn]\n\`' +
    prefixString +
    '? \` What\'s playing\n\`' +
    prefixString +
    'pause \` Pause [pa]\n\`' +
    prefixString +
    'resume \` Resume if paused [res] \n\`' +
    prefixString +
    'skip [# times] \` Skip the current link [sk]\n\`' +
    prefixString +
    'rewind [# times] \` Rewind to play previous links  [rw]\n\`' +
    prefixString +
    'end \` Stops playing and ends session  [e]\n\`' +
    prefixString +
    'loop \` Loops songs on finish\n\`' +
    prefixString +
    'queue \` Displays the queue [q]\n' +
    '\n-----------  **Server Music Database**  -----------\n\`' +
    prefixString +
    "keys \` See all of the server's saved songs [k]\n\`" +
    prefixString +
    'add [song] [url] \` Adds a song to the server keys  [a]\n\`' +
    prefixString +
    'd [key] \` Play a song from the server keys \n\`' +
    prefixString +
    'rand [# times] \` Play a random song from server keys  [r]\n\`' +
    prefixString +
    'search [name] \` Search keys  [s]\n\`' +
    prefixString +
    'remove [key] \` Removes a song from the server keys  [rm]\n' +
    '\n-----------  **Personal Music Database**  -----------\n' +
    "*Prepend 'm' to the above commands to access your personal music database*\nex: \`" + prefixString + "mkeys \`\n" +
    '\n--------------  **Other Commands**  -----------------\n\`' +
    prefixString +
    'silence \` Temporarily silences the now playing notifications \n\`' +
    prefixString +
    'unsilence \` Re-enables now playing notifications \n\`' +
    prefixString +
    'guess \` Random roll for the number of people in the voice channel \n\`' +
    prefixString +
    'changeprefix [new prefix] \` Changes the prefix for all commands \n' +
    '\n**Or just say congrats to a friend. I will chime in too! :) **'
  ;
  helpListEmbed.setTitle('Help List');
  helpListEmbed.setDescription(description);
  message.channel.send(helpListEmbed);
}

/**
 * Function for searching for message contents on youtube for playback.
 * @param message The discord message
 * @param args The args to verify content
 * @param mgid The message guild id
 * @param playNow Bool, whether to override the queue
 * @param indexToLookup Optional: The word in a message to signify the search index
 * @param search Optional: For recursive call with memoization
 * @returns {Promise<*|boolean|undefined>}
 */
async function runYoutubeSearch (message, args, mgid, playNow, indexToLookup, search) {
  if (indexToLookup && !args[2] && !search) {
    return message.channel.send('no lookup word given');
  }
  let substrVal = 3;
  let num = parseInt(indexToLookup);
  if (!num) {
    num = 1;
  } else {
    substrVal += 2;
  }
  if (num < 0 || num > 5) {
    return message.channel.send('Provided lookup index following must be 1-5 ');
  }
  num--;
  if (!search) {
    search = await ytsr(message.content.substr(substrVal), {pages: 1});
    if (!search.items[0]) {
      return message.channel.send('could not find video');
    }
  }
  const args2 = [];
  args2[1] = search.items[num].url;
  if (args[1]) {
    if (playNow) {
      await runPlayNowCommand(message, args2, mgid, undefined);
    } else {
      await runPlayLinkCommand(message, args2, mgid, undefined);
    }
    if (num < 4 && (playNow || servers[mgid].queue.length < 2)) {
      await message.react('➡️');
      const filter = (reaction, user) => {
        if (message.member.voice.channel) {
          for (const mem of message.member.voice.channel.members) {
            if (user.id === mem[1].id) {
              return user.id !== bot.user.id && ['➡️'].includes(reaction.emoji.name);
            }
          }
        }
        return false;
      };

      const collector = message.createReactionCollector(filter, {time: 20000});
      const arrowReactionInterval = setInterval(() => {
        clearInterval(arrowReactionInterval);
        message.reactions.removeAll();
      }, 20000);
      collector.once('collect', (reaction, reactionCollector) => {
        clearInterval(arrowReactionInterval);
        if (num > 2) {
          message.reactions.removeAll();
        } else {
          reaction.users.remove(reactionCollector.id);
        }
        servers[mgid].queueHistory.push(servers[mgid].queue.shift());
        runYoutubeSearch(message, args, mgid, true, num += 2, search);
      });
    }
  } else {
    return message.channel.send('could not find video');
  }
}

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 */
function runRandomToQueue (num, message, sheetName) {
  if (!message.member.voice.channel) {
    return message.channel.send('must be in a voice channel to play random');
  }
  try {
    num = parseInt(num);
  } catch (e) {
    num = 1;
  }
  if (!servers[message.guild.id]) {
    servers[message.guild.id] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
  }
  if (servers[message.guild.id].queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  gsrun(client2, 'A', 'B', sheetName).then((xdb) => {
    if (!num) {
      addRandomToQueue(message, 1, xdb.congratsDatabase);
    } else {
      try {
        if (num && num >= maxQueueSize) {
          message.channel.send('*max limit for random is ' + maxQueueSize + '*');
          num = maxQueueSize;
        }
        addRandomToQueue(message, num, xdb.congratsDatabase);
      } catch (e) {
        addRandomToQueue(message, 1, xdb.congratsDatabase);
      }
    }
  });
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue
 * @param {Map} cdb The database to reference
 */
function addRandomToQueue (message, numOfTimes, cdb) {
  const rKeyArray = Array.from(cdb.keys());
  if (rKeyArray.length < 1 || (rKeyArray.length === 1 && rKeyArray[0].length < 1)) {
    return message.channel.send('Your music list is empty.');
  }
  const serverQueueLength = servers[message.guild.id].queue.length;
  // mutate numberOfTimes to not exceed maxQueueSize
  if (numOfTimes + serverQueueLength > maxQueueSize) {
    numOfTimes = maxQueueSize - serverQueueLength;
    if (numOfTimes === 0) {
      return message.channel.send('*max queue size has been reached*');
    }
  }
  let rn;
  let queueWasEmpty = false;
  if (servers[message.guild.id].queue.length < 1) {
    queueWasEmpty = true;
  }
  // the final random array to be added to the queue
  const rKeyArrayFinal = [];
  try {
    const newArray = [];
    let executeWhileInRand = true;
    for (let i = 0; i < numOfTimes; i++) {
      if (!newArray || newArray.length < 1 || executeWhileInRand) {
        const tempArray = [...rKeyArray];
        let j = 0;
        while (
          (tempArray.length > 0 && j <= numOfTimes) ||
          executeWhileInRand
          ) {
          const randomNumber = Math.floor(Math.random() * tempArray.length);
          newArray.push(tempArray[randomNumber]);
          tempArray.splice(randomNumber, 1);
          j++;
          executeWhileInRand = false;
        }
        // newArray has the new values
      }
      const aTest1 = newArray.pop();
      if (aTest1) {
        rKeyArrayFinal.push(aTest1);
      } else {
        executeWhileInRand = true;
        i--;
      }
    }
    // rKeyArrayFinal should have list of randoms here
  } catch (e) {
    console.log('error in random: ' + e);
    rn = Math.floor(Math.random() * rKeyArray.length);
    rKeyArrayFinal.push(rKeyArray[rn]);
  }
  rKeyArrayFinal.forEach(e => {
    servers[message.guild.id].queue.push(cdb.get(e));
  });
  if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
    playSongToVC(message, servers[message.guild.id].queue[0], message.member.voice.channel, true);
  } else {
    message.channel.send('*added ' + numOfTimes + ' to queue*');
  }
}

/**
 * Grabs all of the keys/names from the database
 * @param {*} message The message trigger
 * @param prefixString The character of the prefix
 * @param {*} sheetname The name of the sheet to retrieve
 * @param cmdType the prefix to call the keys being displayed
 * @param voiceChannel optional, a specific voice channel to use besides the message's
 * @param user optional user name, overrides the message owner's name
 */
function runKeysCommand (message, prefixString, sheetname, cmdType, voiceChannel, user) {
  if (
    !dataSize.get(sheetname.toString()) ||
    dataSize.get(sheetname.toString()) < 1
  ) {
    createSheet(message, sheetname);
  }
  gsrun(client2, 'A', 'B', sheetname).then((xdb) => {
    keyArray = Array.from(xdb.congratsDatabase.keys()).sort();
    s = '';
    let firstLetter = true;
    for (const key in keyArray) {
      if (firstLetter) {
        s = keyArray[key];
        firstLetter = false;
      } else {
        s = s + ', ' + keyArray[key];
      }
    }
    if (!s || s.length < 1) {
      let emptyDBMessage;
      if (!cmdType) {
        emptyDBMessage = "The server's ";
      } else {
        emptyDBMessage = 'Your ';
      }
      message.channel.send(emptyDBMessage + 'music database is empty.\n*Add a song by putting a word followed by a link -> ' +
        prefixString + cmdType + 'a [key] [link]*');
    } else {
      let dbName = '';
      let keysMessage = '';
      let keyEmbedColor = '#ffa200';
      if (cmdType === 'm') {
        let name;
        if (user) {
          name = user.username;
        } else {
          name = message.member.nickname;
        }
        if (!name) {
          name = message.author.username;
        }
        if (name) {
          keysMessage += '**' + name + "'s keys ** ";
          dbName = name.toLowerCase() + "'s keys";
        } else {
          keysMessage += '** Personal keys ** ';
          dbName = 'personal keys';
        }
      } else if (cmdType === '') {
        keysMessage += '**Server keys ** ';
        dbName = "server's keys";
        keyEmbedColor = '#ad5537';
      }
      const embedKeysMessage = new MessageEmbed();
      embedKeysMessage.setTitle(keysMessage).setDescription(s).setColor(keyEmbedColor).setFooter("(use '" + prefixString + cmdType + "d [key]' to play)\n");
      message.channel.send(embedKeysMessage).then(async sentMsg => {
        sentMsg.react('❔').then(() => sentMsg.react('🔀'));
        const filter = (reaction, user) => {
          return ['🔀', '❔'].includes(reaction.emoji.name) && user.id !== bot.user.id;
        };
        const keysButtonCollector = sentMsg.createReactionCollector(filter, {
          time: 1200000
        });
        keysButtonCollector.on('collect', (reaction, reactionCollector) => {
          if (reaction.emoji.name === '❔') {
            let nameToSend;
            if (dbName === "server's keys") {
              nameToSend = 'the server';
            } else {
              nameToSend = 'your personal';
            }
            const embed = new MessageEmbed()
              .setTitle('How to add/remove keys from ' + nameToSend + ' list')
              .setDescription('add a song by putting a word followed by a link -> ' +
                prefixString + cmdType + 'a [key] [link]\n' +
                'remove a song by putting the name you want to remove -> ' +
                prefixString + cmdType + 'rm [key]');
            message.channel.send(embed);
          } else if (reaction.emoji.name === '🔀') {
            if (!voiceChannel) {
              voiceChannel = message.member.voice.channel;
              if (!voiceChannel) return message.channel.send("must be in a voice channel to randomize");
            }
            for (const mem of voiceChannel.members) {
              if (reactionCollector.id === mem[1].id) {
                if (sheetname.includes('p')) {
                  if (reactionCollector.username) {
                    message.channel.send('*randomizing from ' + reactionCollector.username + "'s keys...*");
                  } else {
                    message.channel.send('*randomizing...*');
                  }
                  runRandomToQueue(100, message, 'p' + reactionCollector.id);
                } else {
                  message.channel.send('*randomizing from the server keys...*');
                  runRandomToQueue(100, message, sheetname);
                }
                return;
              }
            }
            return message.channel.send('must be in a voice channel to shuffle play');
          }
        });
      });
    }
  });
}

bot.on('voiceStateUpdate', update => {
  if (isInactive) return;
  // if the bot is the one leaving
  if (update.member.id === bot.user.id && !update.connection && embedMessageMap[update.guild.id] && embedMessageMap[update.guild.id].reactions) {
    embedMessageMap[update.guild.id].reactions.removeAll().then();
    embedMessageMap[update.guild.id] = false;
    servers[update.guild.id].collector.stop();
    servers[update.guild.id].collector = false;
  } else {
    const leaveVCTimeout = setInterval(() => {
      if (update.channel && !dispatcherMap[update.channel.id] && update.channel.members.size < 2) {
        // console.log(update.channel.members.values());
        update.channel.leave();
      }
      clearInterval(leaveVCTimeout);
    }, 1000);
  }
});

// bot.on('warning', console.warn);
// process.on('warning', console.warn);

/**
 *  The play function. Plays a given link to the voice channel.
 * @param {*} message the message that triggered the bot
 * @param {string} whatToPlay the link of the song to play
 * @param voiceChannel the voice channel to play the song in
 * @param sendEmbed whether to send an embed to the text channel
 */
async function playSongToVC (message, whatToPlay, voiceChannel, sendEmbed) {
  if (!voiceChannel || voiceChannel.members.size < 1 || !whatToPlay) {
    return;
  }
  if (isInactive) {
    message.channel.send('*db bot has been updated*');
    return runStopPlayingCommand(message.guild.id, voiceChannel);
  }
  // the url to play
  const url = whatToPlay;
  // the alternative spotify url
  let url2;
  let isSpotify = url.includes('spotify.com');
  if (isSpotify) {
    const infos = await spdl.getInfo(url);
    const search = await ytsr(infos.title + infos.artists.join(' '), {pages: 1});
    isSpotify = !search.items[0];
    url2 = search.items[0].url;
  }
  // remove previous embed buttons
  if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions && sendEmbed) {
    embedMessageMap[message.guild.id].reactions.removeAll();
    embedMessageMap[message.guild.id] = '';
    servers[message.guild.id].collector.stop();
    servers[message.guild.id].collector = false;
  }

  whatspMap[voiceChannel.id] = url;
  voiceChannel.join().then(async connection => {
    try {
      let dispatcher;
      await connection.voice.setSelfDeaf(true);
      if (!isSpotify) {
        dispatcher = connection.play(await ytdl(url2 ? url2 : url, {}), {
          type: 'opus',
          filter: 'audioonly',
          quality: '140',
          volume: false
        });
      } else {
        dispatcher = connection
          .play(await spdl(url),
            {
              highWaterMark: 1 << 25,
              volume: false,
            });
      }
      dispatcher.pause();
      dispatcherMap[voiceChannel.id] = dispatcher;
      // if the server is not silenced then send the embed when playing
      if (!silenceMap[message.guild.id] && sendEmbed) {
        await sendLinkAsEmbed(message, url, voiceChannel).then(() => dispatcher.setVolume(0.5));
      }
      let playBufferTime = 300;
      if (isSpotify) playBufferTime = 2850;
      skipTimesMap[message.guild.id] = 0;
      const tempInterval = setInterval(async () => {
        clearInterval(tempInterval);
        dispatcher.resume();
      }, playBufferTime);
      dispatcher.once('finish', async () => {
        let totalDuration;
        if (isSpotify) {
          totalDuration = await spdl.getInfo(url);
          totalDuration = totalDuration.duration;
        } else {
          totalDuration = await ytdl.getInfo(url);
          totalDuration = totalDuration.formats[0].approxDurationMs;
        }
        const streamTime = dispatcherMap[voiceChannel.id].streamTime;
        let streamIntervalTime = 1100;
        if (totalDuration && streamTime && (streamTime + 1100) < totalDuration) {
          streamIntervalTime = totalDuration - streamTime;
          console.log(url);
          console.log(totalDuration);
          console.log(streamTime);
          console.log('--- current stream time is less than total song duration ---');
          console.log('New time till end is ' + streamIntervalTime + '\n------------');
        }
        if (url !== whatspMap[voiceChannel.id]) {
          console.log('There was a mismatch -------------------');
          console.log('old url: ' + url);
          console.log('current url: ' + whatspMap[voiceChannel.id]);
          return;
        }
        const songFinish = setInterval(async () => {
          clearInterval(songFinish);
          // ensure that the next song only plays on previous song's end
          const streamTime2 = dispatcherMap[voiceChannel.id].streamTime;
          if (totalDuration && streamTime2 && (streamTime2 + 5000) < totalDuration) return console.log('ending alternative stream');
          if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions) {
            embedMessageMap[message.guild.id].reactions.removeAll().then();
            embedMessageMap[message.guild.id] = false;
            servers[message.guild.id].collector.stop();
            servers[message.guild.id].collector = false;
          }
          const server = servers[message.guild.id];
          if (voiceChannel.members.size < 2) {
            connection.disconnect();
          } else if (server.loop) {
            playSongToVC(message, url, voiceChannel, true);
          } else {
            server.queueHistory.push(server.queue.shift());
            if (server.queue.length > 0) {
              playSongToVC(message, server.queue[0], voiceChannel, true);
            } else {
              dispatcherMap[voiceChannel.id] = false;
            }
          }
        }, streamIntervalTime);
      });
    } catch (e) {
      // Error catching - fault with the link?
      message.channel.send('Could not play <' + url + '>');
      whatspMap[voiceChannel.id] = '';
      // search the db to find possible broken keys
      searchForBrokenLinkWithinDB(message, url);
      const numberOfPrevSkips = skipTimesMap[message.guild.id];
      if (!numberOfPrevSkips) {
        skipTimesMap[message.guild.id] = 1;
      } else if (numberOfPrevSkips > 3) {
        connection.disconnect();
        return;
      } else {
        skipTimesMap[message.guild.id] += 1;
      }
      runSkipCommand(message, 1);
    }
  });
}

// number of consecutive error skips in a server, uses guild id
const skipTimesMap = new Map();

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB (message, whatToPlayS) {
  gsrun(client2, 'A', 'B', message.channel.guild.id).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key, map) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the server db: ' + key + '*');
      }
    });
  });
  gsrun(client2, 'A', 'B', 'p' + message.member.id).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key, map) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the personal db: ' + key + '*');
      }
    });
  });
}

/**
 * Rewinds the song
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param voiceChannel The active voice channel
 * @param numberOfTimes The number of times to rewind
 * @returns {*}
 */
function runRewindCommand (message, mgid, voiceChannel, numberOfTimes) {
  let song;
  let rewindTimes = 1;
  try {
    if (numberOfTimes) {
      rewindTimes = parseInt(numberOfTimes);
    }
  } catch (e) {
    rewindTimes = 1;
    message.channel.send('rewinding once');
  }
  if (!rewindTimes || rewindTimes < 1 || rewindTimes > 10000) return message.channel.send('invalid rewind amount');
  let rwIncrementor = 0;
  while (servers[mgid].queueHistory.length > 0 && rwIncrementor < rewindTimes) {
    if (servers[mgid].queue.length > (maxQueueSize + 99)) {
      if (generatingEmbedMap[mgid]) {
        playSongToVC(message, servers[mgid].queue[0], voiceChannel, false);
      } else {
        playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
      }
      return message.channel.send('*max queue size has been reached, cannot rewind further*');
    }
    song = servers[mgid].queueHistory.pop();
    servers[mgid].queue.unshift(song);
    rwIncrementor++;
  }
  if (song) {
    if (rewindTimes === 1) {
      message.channel.send('*rewound*');
    } else {
      message.channel.send('*rewound ' + rwIncrementor + ' times*');
    }
    playSongToVC(message, song, voiceChannel, true);
  } else if (servers[mgid].queue[0]) {
    if (generatingEmbedMap[mgid]) {
      playSongToVC(message, servers[mgid].queue[0], voiceChannel, false);
    } else {
      playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
    }
    return message.channel.send('*replaying first song*');
  } else {
    return message.channel.send('cannot find previous song');
  }
}

/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear.
 * @param message the message to send the channel to
 * @param url the url to generate the embed for
 * @param voiceChannel the voice channel that the song is being played in
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed (message, url, voiceChannel) {
  let embed;
  let imgLink;
  let timeMS = 0;
  let showButtons = true;
  const mgid = message.member.guild.id;
  generatingEmbedMap[mgid] = true;
  let isSpotify = false;
  if (url.toString().includes('spotify.com')) {
    isSpotify = true;
  }
  if (isSpotify) {
    const infos = await spdl.getInfo(url);
    embed = new MessageEmbed()
      .setTitle(`${infos.title}`)
      .setURL(infos.url)
      .setColor('#1DB954')
      .addField(`Artist${infos.artists.length > 1 ? 's' : ''}`, infos.artists.join(', '), true)
      .addField('Duration', formatDuration(infos.duration), true);
    imgLink = infos.thumbnail;
    timeMS = parseInt(infos.duration);
    // .addField('Preview', `[Click here](${infos.preview_url})`, true) // adds a preview
  } else {
    const infos = await ytdl.getInfo(url);
    let duration = formatDuration(infos.formats[0].approxDurationMs);
    timeMS = parseInt(duration);
    if (duration === 'NaNm NaNs') {
      duration = 'N/A';
    }
    embed = new MessageEmbed()
      .setTitle(`${infos.videoDetails.title}`)
      .setURL(infos.videoDetails.video_url)
      .setColor('#c40d00')
      .addField('Duration', duration, true);
    imgLink = infos.videoDetails.thumbnails[0].url;
  }
  if (servers[mgid] && servers[mgid].queue && servers[mgid].queue.length > 0) {
    embed.addField('Queue', ' 1 / ' + servers[mgid].queue.length, true);
  } else {
    embed.addField('-', 'Last played', true);
    showButtons = false;
  }
  embed.setThumbnail(imgLink);
  if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions) {
    await embedMessageMap[message.guild.id].reactions.removeAll();
    embedMessageMap[message.guild.id] = '';
    servers[message.guild.id].collector.stop();
    servers[message.guild.id].collector = false;
  }

  if (url === whatspMap[voiceChannel.id]) {
    message.channel.send(embed)
      .then(await function (sentMsg) {
        if (!showButtons || !dispatcherMap[voiceChannel.id]) return;
        embedMessageMap[mgid] = sentMsg;
        sentMsg.react('⏪').then(() => {
          if (collector.ended) return;
          sentMsg.react('⏯').then(() => {
            if (collector.ended) return;
            sentMsg.react('⏩').then(() => {
              if (collector.ended) return;
              sentMsg.react('⏹').then(() => {
                if (collector.ended) return;
                sentMsg.react('🔑').then(() => {
                  if (collector.ended) return;
                  sentMsg.react('🔐').then(() => {
                    generatingEmbedMap[mgid] = false;
                  });
                });
              });
            });
          });
        });

        const filter = (reaction, user) => {
          if (voiceChannel) {
            for (const mem of voiceChannel.members) {
              if (user.id === mem[1].id) {
                return ['⏯', '⏩', '⏪', '⏹', '🔑', '🔐'].includes(reaction.emoji.name) && user.id !== bot.user.id;
              }
            }
          }
          return false;
        };

        timeMS += 3600000;

        const collector = sentMsg.createReactionCollector(filter, {
          time: timeMS
        });

        servers[mgid].collector = collector;

        collector.on('collect', (reaction, reactionCollector) => {
          if (!dispatcherMap[voiceChannel.id] || !voiceChannel) {
            return;
          }
          if (reaction.emoji.name === '⏩') {
            collector.stop();
            skipSong(message, voiceChannel, true);
          } else if (reaction.emoji.name === '⏯' &&
            (!dispatcherMapStatus[voiceChannel.id] ||
              dispatcherMapStatus[voiceChannel.id] === 'resume')) {
            dispatcherMap[voiceChannel.id].pause();
            dispatcherMapStatus[voiceChannel.id] = 'pause';
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏯' && dispatcherMapStatus[voiceChannel.id] === 'pause') {
            dispatcherMap[voiceChannel.id].resume();
            dispatcherMapStatus[voiceChannel.id] = 'resume';
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏪') {
            runRewindCommand(message, mgid, voiceChannel);
          } else if (reaction.emoji.name === '⏹') {
            collector.stop();
            runStopPlayingCommand(mgid, voiceChannel);
          } else if (reaction.emoji.name === '🔑') {
            runKeysCommand(message, prefixMap[mgid], mgid, '', voiceChannel, '');
          } else if (reaction.emoji.name === '🔐') {
            // console.log(reaction.users.valueOf().array().pop());
            runKeysCommand(message, prefixMap[mgid], 'p' + reactionCollector.id, 'm', voiceChannel, reactionCollector);
          }
        });
        // message.channel.send(`Button creation latency is ${Date.now() - message.createdTimestamp}ms`);
      });
  }
  // message.channel.send(`Embed creation latency is ${Date.now() - message.createdTimestamp}ms`);
}

/**
 * Stops playing in the given voice channel and leaves.
 * @param message The given message that triggered the bot
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 */
function runStopPlayingCommand (mgid, voiceChannel) {
  if (!voiceChannel) return;
  if (servers[mgid]) {
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  if (embedMessageMap[mgid] && embedMessageMap[mgid].reactions) {
    embedMessageMap[mgid].reactions.removeAll();
    embedMessageMap[mgid] = '';
    servers[mgid].collector.stop();
    servers[mgid].collector = false;
  }
  if (voiceChannel) {
    if (generatingEmbedMap[mgid]) {
      const waitForInit = setInterval(() => {
        voiceChannel.leave();
        clearInterval(waitForInit);
      }, 1000);
    } else {
      voiceChannel.leave();
    }
  }
}

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} args the message split into an array, delim by spaces
 * @param {*} message the message that activated the bot
 * @param {*} mgid The guild id
 * @param {*} sheetname The name of the sheet reference
 */
async function runWhatsPCommand (args, message, mgid, sheetname) {
  if (!servers[message.guild.id]) {
    servers[message.guild.id] = {
      queue: [],
      queueHistory: [],
      loop: false,
      collector: false
    };
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
  }
  if (args[1]) {
    gsrun(client2, 'A', 'B', sheetname).then((xdb) => {
      let dbType = "the server's";
      if (args[0].substr(1, 1).toLowerCase() === 'm') {
        dbType = 'your';
      }
      if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
        message.channel.send(xdb.referenceDatabase.get(args[1].toUpperCase()));
      } else if (
        whatspMap[message.member.voice.channel.id] &&
        !whatspMap[message.member.voice.channel.id].includes('Last Played:')
      ) {
        message.channel.send(
          "Could not find '" +
          args[1] +
          "' in " + dbType + ' database.\nCurrently playing: ' +
          whatspMap[message.member.voice.channel.id]
        );
      } else if (whatspMap[message.member.voice.channel.id]) {
        message.channel.send("Could not find '" + args[1] + "' in " + dbType + ' database.\n' +
          whatspMap[message.member.voice.channel.id]);
      } else {
        message.channel.send("Could not find '" + args[1] + "' in " + dbType + ' database.');
      }
    });
  } else {
    if (!message.member.voice.channel) {
      return message.channel.send('must be in a voice channel');
    }
    if (whatspMap[message.member.voice.channel.id] && whatspMap[message.member.voice.channel.id] !== '') {
      const msg = embedMessageMap[mgid];
      if (msg) {
        if (!generatingEmbedMap[mgid]) {
          embedMessageMap[mgid] = '';
          return await msg.reactions.removeAll().then(() =>
            sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel)
          );
        } else {
          return message.channel.send('*previous embed is generating...*');
        }
      } else {
        return await sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel);
      }
    } else {
      return message.channel.send('Nothing is playing right now');
    }
  }
  // message.channel.send(`WhatsP: Latency is ${Date.now() - message.createdTimestamp}ms.`);
}

// What's playing, uses voice channel id
const whatspMap = new Map();
// The server's prefix, uses guild id
const prefixMap = new Map();
// What is returned when searching the db, uses key-name
const congratsDatabase = new Map();
// Reference for the congrats database, uses uppercase key-name
const referenceDatabase = new Map();
// Whether silence mode is on (true, false), uses guild id
const silenceMap = new Map();
// The dataSize, uses sheet name
const dataSize = new Map();
// The song stream, uses voice channel id
const dispatcherMap = new Map();
// The messages containing embeds, uses guild id
const embedMessageMap = new Map();
// The status of a dispatcher, either "pause" or "resume"
const dispatcherMapStatus = new Map();
// boolean status of generating embed for a guild
const generatingEmbedMap = new Map();
// login to discord
bot.login(token);
