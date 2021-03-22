const {google} = require("googleapis");
const keys = require("./DiscordBot-d96fd2d64ee5.json");

const client2 = new google.auth.JWT(keys.client_email, null, keys.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
]);

client2.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
    } else {
        console.log("Connected to google apis.");
        gsrun(client2, "A", "B", "entries");
    }
});

async function gsrun(cl, columnToRun, secondColumn, nameOfSheet) {
    const gsapi = google.sheets({version: "v4", auth: cl});

    nameOfSheet = nameOfSheet.toString();
    const spreadsheetSizeObjects = {
        spreadsheetId: process.env.stoken,
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

    console.log("Data Size: " + dataSize.get(nameOfSheet));
    if (!dataSize.get(nameOfSheet)) {
        dataSize.set(nameOfSheet, 1);
        gsUpdateAdd2(cl, 1, "D", nameOfSheet);
        console.log("Data Size prev undef: " + dataSize.get(nameOfSheet));
        return gsrun(cl, columnToRun, secondColumn, nameOfSheet);
    }

    const songObjects = {
        spreadsheetId: process.env.stoken,
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

function createSheet(message, nameOfSheet) {
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
                gsrun(client2, "A", "B", message.guild.id).then(() => {
                });
            }
            // console.log("success: ", response);
        }
    );
}

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

    console.log(res.data.sheets[0].properties.sheetId);
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
 * Adds the entry into the column
 * @param {*} cl
 * @param {*} key
 * @param {*} link
 * @param {*} firstColumnLetter The key column letter, should be uppercase
 * @param {*} secondColumnLetter The link column letter, should be uppercase
 * @param nameOfSheet
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
 * @param value the final DB value, overrides addOn
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
    gsrun(cl, "A", "B", "entries").then(() =>
        console.log("updateOverwrite ran...")
    );
}

//ABOVE IS GOOGLE API -------------------------------------------------------------
//ABOVE IS GOOGLE API -------------------------------------------------------------

const {Client} = require("discord.js");

// initialization
const bot = new Client();
const ytdl = require("ytdl-core-discord");

// UPDATE HERE - Before Git Push
const version = "4.4.0";
const latestRelease =
    "**Latest Release (4.4.x):**\n"
    +
    "- DB play command can now guess what you meant (!d [incorrect_key])"
    +
    "\n\n**Previous Release (4.3.x):**\n"
    +
    "- Full support for removing items from the database";
var servers = {};
bot.login(process.env.token);
var whatsp = "";

// the entire reason we built this bot
function contentsContainCongrats(message) {
    return (
        message.content.includes("grats") ||
        message.content.includes("gratz") ||
        message.content.includes("ongratulations")
    );
}

var keyArray;
var s;
process.setMaxListeners(0);

function skipSong(message, cdb) {
    // in case of force disconnect
    if (
        !message.guild.client.voice ||
        !message.guild.voice ||
        !message.guild.voice.channel
    ) {
        servers[message.guild.id].queue = [];
        return;
    }
    if (enumPlayingFunction === "random" || enumPlayingFunction === "randomS") {
        if (
            currentRandomIntMap[message.member.voice.channel] >=
            totalRandomIntMap[message.member.voice.channel] ||
            totalRandomIntMap[message.member.voice.channel] === 0
        ) {
            totalRandomIntMap[message.member.voice.channel] = 0;
            currentRandomIntMap[message.member.voice.channel] = 0;
            if (message.member.voice && message.member.voice.channel) {
                message.member.voice.channel.leave();
                dispatcherMap[message.member.voice.channel] = undefined;
            }
            whatsp = "Last Played:\n" + whatspMap[message.member.voice.channel];
            whatspMap[message.member.voice.channel] = whatsp;
        } else {
            playRandom2(
                message,
                totalRandomIntMap[message.member.voice.channel],
                cdb,
                0
            );
        }
    } else {
        if (!servers[message.guild.id] || enumPlayingFunction !== "playing") {
            enumPlayingFunction = "playing";
            servers[message.guild.id] = {
                queue: [],
            };
        }
        // if server queue is not empty
        if (
            servers[message.guild.id].queue &&
            servers[message.guild.id].queue.length > 0
        ) {
            servers[message.guild.id].queue.shift();
            // if there is still items in the queue then play next song
            if (servers[message.guild.id].queue.length > 0) {
                whatspMap[message.member.voice.channel] =
                    servers[message.guild.id].queue[0];
                // get rid of previous dispatch
                playSongToVC(message, whatspMap[message.member.voice.channel]);
            } else {
                if (message.member.voice && message.member.voice.channel) {
                    // get rid of previous dispatch
                    message.member.voice.channel.leave();
                    dispatcherMap[message.member.voice.channel] = undefined;
                }
                if (
                    whatspMap[message.member.voice.channel] &&
                    whatspMap[message.member.voice.channel].length > 0
                ) {
                    whatspMap[message.member.voice.channel] =
                        "Last Played:\n" + whatspMap[message.member.voice.channel];
                }
            }
        }
    }
}

/**
 * Removes an item from the google sheets music database
 * @param message the message that triggered the bot
 * @param keyName the key to remove
 * @param sheetName the name of the sheet to alter
 */
function runRemoveItemCommand(message, keyName, sheetName) {
    if (keyName) {
        gsrun(client2, "A", "B", sheetName).then((xdb) => {
            let couldNotFindKey = true;
            for (let i = 0; i < xdb.line.length; i++) {
                let itemToCheck = xdb.line[i];
                if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
                    i += 1;
                    couldNotFindKey = false;
                    deleteRows(message, sheetName, i);
                    gsUpdateOverwrite(client2, -1, -1, sheetName);
                    message.channel.send("*Removed '" + itemToCheck + "'*");
                }
            }
            if (couldNotFindKey) {
                gsrun(client2, "A", "B", sheetName).then(async (xdb) => {
                    let foundStrings = runSearchCommand(keyName, xdb).ss;
                    if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
                        message.channel.send("Could not find '" + keyName + "'.\n*Did you mean: " + ss + "*");
                    } else {
                        message.channel.send("*Could not find '" + keyName + "'.*");
                    }

                });
            }
        });
    } else {
        message.channel.send("Need to specify the key to delete.");
    }

}

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
                if (i + 1 === messageArray.length) {
                    message.channel.send("Congratulations!");
                } else {
                    if (messageArray[i + 1].toLowerCase() !== "on" || messageArray[i + 1].toLowerCase() !== "my") {
                        message.channel.send("Congratulations " + messageArray[i + 1] + "!");
                    } else {
                        message.channel.send("Congratulations!");
                    }
                }
                playSongToVC(message, "https://www.youtube.com/watch?v=oyFQVZ2h0V8");
                return;
            }
        }
    } else {
        var args = message.content.replace(/\s+/g, " ").split(" ");
        console.log(args);
        if (!prefix[message.member.voice.channel]) {
            prefix[message.member.voice.channel] = "!";
        }
        if (args[0].substr(0, 1) !== prefix[message.member.voice.channel]) {
            if (args[0] === "!changeprefix") {
                message.channel.send(
                    "Use prefix to change. Prefix is: " +
                    prefix[message.member.voice.channel]
                );
            }
            return;
        }
        let mgid = message.guild.id;
        let prefixString = prefix[message.member.voice.channel].toString();
        let statement = args[0].substr(1);
        statement = statement.toLowerCase();

        switch (statement) {
            //!p is just the basic rhythm bot
            case "p":
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
                    };
                enumPlayingFunction = "playing";
                // in case of force disconnect
                if (
                    !message.guild.client.voice ||
                    !message.guild.voice ||
                    !message.guild.voice.channel
                ) {
                    servers[mgid].queue = [];
                }
                // push to queue
                servers[mgid].queue.push(args[1]);
                // if queue has only 1 song then play
                if (servers[mgid] && servers[mgid].queue.length < 2) {
                    playSongToVC(message, args[1]);
                } else {
                    message.channel.send("*Added to queue*");
                }
                break;
            // !pn
            case "pn":
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
                    };
                enumPlayingFunction = "playing";
                // in case of force disconnect
                if (
                    !message.guild.client.voice ||
                    !message.guild.voice ||
                    !message.guild.voice.channel
                ) {
                    servers[mgid].queue = [];
                }
                // push to queue
                servers[mgid].queue.unshift(args[1]);
                message.channel.send("*Playing now*");
                playSongToVC(message, args[1]);
                break;
            // case '!pv':
            //     if (!args[1]) {
            //         message.channel.send("Where's the link? I can't read your mind... unfortunately.");
            //         return;
            //     }
            //     if (!(args[1].includes("youtube")) || !(args[1].includes(".com"))) {
            //         message.channel.send("There's something wrong with what you put there.");
            //         return;
            //     }
            //     if (!message.member.voice.channel) {
            //         return;
            //     }
            //     if (!servers[message.guild.id]) servers[message.guild.id] = {
            //         queue: []
            //     }
            //
            //     server = servers[message.guild.id];
            //     server.queue.push(args[1]);
            //     playSong(message, args[1], false);
            //     break;

            //!e is the Stop feature
            case "e":
                totalRandomIntMap[message.member.voice.channel] = 0;
                currentRandomIntMap[message.member.voice.channel] = 0;
                if (
                    !message.member ||
                    !message.member.voice ||
                    !message.member.voice.channel
                ) {
                    return;
                }
                dispatcherMap[message.member.voice.channel] = undefined;
                // should do same as below
                if (servers[mgid] && servers[mgid].queue) {
                    servers[mgid].queue = [];
                }
                while (servers[mgid] && servers[mgid].queue.length > 0) {
                    servers[mgid].queue.shift();
                }
                if (message.member.voice && message.member.voice.channel) {
                    message.member.voice.channel.leave();
                }

                if (
                    whatspMap[message.member.voice.channel] &&
                    whatspMap[message.member.voice.channel].length > 0 &&
                    !whatspMap[message.member.voice.channel].includes("Last Played:")
                ) {
                    whatspMap[message.member.voice.channel] =
                        "Last Played:\n" + whatspMap[message.member.voice.channel];
                }
                break;

            // !s prints out the database size
            case "s":
                message.channel.send(
                    "Database size: " + Array.from(congratsDatabase.keys()).length
                );
                break;

            // !gd is to run database songs
            case "gd":
                runDatabasePlayCommand(args, message, "entries");
                break;
            // !d
            case "d":
                runDatabasePlayCommand(args, message, mgid);
                break;

            // case "dv":
            //     if (!args[1]) {
            //         message.channel.send("There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
            //         return;
            //     }
            //     if (!message.member.voice.channel) {
            //         return;
            //     }
            //     if (!servers[message.guild.id]) servers[message.guild.id] = {
            //         queue: []
            //     }
            //
            //     server = servers[message.guild.id];
            //     try {
            //         whatsp = referenceDatabase.get(args[1].toUpperCase());
            //     } catch (e) {
            //         message.channel.send("I couldn't find that key. Try '!keys' to get the full list of usable keys.");
            //         return;
            //     }
            //     //let dPhrase = args[1];
            //     //server.queue.push(referenceDatabase.get(args[1].toUpperCase()));
            //     playSong(message, whatsp, false);
            //     break;

            // !rg plays a random song from the database
            case "gr":
                if (!message.member.voice.channel) {
                    return;
                }
                enumPlayingFunction = "random";
                runRandomCommand(args, message, "entries");
                break;
            // !r is the normal random
            case "r":
                if (!message.member.voice.channel) {
                    return;
                }
                enumPlayingFunction = "randomS";
                runRandomCommand(args, message, mgid);
                break;
            // !r2 is the experimental random to work with the normal queue
            case "r2":
                if (!message.member.voice.channel) {
                    return;
                }
                enumPlayingFunction = "randomS";
                runRandomCommand(args, message, mgid);
                break;
            // !keys
            case "keys":
                if (
                    !dataSize.get(mgid.toString()) ||
                    dataSize.get(mgid.toString()) < 1
                ) {
                    createSheet(message, mgid);
                }
                runKeysCommand(message, prefixString, mgid);
                break;
            // !key
            case "key":
                if (
                    !dataSize.get(mgid.toString()) ||
                    dataSize.get(mgid.toString()) < 1
                ) {
                    createSheet(message, mgid);
                }
                runKeysCommand(message, prefixString, mgid);
                break;
            // !keysg is global keys
            case "gkeys":
                runKeysCommand(message, prefixString, "entries");
                break;
            // !keyg is global keys
            case "gkey":
                runKeysCommand(message, prefixString, "entries");
                break;
            // !k is the search
            case "k":
                if (!args[1]) {
                    message.channel.send("No argument was given.");
                    return;
                }
                gsrun(client2, "A", "B", mgid).then(async (xdb) => {
                    ss = runSearchCommand(args, xdb).ss;
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
                    ss = runSearchCommand(args, xdb).ss;
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
                args[2] = args[1];
                args[1] = mgid;
                gsrun(client2, "A", "B", "prefixes").then(() => {
                        runRemoveItemCommand(message, args[1], mgid)
                        runAddCommand(args, message, "prefixes");
                });
                prefix[message.member.voice.channel] = args[2];
                message.channel.send("Prefix successfully changed to " + args[2]);
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
                // determines random type
                if (enumPlayingFunction === "random") {
                    mgid = "entries";
                } else {
                    mgid = message.guild.id;
                }
                gsrun(client2, "A", "B", mgid).then((xdb) => {
                    skipSong(message, xdb.congratsDatabase);
                });
                break;
            // !sk
            case "sk":
                // determines random type (global or local)
                if (enumPlayingFunction === "random") {
                    mgid = "entries";
                } else {
                    mgid = message.guild.id;
                }
                gsrun(client2, "A", "B", mgid).then((xdb) => {
                    skipSong(message, xdb.congratsDatabase);
                });
                break;
            // !pa
            case "pa":
                if (
                    message.member.voice &&
                    dispatcherMap[message.member.voice.channel]
                ) {
                    dispatcherMap[message.member.voice.channel].pause();
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
                    message.channel.send("*playing*");
                }
                break;
            // !v prints out the version number
            case "v":
                message.channel.send("version: " + version + "\n" + latestRelease);
                break;
            // !devadd
            case "devadd":
                message.channel.send(
                    "Here's link to add to the database:\n" +
                    "https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622"
                );
                break;
            // !ag adds to the databse
            case "ga":
                if (!args[1] || !args[2]) {
                    message.channel.send(
                        "Could not add to the database. Put a song key followed by a link."
                    );
                    break;
                }
                if (!args[2].includes(".")) {
                    message.channel.send("You can only add links to the database.");
                    return;
                }
                // in case the database has not been initialized
                gsrun(client2, "A", "B", "entries").then(() => {
                    runAddCommand(args, message, "entries");
                });
                break;
            // !a is normal add
            case "a":
                if (!args[1] || !args[2]) {
                    message.channel.send(
                        "Could not add to the database. Put a song key followed by a link."
                    );
                    return;
                }
                if (!args[2].includes(".")) {
                    message.channel.send("You can only add links to the database.");
                    return;
                }
                // in case the database has not been initialized
                gsrun(client2, "A", "B", mgid).then(() => {
                    if (
                        !dataSize.get(mgid.toString()) ||
                        dataSize.get(mgid.toString()) < 1
                    ) {
                        message.channel.send("Please try again.");
                    } else {
                        runAddCommand(args, message, mgid);
                    }
                });
                break;
            // !rm removes database entries
            case "rm":
                runRemoveItemCommand(message, args, mgid);
                break;
            // !grm removes database entries
            case "grm":
                runRemoveItemCommand(message, args, "entries");
                break;
            // !rand
            case "rand":
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
                        if (numToCheck <= 1) {
                            message.channel.send(
                                "Need at least 2 people your voice channel."
                            );
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
});

/**
 * The command to add a song to a given database.
 * @param {*} args The command arguments
 * @param {*} message The message that triggered the command
 * @param {*} currentBotGuildId the server/guild id
 */
function runAddCommand(args, message, currentBotGuildId) {
    let songsAddedInt = 0;
    let z = 1;
    while (args[z] && args[z + 1]) {
        let linkZ = args[z + 1];
        if (linkZ.substring(linkZ.length - 1) === ",") {
            linkZ = linkZ.substring(0, linkZ.length - 1);
        }
        gsUpdateAdd(client2, args[z], args[z + 1], "A", "B", currentBotGuildId);
        z = z + 2;
        songsAddedInt += 1;
    }

    if (songsAddedInt === 1) {
        message.channel.send("*Song successfully added to the database.*");
    } else if (songsAddedInt > 1) {
        gsrun(client2, "A", "B", currentBotGuildId).then(() => {
            gsUpdateOverwrite(client2, -1, songsAddedInt, currentBotGuildId);
            message.channel.send("*" + songsAddedInt + " songs successfully added to the database.*");
        });
    } else {
        message.channel.send("Please call '!keys' to initialize the database.");
    }

}

/**
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetname the name of the google sheet to reference
 * @returns
 */
function runDatabasePlayCommand(args, message, sheetname) {
    if (!args[1]) {
        message.channel.send(
            "There's nothing to play! ... I'm just gonna pretend that you didn't mean that."
        );
        return;
    }
    if (!message.member.voice.channel) {
        return;
    }
    if (!servers[message.guild.id] || enumPlayingFunction !== "playing") {
        enumPlayingFunction = "playing";
        servers[message.guild.id] = {
            queue: [],
        };
    }
    // in case of force disconnect
    if (
        !message.guild.client.voice ||
        !message.guild.voice ||
        !message.guild.voice.channel
    ) {
        servers[message.guild.id].queue = [];
    }

    gsrun(client2, "A", "B", sheetname).then((xdb) => {
        let queueWasEmpty = false;
        // if the queue is empty then play
        if (servers[message.guild.id].queue.length < 1) {
            queueWasEmpty = true;
        }
        if (args[2]) {
            let dbAddInt = 1;
            let unFoundString = "*Could not find: ";
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
            message.channel.send("*Added " + dbAddedToQueue + " to queue*");
            if (firstUnfoundRan) {
                unFoundString = unFoundString.concat("*");
                message.channel.send(unFoundString);
            }
        } else {
            if (!xdb.referenceDatabase.get(args[1].toUpperCase())) {
                let ss = runSearchCommand(args, xdb).ss;
                if (ssi === 1 && ss && ss.length > 0 && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
                    message.channel.send(
                        "Could not find '" + args[1] + "'. **Assuming '" + ss + "'**"
                    );
                    // push to queue
                    servers[message.guild.id].queue.push(xdb.referenceDatabase.get(ss.toUpperCase()));
                } else if (ss && ss.length > 0) {
                    message.channel.send(
                        "Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + "*"
                    );
                    return;
                } else {
                    message.channel.send("Could not find '" + args[1] + "' in database.");
                    return;
                }
            } else {
                // push to queue
                servers[message.guild.id].queue.push(xdb.referenceDatabase.get(args[1].toUpperCase()));
            }
            if (!queueWasEmpty) {
                message.channel.send("*Added to queue*");
            }
        }
        // if queue was empty then play
        if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
            playSongToVC(message, servers[message.guild.id].queue[0]);
        }
    });
}

// The search command
let ss; // the search string
let ssi; // the number of searches found
/**
 * Searches the database for the keys matching args[1].
 * @param args the list of arguments from the message
 * @param xdb the object containing multiple DBs
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values
 */
function runSearchCommand(args, xdb) {
    let givenSLength = args[1].length;
    let keyArray2 = Array.from(xdb.congratsDatabase.keys());
    ss = "";
    ssi = 0;
    let searchKey;
    for (let ik = 0; ik < keyArray2.length; ik++) {
        searchKey = keyArray2[ik];
        if (
            args[1].toUpperCase() ===
            searchKey.substr(0, givenSLength).toUpperCase() ||
            (args[1].length > 1 &&
                searchKey.toUpperCase().includes(args[1].toUpperCase()))
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
 * Function to display help list.
 * @param {*} message the message that triggered the bot
 * @param {*} prefixString the prefix in string format
 */
function sendHelp(message, prefixString) {
    message.channel.send(
        "Help list:\n" +
        "--------------  Music Commands  -----------------\n" +
        prefixString +
        "p [youtube link]  -->  Plays YouTube video \n" +
        prefixString +
        "?  -->  What's playing\n" +
        prefixString +
        "pa  -->  pause \n" +
        prefixString +
        "pl  -->  play (if paused) \n" +
        prefixString +
        "sk  -->  Skip the current song\n" +
        prefixString +
        "e  -->  Stops playing and ends session\n" +
        prefixString +
        "pn [youtube link]  -->  Plays the link now, even if there is a queue.\n" +
        "\n----------  Personal Music Database ----------  \n" +
        prefixString +
        "keys  -->  See all your saved songs \n" +
        prefixString +
        "a [song] [url]  -->  Adds a song to your database \n" +
        prefixString +
        "d [key]  -->  Play a song from your database \n" +
        prefixString +
        "k [phrase]  -->  lookup keys with the same starting phrase\n" +
        prefixString +
        "rm [key] -->  Removes a song from your database\n" +
        "\n--------------  Other Commands  -----------------\n" +
        prefixString +
        "changeprefix [new prefix]  -->  changes the prefix for all commands \n" +
        prefixString +
        "rand  --> random roll for the number of people in the voice channel\n" +
        "**Or just say congrats to a friend. I will chime in too! :) **"
    );
}

/**
 * The command to play a random song from a database.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetname the name of the database sheet to reference
 */
function runRandomCommand(args, message, sheetname) {
    if (!servers[message.guild.id])
        servers[message.guild.id] = {
            queue: [],
        };
    totalRandomIntMap[message.member.voice.channel] = 0;
    currentRandomIntMap[message.member.voice.channel] = 0;
    servers[message.guild.id].queue = [];
    randomQueueMap[message.guild.id] = undefined;
    gsrun(client2, "A", "B", sheetname).then((xdb) => {
        if (!args[1]) {
            playRandom2(message, 1, xdb.congratsDatabase, 0);
        } else {
            try {
                let num = parseInt(args[1]);
                if (num && num > 1000) {
                    message.channel.send("*max limit for random is 1000*");
                    num = 1000;
                }
                if (num) {
                    totalRandomIntMap[message.member.voice.channel] = num;
                }
                playRandom2(message, num, xdb.congratsDatabase, 0);
            } catch (e) {
                playRandom2(message, 1, xdb.congratsDatabase, 0);
            }
        }
    });
}

/**
 * The music-centric function of play random. This function executes the music stream
 * to be played into the voice channel of the message's owner.
 * @param {*} message the message that triggered the bot
 * @param {*} numOfTimes the number of times to play random songs
 * @param {*} cdb the congrats-database
 * @param numOfRetries should be 0 unless called within itself
 * @returns
 */
function playRandom2(message, numOfTimes, cdb, numOfRetries) {
    currentRandomIntMap[message.member.voice.channel] += 1;
    // server = servers[message.guild.id];
    var rKeyArray = Array.from(cdb.keys());
    let rn;
    let rk;
    process.stdout.on("error", function (err) {
        if (err.code == "EPIPE") {
            console.log("error here's listeners: " + bot.getMaxListeners());
        }
    });
    if (numOfTimes <= 1) {
        rn = Math.floor(Math.random() * rKeyArray.length);
        rk = rKeyArray[rn];
    } else {
        try {
            if (!randomQueueMap[message.guild.id]) {
                let rKeyArrayFinal = [];
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
                randomQueueMap[message.guild.id] = rKeyArrayFinal;
            }
            rk = randomQueueMap[message.guild.id].pop();
            console.log("random call: " + rk);
        } catch (e) {
            console.log("error in random: " + e);
            rn = Math.floor(Math.random() * rKeyArray.length);
            rk = rKeyArray[rn];
        }
    }
    numOfRetries += 1;
    //console.log("attempting to play key:" + rk);
    whatsp = cdb.get(rk);
    if (!whatsp) {
        gsrun(client2, "A", "B", message.guild.id).then(() => {
            if (cdb.length < 2) {
                message.channel.send(
                    "Your database needs at least two items to randomize."
                );
            } else {
                message.channel.send(
                    "It appears your database is empty.\nTry running '!keys' or add a song to the database."
                );
            }
            console.log("Play random whatsp is empty.");
        });
        return;
    }
    whatspMap[message.member.voice.channel] = whatsp;
    //server.queue.push(congratsDatabase.get(rk));
    message.member.voice.channel.join().then(async function (connection) {
        try {
            await connection.voice.setSelfDeaf(true);

            let dispatcher = connection.play(await ytdl(whatsp), {
                type: "opus",
                filter: "audioonly",
                quality: "140",
            });

            dispatcherMap[message.member.voice.channel] = dispatcher;

            if (!dispatcherMap[message.member.voice.channel]) {
                console.log("there was an error: E5");
                return;
            }

            dispatcher.on("finish", () => {
                numOfTimes -= 1;
                if (numOfTimes === 0) {
                    totalRandomIntMap[message.member.voice.channel] = 0;
                    currentRandomIntMap[message.member.voice.channel] = 0;
                    connection.disconnect();
                    whatsp = "Last Played:\n" + whatspMap[message.member.voice.channel];
                    dispatcherMap[message.member.voice.channel] = undefined;
                } else {
                    playRandom2(message, numOfTimes, cdb, numOfRetries);
                }
            });
        } catch (e) {
            // Error catching - fault with the database yt link?
            console.log("Below is a caught error message. (this broke:" + rk + ")");
            //printErrorToChannel("!r", rk, e);
            console.log(e);
            if (numOfRetries > 2) {
                message.channel.send("Could not play random songs. Sorry.");
                printErrorToChannel("!r (third try)", rk, e);
                connection.disconnect();
            } else {
                if (numOfRetries > 1) {
                    printErrorToChannel("!r", rk, e);
                } else {
                    printErrorToChannel("!r (second try)", rk, e);
                }
                //message.channel.send("I'm sorry kiddo, couldn't find a random song in time... I'll see myself out.");
                playRandom2(message, numOfTimes, cdb, numOfRetries);
            }
        }
    });
}

/**
 * Grabs all of the keys/names from the database
 * @param {*} message The message trigger
 * @param prefixString The character of the prefix
 * @param {*} sheetname The name of the sheet to retrieve
 */
function runKeysCommand(message, prefixString, sheetname) {
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
            message.channel.send(
                "Your music database is empty. Add a song by calling '" +
                prefixString +
                "a'"
            );
        } else {
            message.channel.send(
                "*(use '" + prefixString + "d' to play)*\n **Keys:** " + s
            );
        }
    });
}

/**
 *  New play song function.
 * @param {*} message the message with channel info
 * @param {*} whatToPlay the link of the song to play
 */
function playSongToVC(message, whatToPlay) {
    enumPlayingFunction = "playing";
    let server = servers[message.guild.id];
    if (!message.member.voice.channel) {
        // server.queue = [];
        return;
    }
    let whatToPlayS = "";
    whatToPlayS = whatToPlay;
    whatsp = whatToPlayS;
    whatspMap[message.member.voice.channel] = whatToPlayS;
    message.member.voice.channel.join().then(async function (connection) {
        try {
            await connection.voice.setSelfDeaf(true);
            let dispatcher = connection.play(await ytdl(whatsp), {
                type: "opus",
                filter: "audioonly",
                quality: "140",
            });

            dispatcherMap[message.member.voice.channel] = dispatcher;
            dispatcher.on("finish", () => {
                server.queue.shift();
                if (server.queue.length > 0) {
                    whatsp = server.queue[0];
                    console.log("On finish, playing; " + whatsp);
                    whatspMap[message.member.voice.channel] = whatsp;
                    if (!whatsp) {
                        return;
                    }
                    playSongToVC(message, whatsp);
                } else {
                    connection.disconnect();
                    dispatcherMap[message.member.voice.channel] = undefined;
                }
            });
        } catch (e) {
            // Error catching - fault with the yt link?
            console.log(
                "Below is a caught error message. (tried to play:" + whatToPlayS + ")"
            );
            console.log("Error:", e);
            server.queue.shift();
            message.channel.send("Could not play song.");
            connection.disconnect();
        }
    });
}

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} args the message split into an array, delim by spaces
 * @param {*} message the message that activated the bot
 * @param {*} mgid The guild id
 * @param {*} sheetname The name of the sheet reference
 */
function runWhatsPCommand(args, message, mgid, sheetname) {
    if (args[1]) {
        gsrun(client2, "A", "B", sheetname).then((xdb) => {
            if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
                message.channel.send(xdb.referenceDatabase.get(args[1].toUpperCase()));
            } else if (
                whatspMap[message.member.voice.channel] &&
                !whatspMap[message.member.voice.channel].includes("Last Played:")
            ) {
                message.channel.send(
                    "Could not find '" +
                    args[1] +
                    "' in database.\nCurrently playing: " +
                    whatspMap[message.member.voice.channel]
                );
            } else if (whatspMap[message.member.voice.channel]) {
                message.channel.send(
                    "Could not find '" +
                    args[1] +
                    "' in database.\n" +
                    whatspMap[message.member.voice.channel]
                );
            } else {
                message.channel.send("Could not find '" + args[1] + "' in database.");
            }
        });
    } else {
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
                if (
                    whatspMap[message.member.voice.channel] &&
                    !whatspMap[message.member.voice.channel].includes("Last Played:")
                ) {
                    whatspMap[message.member.voice.channel] =
                        "Last Played:\n" + whatspMap[message.member.voice.channel];
                    message.channel.send(whatspMap[message.member.voice.channel]);
                } else if (
                    whatspMap[message.member.voice.channel] &&
                    whatspMap[message.member.voice.channel].length > 0
                ) {
                    message.channel.send(whatspMap[message.member.voice.channel]);
                } else {
                    message.channel.send("Nothing is playing right now");
                }
                return;
            }
            if (
                enumPlayingFunction !== "playing" &&
                totalRandomIntMap[message.member.voice.channel] &&
                totalRandomIntMap[message.member.voice.channel] !== 0
            ) {
                message.channel.send(
                    "(" +
                    currentRandomIntMap[message.member.voice.channel] +
                    "/" +
                    totalRandomIntMap[message.member.voice.channel] +
                    ")  " +
                    whatspMap[message.member.voice.channel]
                );
            } else if (
                servers[mgid] &&
                servers[mgid].queue &&
                servers[mgid].queue.length > 1
            ) {
                message.channel.send(
                    "(1/" +
                    servers[mgid].queue.length +
                    ")  " +
                    whatspMap[message.member.voice.channel]
                );
            } else {
                message.channel.send(whatspMap[message.member.voice.channel]);
            }
        } else {
            message.channel.send("Nothing is playing right now");
        }
    }
}

process.stdout.on("error", function (err) {
    if (err.code == "EPIPE" || err.code == "EAGAIN") {
        console.log("errorz: " + bot.getMaxListeners());
    }
});

/**
 * Prints the error to the testing channel.
 * @param activationType the keyword that causes the error
 * @param songKey the keyword of the song in the database
 * @param e the error message
 */
function printErrorToChannel(activationType, songKey, e) {
    bot.channels.cache
        .get("730239813403410619")
        .send("ERROR: When called " + activationType + ", song key: " + songKey);
    bot.channels.cache.get("730239813403410619").send(e);
}

var enumPlayingFunction;
var whatspMap = new Map();
var prefix = new Map();
var congratsDatabase = new Map();
var referenceDatabase = new Map();
var currentRandomIntMap = new Map();
var totalRandomIntMap = new Map();
var dataSize = new Map();
var dispatcherMap = new Map();
var randomQueueMap = new Map();