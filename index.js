const {google} = require("googleapis");
require('dotenv').config()

let client_email = process.env.CLIENT_EMAIL.replace(/\\n/gm, '\n');
let private_key = process.env.PRIVATE_KEY.replace(/\\n/gm, '\n');
let stoken = process.env.STOKEN.replace(/\\n/gm, '\n');
let token = process.env.TOKEN.replace(/\\n/gm, '\n');
let spotifyCID = process.env.SPOTIFY_CLIENT_ID.replace(/\\n/gm, '\n');
let spotifySCID = process.env.SPOTIFY_SECRET_CLIENT_ID.replace(/\\n/gm, '\n');


const client2 = new google.auth.JWT(client_email, null, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
]);

/**
 * Authorizes the google client
 */
client2.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
    } else {
        console.log("Connected to google apis.");
    }
});

/**
 * Runs an update over the sheet and updates local variables. Returns the respective keys
 * and values within two maps. The CDB is unaltered keys and values while the RDB containes toUpper values.
 * keys
 * @param cl The google client
 * @param columnToRun The column letter/string to get the keys
 * @param secondColumn The column letter/string to get the values
 * @param nameOfSheet The name of the sheet to get the values from
 * @returns {Promise<{congratsDatabase: Map<any, any>, line: [], referenceDatabase: Map<any, any>}|*>}
 */
async function gsrun(cl, columnToRun, secondColumn, nameOfSheet) {
    const gsapi = google.sheets({version: "v4", auth: cl});

    nameOfSheet = nameOfSheet.toString();
    const spreadsheetSizeObjects = {
        spreadsheetId: stoken,
        range: nameOfSheet + "!D1",
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

    // console.log("Data Size: " + dataSize.get(nameOfSheet));
    if (!dataSize.get(nameOfSheet)) {
        dataSize.set(nameOfSheet, 1);
        gsUpdateAdd2(cl, 1, "D", nameOfSheet);
        console.log("Data Size prev undef: " + dataSize.get(nameOfSheet));
        return gsrun(cl, columnToRun, secondColumn, nameOfSheet);
    }

    const songObjects = {
        spreadsheetId: stoken,
        range:
            nameOfSheet +
            "!" +
            columnToRun +
            "2:" +
            secondColumn +
            "B" +
            dataSize.get(nameOfSheet).toString(),
    };

    let dataSO = await gsapi.spreadsheets.values.get(songObjects);
    const arrayOfSpreadsheetValues = dataSO.data.values;
    //console.log(arrayOfSpreadsheetValues);

    // console.log("Database size: " + dataSize.get(nameOfSheet));

    let line;
    let keyT;
    let valueT;
    congratsDatabase.clear();
    referenceDatabase.clear();
    let keyArray = [];
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
function createSheet(message, nameOfSheet) {
    const gsapi = google.sheets({version: "v4", auth: client2});
    gsapi.spreadsheets.batchUpdate(
        {
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: nameOfSheet,
                            },
                        },
                    },
                ],
            },
        },
        function (err, response) {
            if (err) {
                // console.log('The API returned an error: ' + err);
            } else {
                gsrun(client2, "A", "B", message.guild.id).then(() => {
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
async function deleteRows(message, sheetName, rowNumber) {
    const gsapi = google.sheets({version: "v4", auth: client2});
    let res;
    try {
        const request = {
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            ranges: [sheetName],
            includeGridData: false,
            auth: client2,
        };

        res = await gsapi.spreadsheets.get(request)
    } catch (error) {
        console.log("Error get sheetId")
    }

    // gets the sheetId
    let sheetId = res.data.sheets[0].properties.sheetId;

// ----------------------------------------------------------
    gsapi.spreadsheets.batchUpdate(
        {
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: rowNumber,
                                endIndex: rowNumber + 1
                            }
                        }
                    }
                ],
            },
        },
        function (err, response) {
            if (err) {
                // console.log('The API returned an error: ' + err);
            } else {
                gsrun(client2, "A", "B", message.guild.id).then(() => {
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
function createSheetNoMessage(nameOfSheet) {
    console.log("within create sheets");
    const gsapi = google.sheets({version: "v4", auth: client2});
    gsapi.spreadsheets.batchUpdate(
        {
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: nameOfSheet,
                            },
                        },
                    },
                ],
            },
        },
        function (err, response) {
            if (err) {
                // console.log('The API returned an error: ' + err);
            } else {
                gsUpdateAdd2(client2, 1, "D", nameOfSheet);
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
function gsUpdateAdd(
    cl,
    key,
    link,
    firstColumnLetter,
    secondColumnLetter,
    nameOfSheet
) {
    const gsapi = google.sheets({version: "v4", auth: cl});
    gsapi.spreadsheets.values
        .append({
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            range:
                nameOfSheet + "!" + firstColumnLetter + "2:" + secondColumnLetter + "2",
            includeValuesInResponse: true,
            insertDataOption: "INSERT_ROWS",
            responseDateTimeRenderOption: "FORMATTED_STRING",
            responseValueRenderOption: "FORMATTED_VALUE",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[key, link]],
            },
        })
        .then(
            function (response) {
                // Handle the results here (response.result has the parsed body).
                // console.log("Response", response);
            },
            function (err) {
                console.error("Execute error", err);
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
function gsUpdateAdd2(cl, givenValue, firstColumnLetter, nameOfSheet) {
    const gsapi = google.sheets({version: "v4", auth: cl});
    gsapi.spreadsheets.values
        .append({
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            range: nameOfSheet + "!" + firstColumnLetter + "1",
            includeValuesInResponse: true,
            insertDataOption: "INSERT_ROWS",
            responseDateTimeRenderOption: "FORMATTED_STRING",
            responseValueRenderOption: "FORMATTED_VALUE",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[givenValue]],
            },
        })
        .then(
            function (response) {
                // Handle the results here (response.result has the parsed body).
                // console.log("Response", response);
            },
            function (err) {
                console.error("Execute error", err);
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
function gsUpdateOverwrite(cl, value, addOn, nameOfSheet) {
    if (value < 0) {
        try {
            value = parseInt(dataSize.get(nameOfSheet)) + addOn;
        } catch (e) {
            // console.log("Error caught gsUpdateOverview", value);
            value = 1;
            // console.log(e);
        }
    }
    const gsapi = google.sheets({version: "v4", auth: cl});
    gsapi.spreadsheets.values
        .update({
            spreadsheetId: "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
            range: nameOfSheet + "!D1",
            includeValuesInResponse: true,
            responseDateTimeRenderOption: "FORMATTED_STRING",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[value]],
            },
        })
        .then(
            function (response) {
                // Handle the results here (response.result has the parsed body).
                // console.log("Response", response);
            },
            function (err) {
                console.error("Execute error", err);
            }
        );
    gsrun(cl, "A", "B", "entries").then();
}

//---------------------------------- Above is Google Api --------------------


const {MessageEmbed, Client} = require('discord.js');
// initialization
const bot = new Client();
const ytdl = require("ytdl-core-discord");


// SPOTIFY BOT IMPORTS --------------------------
const spdl = require('spdl-core');

function formatDuration(duration) {
    let seconds = duration / 1000;
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

spdl.setCredentials(spotifyCID, spotifySCID);

// SPOTIFY BOT IMPORTS --------------------------

// UPDATE HERE - Before Git Push
const version = "1.1.0";
var servers = {};
bot.login(token);
// the max size of the queue
const maxQueueSize = 500;
var keyArray;
var s;

/**
 * Determines whether the message contains a form of congratulations
 * @param message The message that the discord client is parsing
 * @returns {*} true if congrats is detected
 */
function contentsContainCongrats(message) {
    return (
        message.content.includes("grats") ||
        message.content.includes("gratz") ||
        message.content.includes("ongratulations")
    );
}


process.setMaxListeners(0);

/**
 * Skips the song that is currently being played
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 */
function skipSong(message, voiceChannel, playMessageToChannel) {
    if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
            queue: [],
            queueHistory: []
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
        return;
    }
    if (!voiceChannel) {
        voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return;
        }
    }
    // if server queue is not empty
    if (
        servers[message.guild.id].queue &&
        servers[message.guild.id].queue.length > 0
    ) {
        servers[message.guild.id].queueHistory.push(servers[message.guild.id].queue.shift());
        if (playMessageToChannel) message.channel.send("*skipped*");
        // if there is still items in the queue then play next song
        if (servers[message.guild.id].queue.length > 0) {
            whatspMap[voiceChannel] =
                servers[message.guild.id].queue[0];
            // get rid of previous dispatch
            playSongToVC(message, whatspMap[voiceChannel], voiceChannel);
        } else {
            runStopPlayingCommand(message, message.guild.id, voiceChannel);
        }
    } else {
        runStopPlayingCommand(message, message.guild.id, voiceChannel);
    }
}

/**
 * Removes an item from the google sheets music database
 * @param message the message that triggered the bot
 * @param {string} keyName the key to remove
 * @param sheetName the name of the sheet to alter
 * @param sendMsgToChannel whether to send a response to the channel
 */
function runRemoveItemCommand(message, keyName, sheetName, sendMsgToChannel) {
    if (keyName) {
        gsrun(client2, "A", "B", sheetName).then(async (xdb) => {
            let couldNotFindKey = true;
            for (let i = 0; i < xdb.line.length; i++) {
                let itemToCheck = xdb.line[i];
                if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
                    i += 1;
                    couldNotFindKey = false;
                    await gsUpdateOverwrite(client2, -1, -1, sheetName);
                    await deleteRows(message, sheetName, i);
                    // console.log("Removed: " + itemToCheck);
                    if (sendMsgToChannel) {
                        message.channel.send("*removed '" + itemToCheck + "'*");
                    }
                }
            }
            if (couldNotFindKey && sendMsgToChannel) {
                gsrun(client2, "A", "B", sheetName).then(async (xdb) => {
                    let foundStrings = runSearchCommand(keyName, xdb).ss;
                    if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
                        message.channel.send("Could not find '" + keyName + "'.\n*Did you mean: " + foundStrings + "*");
                    } else {
                        let dbType = "the server's";
                        if (message.content.substr(1, 1).toLowerCase() === "m") {
                            dbType = "your";
                        }
                        message.channel.send("*could not find '" + keyName + "' in " + dbType + " database*");
                    }

                });
            }
        });
    } else {
        if (sendMsgToChannel) {
            message.channel.send("Need to specify the key to delete.");
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
function runPlayNowCommand(message, args, mgid, sheetName) {
    if (!message.member.voice.channel) {
        return;
    }
    if (!args[1]) {
        message.channel.send(
            "What should I play now? Put a link or a db key."
        );
        return;
    }
    if (!servers[mgid])
        servers[mgid] = {
            queue: [],
            queueHistory: []
        };
    // in case of force disconnect
    if (
        !message.guild.client.voice ||
        !message.guild.voice ||
        !message.guild.voice.channel
    ) {
        if (silenceMap[mgid]) {
            message.channel.send("*silence mode is on*");
        }
        servers[mgid].queue = [];
        servers[mgid].queueHistory = [];
    }
    if (servers[mgid].queue.length >= maxQueueSize) {
        message.channel.send("*max queue size has been reached*");
        return;
    }
    if (!args[1].includes(".")) {
        runDatabasePlayCommand(args, message, sheetName, true, false);
        return;
    }
    // push to queue
    servers[mgid].queue.unshift(args[1]);
    message.channel.send("*playing now*");
    playSongToVC(message, args[1], message.member.voice.channel);
}

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args The message broken into args
 * @param mgid The message guild id
 * @param url The url to play
 */
function runPlayLinkCommand(message, args, mgid) {
    if (!message.member.voice.channel) {
        return;
    }
    if (!args[1]) {
        message.channel.send(
            "Where's the link? I can't read your mind... unfortunately."
        );
        return;
    }
    if (!args[1].includes(".")) {
        message.channel.send(
            "There's something wrong with what you put there."
        );
        return;
    }
    if (!servers[mgid])
        servers[mgid] = {
            queue: [],
            queueHistory: []
        };
    // in case of force disconnect
    if (
        !message.guild.client.voice ||
        !message.guild.voice ||
        !message.guild.voice.channel
    ) {
        servers[mgid].queue = [];
        servers[mgid].queueHistory = [];
    }
    let queueWasEmpty = false
    if (servers[mgid].queue.length < 1) {
        queueWasEmpty = true;
    }
    let pNums = 1;
    while (args[pNums]) {
        let linkZ = args[pNums];
        if (linkZ.substring(linkZ.length - 1) === ",") {
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
        playSongToVC(message, args[1], message.member.voice.channel);
    } else if (pNums < 2) {
        message.channel.send("*added to queue*");
    } else {
        message.channel.send("*added " + pNums + " to queue*");
    }
}

/**
 * The execution for all of the bot commands
 * @param message
 * @returns {Promise<void>}
 */
async function runCommandCases(message) {
    let mgid = message.guild.id;
    let prefixString = prefixMap[mgid];
    if (!prefixString) {
        try {
            await gsrun(client2, "A", "B", "prefixes").then(async (xdb) => {
                let newPrefix = xdb.congratsDatabase.get(mgid);
                if (!newPrefix) {
                    prefixMap[mgid] = "!";
                    await gsUpdateAdd(client2, mgid, "!", "A", "B", "prefixes");
                } else {
                    prefixMap[mgid] = newPrefix;
                }
            });
        } catch (e) {
            prefixMap[mgid] = "!";
            gsUpdateAdd(client2, mgid, "!", "A", "B", "prefixes");
        }
    }
    prefixString = prefixMap[mgid];
    let firstWordBegin = message.content.substr(0, 14).trim() + " ";
    if (firstWordBegin.substr(0, 1) !== prefixString) {
        if (firstWordBegin === "!changeprefix " || firstWordBegin === "!keys " || firstWordBegin === "!h " || firstWordBegin === "!help ") {
            message.channel.send(
                "Current prefix is: " +
                prefixString
            );
        }
        return;
    }
    let args = message.content.replace(/\s+/g, " ").split(" ");
    console.log(args); // see recent bot commands within console
    let statement = args[0].substr(1).toLowerCase();
    if (statement.substr(0, 1) === "g") {
        if (message.member.id.toString() !== "443150640823271436" && message.member.id.toString() !== "268554823283113985") {
            return;
        }
    }
    switch (statement) {
        //!p is just the basic rhythm bot
        case "p":
            runPlayLinkCommand(message, args, mgid);
            break;
        case "play":
            runPlayLinkCommand(message, args, mgid);
            break;
        // !pn
        case "gpn":
            runPlayNowCommand(message, args, mgid, "entries");
            break;
        case "pn":
            runPlayNowCommand(message, args, mgid, mgid);
            break;
        case "playnow":
            runPlayNowCommand(message, args, mgid, mgid);
            break;
        case "mpn":
            runPlayNowCommand(message, args, mgid, "p" + message.member.id);
            break;
        case "mplaynow":
            runPlayNowCommand(message, args, mgid, "p" + message.member.id);
            break;
        //!e is the Stop feature
        case "e":
            runStopPlayingCommand(message, mgid, message.member.voice.channel);
            break;
        case "end":
            runStopPlayingCommand(message, mgid, message.member.voice.channel);
            break;
        // !s prints out the database size
        case "s":
            if (!args[1]) {
                message.channel.send(
                    "Database size: " + Array.from(congratsDatabase.keys()).length
                );
                return;
            }
            gsrun(client2, "A", "B", mgid).then(async (xdb) => {
                ss = runSearchCommand(args[1], xdb).ss;
                if (ss && ss.length > 0) {
                    message.channel.send("Keys found: " + ss);
                } else {
                    message.channel.send(
                        "Could not find any keys that start with the given letters."
                    );
                }
            });
            break;
        // !gd is to run database songs
        case "gd":
            runDatabasePlayCommand(args, message, "entries", false, true);
            break;
        // !d
        case "d":
            runDatabasePlayCommand(args, message, mgid, false, true);
            break;
        // !md is the personal database
        case "md":
            runDatabasePlayCommand(args, message, "p" + message.member.id, false, true);
            break;
        // !r is a random that works with the normal queue
        case "r":
            if (!message.member.voice.channel) {
                return;
            }
            runRandomToQueue(args[1], message, mgid);
            break;
        case "rand":
            if (!message.member.voice.channel) {
                return;
            }
            runRandomToQueue(args[1], message, mgid);
            break;
        // !gr is the global random to work with the normal queue
        case "gr":
            if (!message.member.voice.channel) {
                return;
            }
            runRandomToQueue(args[1], message, "entries");
            break;
        // !mr is the personal random that works with the normal queue
        case "mr":
            if (!message.member.voice.channel) {
                return;
            }
            runRandomToQueue(args[1], message, "p" + message.member.id);
            break;
        case "mrand":
            if (!message.member.voice.channel) {
                return;
            }
            runRandomToQueue(args[1], message, "p" + message.member.id);
            break;
        // !keys is server keys
        case "keys":
            runKeysCommand(message, prefixString, mgid, "", "");
            break;
        // !key
        case "key":
            runKeysCommand(message, prefixString, mgid, "", "");
            break;
        // !mkeys is personal keys
        case "mkeys":
            runKeysCommand(message, prefixString, "p" + message.member.id, "m", "");
            break;
        // !mkey is personal keys
        case "mkey":
            runKeysCommand(message, prefixString, "p" + message.member.id, "m", "");
            break;
        // !gkeys is global keys
        case "gkeys":
            runKeysCommand(message, prefixString, "entries", "g", "");
            break;
        // !gkey is global keys
        case "gkey":
            runKeysCommand(message, prefixString, "entries", "g", "");
            break;
        // !k is the search
        case "k":
            if (!args[1]) {
                message.channel.send("No argument was given.");
                return;
            }
            gsrun(client2, "A", "B", mgid).then(async (xdb) => {
                ss = runSearchCommand(args[1], xdb).ss;
                if (ss && ss.length > 0) {
                    message.channel.send("Keys found: " + ss);
                } else {
                    message.channel.send(
                        "Could not find any keys that start with the given letters."
                    );
                }
            });
            break;
        // !search is the search
        case "search":
            if (!args[1]) {
                message.channel.send("No argument was given.");
                return;
            }
            gsrun(client2, "A", "B", mgid).then(async (xdb) => {
                ss = runSearchCommand(args[1], xdb).ss;
                if (ss && ss.length > 0) {
                    message.channel.send("Keys found: " + ss);
                } else {
                    message.channel.send(
                        "Could not find any keys that start with the given letters."
                    );
                }
            });
            break;
        // !gk
        case "gk":
            if (!args[1]) {
                message.channel.send("No argument was given.");
                return;
            }
            gsrun(client2, "A", "B", "entries").then(async (xdb) => {
                ss = runSearchCommand(args[1], xdb).ss;
                if (ss && ss.length > 0) {
                    message.channel.send("Keys found: " + ss);
                } else {
                    message.channel.send(
                        "Could not find any keys that start with the given letters."
                    );
                }
            });
            break;
        // !? is the command for what's playing?
        case "?":
            runWhatsPCommand(args, message, mgid, mgid);
            break;
        case "g?":
            runWhatsPCommand(args, message, mgid, "entries");
            break;
        case "m?":
            runWhatsPCommand(args, message, mgid, "p" + message.member.id);
            break;
        case "changeprefix":
            if (!args[1]) {
                message.channel.send(
                    "No argument was given. Enter the new prefix after the command."
                );
                return;
            }
            if (args[1].length > 1) {
                message.channel.send(
                    "Prefix length cannot be greater than 1."
                );
                return;
            }
            if (args[1] === "+" || args[1] === "=") {
                message.channel.send("Cannot have " + args[1] + " as a prefix.");
                return;
            }
            args[2] = args[1];
            args[1] = mgid;
            message.channel.send("*changing prefix...*");
            await gsrun(client2, "A", "B", "prefixes").then(async () => {
                await runRemoveItemCommand(message, args[1], "prefixes", false);
                await runAddCommand(args, message, "prefixes", false);
                await gsrun(client2, "A", "B", "prefixes").then(async (xdb) => {
                    await gsUpdateOverwrite(client2, xdb.congratsDatabase.size + 2, 1, "prefixes");
                    prefixMap[mgid] = args[2];
                    message.channel.send("Prefix successfully changed to " + args[2]);
                });
            });
            break;
        // list commands for public commands
        case "h":
            sendHelp(message, prefixString);
            break;
        case "help":
            sendHelp(message, prefixString);
            break;
        // !skip
        case "skip":
            runSkipCommand(message, args);
            break;
        // !sk
        case "sk":
            runSkipCommand(message, args);
            break;
        // !pa
        case "pa":
            if (
                message.member.voice &&
                dispatcherMap[message.member.voice.channel]
            ) {
                dispatcherMap[message.member.voice.channel].pause();
                dispatcherMapStatus[message.member.voice.channel] = "pause";
                message.channel.send("*paused*");
            }
            break;
        case "pause":
            if (
                message.member.voice &&
                dispatcherMap[message.member.voice.channel]
            ) {
                dispatcherMap[message.member.voice.channel].pause();
                dispatcherMapStatus[message.member.voice.channel] = "pause";
                message.channel.send("*paused*");
            }
            break;
        // !pl
        case "pl":
            if (
                message.member.voice &&
                dispatcherMap[message.member.voice.channel]
            ) {
                dispatcherMap[message.member.voice.channel].resume();
                dispatcherMapStatus[message.member.voice.channel] = "resume";
                message.channel.send("*playing*");
            }
            break;
        case "res":
            if (
                message.member.voice &&
                dispatcherMap[message.member.voice.channel]
            ) {
                dispatcherMap[message.member.voice.channel].resume();
                dispatcherMapStatus[message.member.voice.channel] = "resume";
                message.channel.send("*playing*");
            }
            break;
        case "resume":
            if (
                message.member.voice &&
                dispatcherMap[message.member.voice.channel]
            ) {
                dispatcherMap[message.member.voice.channel].resume();
                dispatcherMapStatus[message.member.voice.channel] = "resume";
                message.channel.send("*playing*");
            }
            break;
        // !v prints out the version number
        case "v":
            message.channel.send("version: " + version + "\n" + latestRelease);
            break;
        // !devadd
        case "devadd":
            if (message.member.id.toString() !== "443150640823271436" && message.member.id.toString() !== "268554823283113985") {
                return;
            }
            message.channel.send(
                "Here's link to add to the database:\n" +
                "https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622"
            );
            break;
        // !ga adds to the server database
        case "ga":
            if (!args[1] || !args[2]) {
                return message.channel.send(
                    "Could not add to the database. Put a song name followed by a link."
                );
            }
            if (!args[2].includes(".")) {
                return message.channel.send("You can only add links to the database.");
            }
            if (args[2].includes("spotify.com")) {
                if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
            } else {
                if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
            }
            // in case the database has not been initialized
            gsrun(client2, "A", "B", "entries").then(() => {
                runAddCommand(args, message, "entries", true);
            });
            break;
        // !a is normal add
        case "a":
            if (!args[1] || !args[2]) {
                return message.channel.send(
                    "Incorrect format. Put a desired key-name followed by a link. *(ex: "
                    + prefixString + "a [key] [link])*"
                );
            }
            if (!args[2].includes(".")) {
                return message.channel.send("You can only add links to the database. (Names cannot be more than one word)");
            }
            if (args[2].includes("spotify.com")) {
                if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
            } else {
                if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
            }
            // in case the database has not been initialized
            gsrun(client2, "A", "B", mgid).then(() => {
                if (
                    !dataSize.get(mgid.toString()) ||
                    dataSize.get(mgid.toString()) < 1
                ) {
                    message.channel.send("Please try again.");
                } else {
                    runAddCommand(args, message, mgid, true);
                }
            });
            break;
        case "add":
            if (!args[1] || !args[2]) {
                return message.channel.send(
                    "Could not add to the database. Put a desired name followed by a link. *(ex: "
                    + prefixString + "a [key] [link])*"
                );
            }
            if (!args[2].includes(".")) {
                return message.channel.send("You can only add links to the database. (Names cannot be more than one word)");
            }
            if (args[2].includes("spotify.com")) {
                if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
            } else {
                if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
            }
            // in case the database has not been initialized
            gsrun(client2, "A", "B", mgid).then(() => {
                if (
                    !dataSize.get(mgid.toString()) ||
                    dataSize.get(mgid.toString()) < 1
                ) {
                    message.channel.send("Please try again.");
                } else {
                    runAddCommand(args, message, mgid, true);
                }
            });
            break;
        // !ma is personal add
        case "ma":
            if (!args[1] || !args[2]) {
                return message.channel.send(
                    "Could not add to the database. Put a desired name followed by a link. *(ex: "
                    + prefixString + "ma [key] [link])*"
                );
            }
            if (!args[2].includes(".")) {
                return message.channel.send("You can only add links to the database. (Names cannot be more than one word)");
            }
            if (args[2].includes("spotify.com")) {
                if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
            } else {
                if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
            }
            // in case the database has not been initialized
            gsrun(client2, "A", "B", "p" + message.member.id).then(() => {
                if (
                    !dataSize.get("p" + message.member.id.toString()) ||
                    dataSize.get("p" + message.member.id.toString()) < 1
                ) {
                    message.channel.send("Please try again.");
                } else {
                    runAddCommand(args, message, "p" + message.member.id, true);
                }
            });
            break;
        case "madd":
            if (!args[1] || !args[2]) {
                return message.channel.send(
                    "Could not add to the database. Put a desired name followed by a link. *(ex: "
                    + prefixString + "ma [key] [link])*"
                );
            }
            if (!args[2].includes(".")) {
                return message.channel.send("You can only add links to the database. (Names cannot be more than one word)");
            }
            if (args[2].includes("spotify.com")) {
                if (!spdl.validateURL(args[2])) return message.channel.send('Invalid link');
            } else {
                if (!ytdl.validateURL(args[2])) return message.channel.send('Invalid link');
            }
            // in case the database has not been initialized
            gsrun(client2, "A", "B", "p" + message.member.id).then(() => {
                if (
                    !dataSize.get("p" + message.member.id.toString()) ||
                    dataSize.get("p" + message.member.id.toString()) < 1
                ) {
                    message.channel.send("Please try again.");
                } else {
                    runAddCommand(args, message, "p" + message.member.id, true);
                }
            });
            break;
        // !rm removes database entries
        case "rm":
            runRemoveItemCommand(message, args[1], mgid, true);
            break;
        case "remove":
            runRemoveItemCommand(message, args[1], mgid, true);
            break;
        // !grm removes database entries
        case "grm":
            runRemoveItemCommand(message, args[1], "entries", true);
            break;
        // !rm removes database entries
        case "mrm":
            runRemoveItemCommand(message, args[1], "p" + message.member.id, true);
            break;
        case "mremove":
            runRemoveItemCommand(message, args[1], "p" + message.member.id, true);
            break;
        case "invite":
            message.channel.send("Here's the invite link!\nhttps://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot");
            break;
        case "vol":
            if (!args[1]) {
                message.channel.send("Need to provide volume limit (1-10)");
                return;
            }
            if (!dispatcherMap[message.member.voice.channel]) {
                message.channel.send("*Stream could not be found*");
                return;
            }
            try {
                let newVol = parseInt(args[1]);
                if (newVol < 11 && newVol > 0) {
                    dispatcherMap[message.member.voice.channel].setVolume(newVol / 10);
                    message.channel.send("*volume set to " + newVol + "*");

                } else {
                    message.channel.send("Need to provide volume limit (1-10)");
                }
            } catch (e) {
                message.channel.send("Need to provide volume limit (1-10)");
            }
            break;
        case "silence":
            if (!message.member.voice.channel) {
                message.channel.send("You must be in a voice channel to silence");
                return;
            }
            if (silenceMap[mgid]) {
                message.channel.send("*song notifications already silenced*");
                return;
            }
            silenceMap[mgid] = true;
            message.channel.send("*song notifications temporarily silenced*");
            break;
        case "unsilence":
            if (!message.member.voice.channel) {
                message.channel.send("You must be in a voice channel to unsilence");
                return;
            }
            if (!silenceMap[mgid]) {
                message.channel.send("*song notifications already unsilenced*");
                return;
            }
            silenceMap[mgid] = false;
            message.channel.send("*song notifications enabled*");
            if (dispatcherMap[message.member.voice.channel]) {
                sendLinkAsEmbed(message, whatspMap[message.member.voice.channel], message.member.voice.channel).then();
            }
            break;
        case "gzs":
            message.channel.send(bot.guilds.cache.size);
            break;
        case "gzup":
            message.channel.send(bot.uptime);
            break;
        // !rand
        case "guess":
            if (args[1]) {
                const numToCheck = parseInt(args[1]);
                if (!numToCheck || numToCheck < 1) {
                    message.channel.send("Number has to be positive.");
                    return;
                }
                let randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
                message.channel.send(
                    "Assuming " +
                    numToCheck +
                    " in total. Your number is " +
                    randomInt2 +
                    "."
                );
            } else {
                if (
                    message.member &&
                    message.member.voice &&
                    message.member.voice.channel
                ) {
                    const numToCheck = message.member.voice.channel.members.size;
                    if (numToCheck < 1) {
                        message.channel.send(
                            "Need at least 1 person in a voice channel."
                        );
                        return;
                    }
                    let randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
                    message.channel.send(
                        "Assuming " +
                        numToCheck +
                        " people. Your number is " +
                        randomInt2 +
                        "."
                    );
                    // message.channel.send("You need to input a upper limit");
                }
            }
            break;
    }
}

bot.on('guildCreate', guild => {
    guild.systemChannel.send("Thanks for adding me :) \nType '!h' to see my commands.");
});


// parses message, provides a response
bot.on("message", (message) => {
    if (message.author.bot) return;
    if (contentsContainCongrats(message)) {
        if (message.author.bot) return;
        const messageArray = message.content.split(" ");
        for (let i = 0; i < messageArray.length; i++) {
            if (!servers[message.guild.id])
                servers[message.guild.id] = {
                    queue: [],
                    queueHistory: []
                };
            //servers[message.guild.id].queue.push(args[1]);
            let word = messageArray[i];
            console.log(word);
            if (
                (word.includes("grats") ||
                    word.includes("gratz") ||
                    word.includes("ongratulation")) &&
                !word.substring(0, 1).includes("!")
            ) {
                message.channel.send("Congratulations!");
                playSongToVC(message, "https://www.youtube.com/watch?v=oyFQVZ2h0V8", message.member.voice.channel);
                return;
            }
        }
    } else {
        runCommandCases(message);
    }
});

/**
 * The command to add a song to a given database.
 * @param {*} args The command arguments
 * @param {*} message The message that triggered the command
 * @param {string} sheetName the name of the sheet to add to
 * @param printMsgToChannel whether to print response to channel
 */
function runAddCommand(args, message, sheetName, printMsgToChannel) {
    let songsAddedInt = 0;
    let z = 1;
    while (args[z] && args[z + 1]) {
        let linkZ = args[z + 1];
        if (linkZ.substring(linkZ.length - 1) === ",") {
            linkZ = linkZ.substring(0, linkZ.length - 1);
        }
        gsUpdateAdd(client2, args[z], args[z + 1], "A", "B", sheetName);
        z = z + 2;
        songsAddedInt += 1;
    }
    if (printMsgToChannel) {
        let ps = prefixMap[message.guild.id];
        // the specific database user-access character
        let databaseType = args[0].substr(1, 1).toLowerCase();
        if (databaseType === "a") {
            databaseType = "";
        }
        if (songsAddedInt === 1) {
            let typeString;
            if (databaseType === "m") {
                typeString = "your personal";
            } else {
                typeString = "the server's";
            }
            message.channel.send("*song added to " + typeString + " database. (see '" + ps + databaseType + "keys')*");
        } else if (songsAddedInt > 1) {
            gsrun(client2, "A", "B", sheetName).then(() => {
                gsUpdateOverwrite(client2, -1, songsAddedInt, sheetName);
                message.channel.send("*" + songsAddedInt + " songs added to the database. (see '" + ps + databaseType + "keys')*");
            });
        } else {
            message.channel.send("Please call '!keys' to initialize the database.");
        }
    }
}

/**
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetname the name of the google sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @returns whether the play command has been handled accordingly, no followup
 */
function runDatabasePlayCommand(args, message, sheetname, playRightNow, printErrorMsg) {
    if (!args[1]) {
        message.channel.send(
            "There's nothing to play! ... I'm just gonna pretend that you didn't mean that."
        );
        return true;
    }
    if (!message.member.voice.channel) {
        return true;
    }
    if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
            queue: [],
            queueHistory: []
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
    }
    if (servers[message.guild.id].queue.length >= maxQueueSize) {
        message.channel.send("*max queue size has been reached*");
        return true;
    }
    gsrun(client2, "A", "B", sheetname).then((xdb) => {
        let queueWasEmpty = false;
        // if the queue is empty then play
        if (servers[message.guild.id].queue.length < 1) {
            queueWasEmpty = true;
        }
        if (args[2] && !playRightNow) {
            let dbAddInt = 1;
            let unFoundString = "*could not find: ";
            let firstUnfoundRan = false;
            let dbAddedToQueue = 0;
            while (args[dbAddInt]) {
                if (!xdb.referenceDatabase.get(args[dbAddInt].toUpperCase())) {
                    if (firstUnfoundRan) {
                        unFoundString = unFoundString.concat(", ");
                    }
                    unFoundString = unFoundString.concat(args[dbAddInt]);
                    firstUnfoundRan = true;
                } else {
                    // push to queue
                    servers[message.guild.id].queue.push(
                        xdb.referenceDatabase.get(args[dbAddInt].toUpperCase())
                    );
                    dbAddedToQueue++;
                }
                dbAddInt++;
            }
            message.channel.send("*added " + dbAddedToQueue + " to queue*");
            if (firstUnfoundRan) {
                unFoundString = unFoundString.concat("*");
                message.channel.send(unFoundString);
            }
        } else {
            if (!xdb.referenceDatabase.get(args[1].toUpperCase())) {
                let ss = runSearchCommand(args[1], xdb).ss;
                if (ssi === 1 && ss && ss.length > 0 && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
                    message.channel.send(
                        "could not find '" + args[1] + "'. **Assuming '" + ss + "'**"
                    );
                    // push to queue
                    if (playRightNow) {
                        servers[message.guild.id].queue.unshift(xdb.referenceDatabase.get(ss.toUpperCase()));
                        playSongToVC(message, xdb.referenceDatabase.get(ss.toUpperCase()), message.member.voice.channel);
                        message.channel.send("*playing now*");
                        return true;
                    } else {
                        servers[message.guild.id].queue.push(xdb.referenceDatabase.get(ss.toUpperCase()));
                    }
                } else if (playRightNow) {
                    if (printErrorMsg) {
                        message.channel.send("There's something wrong with what you put there.");
                    } else {
                        runDatabasePlayCommand(args, message, "p" + message.member.id, playRightNow, true);
                    }
                    return false;
                } else if (ss && ss.length > 0) {
                    message.channel.send(
                        "Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + "*"
                    );
                    return true;
                } else {
                    message.channel.send("Could not find '" + args[1] + "' in database.");
                    return true;
                }
            } else {
                if (playRightNow) {
                    // push to queue
                    if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
                        servers[message.guild.id].queue.unshift(xdb.referenceDatabase.get(args[1].toUpperCase()));
                        playSongToVC(message, xdb.referenceDatabase.get(args[1].toUpperCase()), message.member.voice.channel);
                        message.channel.send("*playing now*");
                        return true;
                    } else {
                        if (printErrorMsg) {
                            message.channel.send("There's something wrong with what you put there.");
                        } else {
                            runDatabasePlayCommand(args, message, "p" + message.member.id, playRightNow, true);
                        }
                        return false;
                    }
                } else {
                    // push to queue
                    servers[message.guild.id].queue.push(xdb.referenceDatabase.get(args[1].toUpperCase()));
                }
            }
            if (!queueWasEmpty && !playRightNow) {
                message.channel.send("*added to queue*");
            }
        }
        // if queue was empty then play
        if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
            playSongToVC(message, servers[message.guild.id].queue[0], message.member.voice.channel);
        }
    });
    return true;
}

// The search command
let ss; // the search string
let ssi; // the number of searches found
/**
 * Searches the database for the keys matching args[1].
 * @param keyName the keyName
 * @param xdb the object containing multiple DBs
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values
 */
function runSearchCommand(keyName, xdb) {
    let givenSLength = keyName.length;
    let keyArray2 = Array.from(xdb.congratsDatabase.keys());
    ss = "";
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
                ss += ", " + searchKey;
            }
        }
    }

    return {
        ss: ss,
        ssi: ssi
    };
}

/**
 * Function to skip songs once or multiple times depending on args
 * @param message the message that triggered the bot
 * @param args args[1] can optionally have number of times to skip
 */
function runSkipCommand(message, args) {
    if (args[1]) {
        try {
            let skipTimes = parseInt(args[1]);
            if (skipTimes > 0 && skipTimes < 501) {
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
                    message.channel.send("*skipped " + skipCounter + " times*");
                } else {
                    message.channel.send("*skipped 1 time*");
                }
            } else {
                message.channel.send("*invalid skip amount (should be between 1-" + maxQueueSize + ")\n skipped 1 time*");
                skipSong(message, message.member.voice.channel, false);
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
function sendHelp(message, prefixString) {
    message.channel.send(
        "Help list:\n" +
        "--------------  Music Commands  -----------------\n" +
        prefixString +
        "play [link]  -->  Plays YouTube/Spotify links (" + prefixString + "p) \n" +
        prefixString +
        "playnow [link]  -->  Plays the link now, overrides queue (" + prefixString + "pn)\n" +
        prefixString +
        "?  -->  What's playing\n" +
        prefixString +
        "pause  -->  Pause (" + prefixString + "pa)\n" +
        prefixString +
        "resume  -->  Resume if paused (" + prefixString + "res) \n" +
        prefixString +
        "skip  -->  Skip the current song (" + prefixString + "sk)\n" +
        prefixString +
        "end  -->  Stops playing and ends session (" + prefixString + "e)\n" +
        "\n-----------  Server Music Database  -----------\n" +
        prefixString +
        "keys  -->  See all of the server's saved songs \n" +
        prefixString +
        "add [song] [url]  -->  Adds a song to the server keys (" + prefixString + "a)\n" +
        prefixString +
        "d [key]  -->  Play a song from the server keys \n" +
        prefixString +
        "rand [# of times]  -->  Play a random song from server keys (" + prefixString + "r)\n" +
        prefixString +
        "k [name]  -->  Search keys \n" +
        prefixString +
        "remove [key] -->  Removes a song from the server keys (" + prefixString + "rm)\n" +
        "\n-----------  Personal Music Database  -----------\n" +
        "*Prepend 'm' to the above commands to access your personal music database (ex: '" + prefixString + "mkeys')*\n" +
        "\n--------------  Other Commands  -----------------\n" +
        prefixString +
        "changeprefix [new prefix]  -->  Changes the prefix for all commands \n" +
        prefixString +
        "guess  -->  Random roll for the number of people in the voice channel \n" +
        prefixString +
        "silence  -->  Temporarily silences the now playing notifications \n" +
        prefixString +
        "unsilence  -->  Re-enables now playing notifications \n" +
        "\n**Or just say congrats to a friend. I will chime in too! :) **"
    );
}

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetname The name of the sheet to reference
 */
function runRandomToQueue(num, message, sheetname) {
    try {
        num = parseInt(num);
    } catch (e) {
        num = 1;
    }
    if (!servers[message.guild.id])
        servers[message.guild.id] = {
            queue: [],
            queueHistory: []
        };
    // in case of force disconnect
    if (
        !message.guild.client.voice ||
        !message.guild.voice ||
        !message.guild.voice.channel
    ) {
        servers[message.guild.id].queue = [];
        servers[message.guild.id].queueHistory = [];
    }
    if (servers[message.guild.id].queue.length > maxQueueSize) {
        message.channel.send("*max queue size has been reached*");
        return;
    }
    gsrun(client2, "A", "B", sheetname).then((xdb) => {
        if (!num) {
            addRandomToQueue(message, 1, xdb.congratsDatabase);
        } else {
            try {
                if (num && num >= maxQueueSize) {
                    message.channel.send("*max limit for random is " + maxQueueSize + "*");
                    num = maxQueueSize;
                }
                if (servers[message.guild.id].queue.length >= maxQueueSize) {
                    message.channel.send("*max queue size has been reached*");
                    return;
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
 * @param message
 * @param numOfTimes
 * @param {Map} cdb
 */
function addRandomToQueue(message, numOfTimes, cdb) {
    const rKeyArray = Array.from(cdb.keys());
    if (rKeyArray.length < 1 || (rKeyArray.length === 1 && rKeyArray[0].length < 1)) {
        message.channel.send(
            "Your music list is empty."
        );
        return;
    }
    let serverQueueLength = servers[message.guild.id].queue.length;
    // mutate numberOfTimes to not exceed maxQueueSize
    if (numOfTimes + serverQueueLength > maxQueueSize) {
        numOfTimes = maxQueueSize - serverQueueLength;
        if (numOfTimes === 0) {
            message.channel.send("*max queue size has been reached*");
            return;
        }
    }
    let rn;
    let queueWasEmpty = false;
    if (servers[message.guild.id].queue.length < 1) {
        queueWasEmpty = true;
    }
    // the final random array to be added to the queue
    let rKeyArrayFinal = [];
    try {
        let newArray = [];
        let executeWhileInRand = true;
        for (let i = 0; i < numOfTimes; i++) {
            if (!newArray || newArray.length < 1 || executeWhileInRand) {
                let tempArray = [...rKeyArray];
                let j = 0;
                while (
                    (tempArray.length > 0 && j <= numOfTimes) ||
                    executeWhileInRand
                    ) {
                    let randomNumber = Math.floor(Math.random() * tempArray.length);
                    newArray.push(tempArray[randomNumber]);
                    tempArray.splice(randomNumber, 1);
                    j++;
                    executeWhileInRand = false;
                }
                // newArray has the new values
            }
            let aTest1 = newArray.pop();
            if (aTest1) {
                rKeyArrayFinal.push(aTest1);
            } else {
                executeWhileInRand = true;
                i--;
            }
        }
        //rKeyArrayFinal should have list of randoms here
    } catch (e) {
        console.log("error in random: " + e);
        rn = Math.floor(Math.random() * rKeyArray.length);
        rKeyArrayFinal.push(rKeyArray[rn]);
    }
    rKeyArrayFinal.forEach(e => {
        servers[message.guild.id].queue.push(cdb.get(e));
    });
    if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
        playSongToVC(message, servers[message.guild.id].queue[0], message.member.voice.channel);
    } else {
        message.channel.send("*added " + numOfTimes + " to queue*");
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
function runKeysCommand(message, prefixString, sheetname, cmdType, voiceChannel, user) {
    if (
        !dataSize.get(sheetname.toString()) ||
        dataSize.get(sheetname.toString()) < 1
    ) {
        createSheet(message, sheetname);
    }
    if (!voiceChannel) {
        voiceChannel = message.member.voice.channel;
    }
    gsrun(client2, "A", "B", sheetname).then((xdb) => {
        keyArray = Array.from(xdb.congratsDatabase.keys()).sort();
        s = "";
        for (let key in keyArray) {
            if (key == 0) {
                s = keyArray[key];
            } else {
                s = s + ", " + keyArray[key];
            }
        }
        if (!s || s.length < 1) {
            let emptyDBMessage;
            if (!cmdType) {
                emptyDBMessage = "The server's ";
            } else {
                emptyDBMessage = "Your ";
            }
            message.channel.send(emptyDBMessage + "music database is empty.\n*Add a song by putting a word followed by a link -> "
                + prefixString + cmdType + "a [key] [link]*");
        } else {
            let dbName = "";
            let keysMessage = "";

            if (cmdType === "m") {
                let name;
                if (user) {
                    name = user.username;
                } else {
                    name = message.member.nickname;
                }
                if (!name) {
                    name = message.author.username
                }
                if (name) {
                    keysMessage += "**" + name + "'s keys ** ";
                    dbName = name.toLowerCase() + "'s keys";
                } else {
                    keysMessage += "** Personal keys ** ";
                    dbName = "personal keys";
                }
            } else if (cmdType === "") {
                keysMessage += "**Server keys ** ";
                dbName = "server's keys";
            }
            keysMessage += "*(use '" + prefixString + cmdType + "d [key]' to play)*\n" + s;
            message.channel.send(keysMessage).then(async sentMsg => {
                sentMsg.react('❔').then(() => sentMsg.react('🔀'));
                const filter = (reaction, user) => {
                    return ['🔀', '❔'].includes(reaction.emoji.name) && user.id !== bot.user.id;
                };
                const keysButtonCollector = sentMsg.createReactionCollector(filter, {time: 1200000});
                keysButtonCollector.on('collect', (reaction, reactionCollector) => {
                    if (reaction.emoji.name === '❔') {
                        let nameToSend;
                        if (dbName === "server's keys") {
                            nameToSend = "the server";
                        } else {
                            nameToSend = "your personal";
                        }
                        let embed = new MessageEmbed()
                            .setTitle("How to add/remove keys from " + nameToSend + " list")
                            .setDescription("add a song by putting a word followed by a link -> "
                                + prefixString + cmdType + "a [key] [link]\n" +
                                "remove a song by putting the name you want to remove -> "
                                + prefixString + cmdType + "rm [key]");
                        message.channel.send(embed);
                    } else if (reaction.emoji.name === '🔀') {
                        for (let mem of voiceChannel.members) {
                            if (reactionCollector.id === mem[1].id) {
                                if (reactionCollector.username) {
                                    message.channel.send("*randomizing from " + reactionCollector.username + "'s keys...*");
                                } else {
                                    message.channel.send("*randomizing...*");
                                }
                                runRandomToQueue(100, message, "p" + reactionCollector.id);

                                return;
                            }
                        }
                        return message.channel.send("*must be in a voice channel to shuffle play*");
                    }
                });
            });
        }
    });
}


bot.on("voiceStateUpdate", update => {
    if (!update.connection && embedMessageMap[update.guild.id] && embedMessageMap[update.guild.id].reactions || update.member.id === bot.id) {
        dispatcherMap[update.channel] = undefined;
        embedMessageMap[update.guild.id].reactions.removeAll().then()
    }
});


/**
 *  The play song function. Plays a song to the voice channel.
 * @param {*} message the message that triggered the bot
 * @param {*} whatToPlay the link of the song to play
 * @param voiceChannel the voice channel to play the song in
 */
function playSongToVC(message, whatToPlay, voiceChannel) {
    if (!voiceChannel || voiceChannel.members.size < 1 || !whatToPlay) {
        return;
    }
    let server = servers[message.guild.id];
    let whatToPlayS = "";
    whatToPlayS = whatToPlay;
    let whatsp = whatToPlayS;
    let url = whatToPlayS;
    let isSpotify = false;
    // set stream flag and validate link
    if (whatToPlayS.includes("spotify.com")) {
        isSpotify = true;
        if (!spdl.validateURL(url)) {
            message.channel.send('Invalid link');
            searchForBrokenLinkWithinDB(message, whatToPlayS);
            return;
        }
    } else {
        if (!ytdl.validateURL(url)) {
            message.channel.send('Invalid link');
            searchForBrokenLinkWithinDB(message, whatToPlayS);
            return;
        }
    }
    // remove previous embed buttons
    if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions) {
        embedMessageMap[message.guild.id].reactions.removeAll().then();
        embedMessageMap[message.guild.id] = "";
    }
    whatspMap[voiceChannel] = whatToPlayS;
    voiceChannel.join().then(async function (connection) {
        try {
            let dispatcher;
            if (!isSpotify) {
                await connection.voice.setSelfDeaf(true);
                dispatcher = connection.play(await ytdl(url), {
                    type: "opus",
                    filter: "audioonly",
                    quality: "140",
                });
            } else {
                dispatcher = connection
                    .play(await spdl(url, {
                        opusEncoded: true,
                        filter: 'audioonly',
                        encoderArgs: ['-af', 'apulsator=hz=0.09']
                    }));
            }
            dispatcherMap[voiceChannel] = dispatcher;
            // if the server is not silenced then send the embed when playing
            if (!silenceMap[message.guild.id]) {
                sendLinkAsEmbed(message, url, voiceChannel).then();
            }
            dispatcherMap[voiceChannel].on("finish", () => {
                servers[message.guild.id].queueHistory.push(server.queue.shift());
                if (server.queue.length > 0 && voiceChannel.members.size > 1) {
                    whatsp = server.queue[0];
                    whatspMap[voiceChannel] = whatsp;
                    if (!whatsp) {
                        return;
                    }
                    playSongToVC(message, whatsp, voiceChannel);
                } else {
                    if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions) {
                        embedMessageMap[message.guild.id].reactions.removeAll().then();
                        embedMessageMap[message.guild.id] = "";
                    }
                    connection.disconnect();
                    dispatcherMap[voiceChannel] = undefined;
                }
            });
        } catch (e) {
            // Error catching - fault with the link?
            message.channel.send("Could not play <" + whatToPlayS + ">");
            // search the db to find possible broken keys
            searchForBrokenLinkWithinDB(message, whatToPlayS);
            connection.disconnect();
        }
    });
}

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB(message, whatToPlayS) {
    gsrun(client2, "A", "B", message.channel.guild.id).then((xdb) => {
        xdb.congratsDatabase.forEach((value, key, map) => {
            if (value === whatToPlayS) {
                return message.channel.send("*possible broken link within the server db: " + key + "*");
            }
        })
    });
    gsrun(client2, "A", "B", "p" + message.member.id).then((xdb) => {
        xdb.congratsDatabase.forEach((value, key, map) => {
            if (value === whatToPlayS) {
                return message.channel.send("*possible broken link within the personal db: " + key + "*");
            }
        })
    });
}


/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear.
 * @param message the message to send the channel to
 * @param url the url to generate the embed for
 * @param voiceChannel the voice channel that the song is being played in
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed(message, url, voiceChannel) {
    let embed;
    let imgLink;
    let timeMS = 0;
    let showButtons = true;
    let mgid = message.member.guild.id;
    generatingEmbedMap[mgid] = true;
    let isSpotify = false;
    if (url.toString().includes("spotify.com")) {
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
        embed = new MessageEmbed()
            .setTitle(`${infos.videoDetails.title}`)
            .setURL(infos.videoDetails.video_url)
            .setColor('#c40d00')
            .addField('Duration', formatDuration(infos.formats[0].approxDurationMs), true)
        imgLink = infos.videoDetails.thumbnails[0].url;
        timeMS = parseInt(infos.formats[0].approxDurationMs);
    }
    if (servers[mgid] && servers[mgid].queue && servers[mgid].queue.length > 0) {
        embed.addField('Queue', " 1 / " + servers[mgid].queue.length, true);
    } else {
        embed.addField('-', "Last played", true);
        showButtons = false;
    }
    embed.setThumbnail(imgLink);
    if (embedMessageMap[message.guild.id] && embedMessageMap[message.guild.id].reactions) {
        embedMessageMap[message.guild.id].reactions.removeAll().then();
        embedMessageMap[message.guild.id] = "";
    }
    let wsp = whatspMap[voiceChannel];
    if (url === whatspMap[voiceChannel])
        message.channel.send(embed)
            .then(await function (sentMsg) {
                embedMessageMap[mgid] = sentMsg;
                if (newWhat) {
                    newWhat = false;
                    return;
                }
                if (!showButtons || whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                sentMsg.react('⏪').then(() => {
                    if (whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                    sentMsg.react('⏯').then(() => {
                        if (whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                        sentMsg.react('⏹').then(() => {
                            if (whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                            sentMsg.react('⏩').then(() => {
                                if (whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                                sentMsg.react('🔑').then(() => {
                                    if (whatspMap[voiceChannel] !== wsp || !dispatcherMap[voiceChannel]) return;
                                    sentMsg.react('🔐').then(() => {
                                        generatingEmbedMap[mgid] = false
                                    });
                                });
                            });
                        });
                    });
                });

                const filter = (reaction, user) => {
                    if (voiceChannel) {
                        for (let mem of voiceChannel.members) {
                            if (user.id === mem[1].id) {
                                return ['⏯', '⏩', '⏪', '⏹', '🔑', '🔐'].includes(reaction.emoji.name) && user.id !== bot.user.id;
                            }
                        }
                    }
                    return false;
                };

                const collector = sentMsg.createReactionCollector(filter, {time: timeMS});

                collector.on('collect', (reaction, reactionCollector) => {
                    if (!dispatcherMap[voiceChannel] || !voiceChannel) {
                        return;
                    }
                    if (reaction.emoji.name === '⏩') {
                        skipSong(message, voiceChannel, true);
                    } else if (reaction.emoji.name === '⏯' &&
                        (!dispatcherMapStatus[voiceChannel] ||
                            dispatcherMapStatus[voiceChannel] === "resume")) {
                        dispatcherMap[voiceChannel].pause();
                        dispatcherMapStatus[voiceChannel] = "pause";
                    } else if (reaction.emoji.name === '⏯' && dispatcherMapStatus[voiceChannel] === "pause") {
                        dispatcherMap[voiceChannel].resume();
                        dispatcherMapStatus[voiceChannel] = "resume";
                    } else if (reaction.emoji.name === '⏪') {
                        if (servers[mgid].queue.length > (maxQueueSize + 99)) {
                            message.channel.send("*max queue size has been reached, cannot rewind further*");
                            return;
                        }
                        let song = servers[mgid].queueHistory.pop();
                        if (!song) {
                            message.channel.send("*could not rewind*");
                            return;
                        }
                        message.channel.send("*rewound*");
                        servers[mgid].queue.unshift(song);
                        playSongToVC(message, song, voiceChannel);
                    } else if (reaction.emoji.name === '⏹') {
                        runStopPlayingCommand(message, mgid, voiceChannel);
                    } else if (reaction.emoji.name === '🔑') {
                        runKeysCommand(message, prefixMap[mgid], mgid, "", voiceChannel, "");
                    } else if (reaction.emoji.name === '🔐') {
                        // console.log(reaction.users.valueOf().array().pop());
                        runKeysCommand(message, prefixMap[mgid], "p" + reactionCollector.id, "m", voiceChannel, reactionCollector);
                    }
                });
            });
}

/**
 * Stops playing in the given voice channel and leaves.
 * @param message The given message that triggered the bot
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 */
function runStopPlayingCommand(message, mgid, voiceChannel) {
    if (!voiceChannel) return;
    dispatcherMap[voiceChannel] = undefined;
    if (servers[mgid].queue) {
        servers[mgid].queue = [];
        servers[mgid].queueHistory = [];
    }
    if (embedMessageMap[message.guild.id]) {
        embedMessageMap[message.guild.id].reactions.removeAll().then();
        embedMessageMap[message.guild.id] = "";
    }
    if (voiceChannel) {
        voiceChannel.leave();
    }
}

var newWhat = false;

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} args the message split into an array, delim by spaces
 * @param {*} message the message that activated the bot
 * @param {*} mgid The guild id
 * @param {*} sheetname The name of the sheet reference
 */
async function runWhatsPCommand(args, message, mgid, sheetname) {
    if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
            queue: [],
            queueHistory: []
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
    }
    if (args[1]) {
        gsrun(client2, "A", "B", sheetname).then((xdb) => {
            let dbType = "the server's";
            if (args[0].substr(1, 1).toLowerCase() === "m") {
                dbType = "your";
            }
            if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
                message.channel.send(xdb.referenceDatabase.get(args[1].toUpperCase()));
            } else if (
                whatspMap[message.member.voice.channel] &&
                !whatspMap[message.member.voice.channel].includes("Last Played:")
            ) {
                message.channel.send(
                    "Could not find '" +
                    args[1] +
                    "' in " + dbType + " database.\nCurrently playing: " +
                    whatspMap[message.member.voice.channel]
                );
            } else if (whatspMap[message.member.voice.channel]) {
                message.channel.send(
                    "Could not find '" +
                    args[1] +
                    "' in " + dbType + " database.\n" +
                    whatspMap[message.member.voice.channel]
                );
            } else {
                message.channel.send("Could not find '" + args[1] + "' in " + dbType + " database.");
            }
        });
    } else {
        if (!message.member.voice.channel) {
            message.channel.send("Must be in a voice channel");
            return;
        }
        if (
            whatspMap[message.member.voice.channel] &&
            whatspMap[message.member.voice.channel] !== ""
        ) {
            // in case of force disconnect
            if (
                !message.guild.client.voice ||
                !message.guild.voice ||
                !message.guild.voice.channel
            ) {
                try {
                    if (
                        whatspMap[message.member.voice.channel] && whatspMap[message.member.voice.channel].length > 0
                    ) {
                        let msg = embedMessageMap[mgid];
                        if (msg) {
                            if (!generatingEmbedMap[mgid]) {
                                embedMessageMap[mgid] = "";
                                await msg.reactions.removeAll();
                                sendLinkAsEmbed(message, whatspMap[message.member.voice.channel], message.member.voice.channel).then().catch()
                            } else {
                                message.channel.send("*previous embed is generating...*");
                            }
                        }
                    } else {
                        message.channel.send("Nothing is playing right now");
                    }
                } catch (e) {
                    message.channel.send(whatspMap[message.member.voice.channel]);
                }
            } else {
                let msg = embedMessageMap[mgid];
                if (msg) {
                    if (!generatingEmbedMap[mgid]) {
                        embedMessageMap[mgid] = "";
                        await msg.reactions.removeAll();
                        sendLinkAsEmbed(message, whatspMap[message.member.voice.channel], message.member.voice.channel).then().catch()
                    } else {
                        message.channel.send("*previous embed is generating...*");
                    }
                } else {
                    message.channel.send("Nothing is playing right now");
                }
            }
        } else {
            message.channel.send("Nothing is playing right now");
        }
    }
}

// What's playing, uses voice channel
var whatspMap = new Map();
// The server's prefix, uses guild id
var prefixMap = new Map();
// What is returned when searching the db, uses key-name
var congratsDatabase = new Map();
// Reference for the congrats database, uses uppercase key-name
var referenceDatabase = new Map();
// Whether silence mode is on (true, false), uses guild id
var silenceMap = new Map();
// The dataSize, uses sheet name
var dataSize = new Map();
// The song stream, uses voice channel
var dispatcherMap = new Map();
// The list of embeds, uses guild id
var embedMessageMap = new Map();
// The status of a dispatcher, either "pause" or "resume"
var dispatcherMapStatus = new Map();
// status of generating embed for a guild
var generatingEmbedMap = new Map();

