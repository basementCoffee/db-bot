const {google} = require('googleapis');
const keys = require('./DiscordBot-d96fd2d64ee5.json');

const client2 = new google.auth.JWT(
    keys.client_email, null, keys.private_key, ['https://www.googleapis.com/auth/spreadsheets']
);

client2.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
    } else {
        console.log("Connected to google apis.")
        gsrun(client2);
    }
});

var dataSize;

async function gsrun(cl) {
        const gsapi = google.sheets({version: 'v4', auth: cl});


        const spreadsheetSizeObjects = {
            spreadsheetId: process.env.stoken,
            range: 'entries!C2'
        }

        let dataSizeFromSheets = await gsapi.spreadsheets.values.get(spreadsheetSizeObjects);
        dataSize = dataSizeFromSheets.data.values;

        console.log("Data Size: " + dataSize);

        const songObjects = {
            spreadsheetId: process.env.stoken,
            range: "entries!A2:B" + dataSize.toString()

        };

        let dataSO = await gsapi.spreadsheets.values.get(songObjects);
        var arrayOfSpreadsheetValues = dataSO.data.values;
        //console.log(arrayOfSpreadsheetValues);

        console.log("Database size: " + dataSize);

        var line;
        var keyT
        var valueT;
        congratsDatabase.clear();
        referenceDatabase.clear();
        for (let i = 0; i < dataSize; i++) {
            // the array of rows (has two columns)
            line = arrayOfSpreadsheetValues[i];
            if (!line) {
                continue;
            }
            keyT = line[0];
            valueT = line[1];
            congratsDatabase.set(keyT, valueT);
            referenceDatabase.set(keyT.toUpperCase(), valueT);
        }
}

function gsUpdateAdd(msg, cl, key, link) {
    const gsapi = google.sheets({version: 'v4', auth: cl});
    gsapi.spreadsheets.values.append({
        "spreadsheetId": "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
        "range": "A10:B10",
        "includeValuesInResponse": true,
        "insertDataOption": "INSERT_ROWS",
        "responseDateTimeRenderOption": "FORMATTED_STRING",
        "responseValueRenderOption": "FORMATTED_VALUE",
        "valueInputOption": "USER_ENTERED",
        "resource": {
            "values": [
                [
                    key,
                    link
                ]
            ]
        }
    })
        .then(function(response) {
                // Handle the results here (response.result has the parsed body).
                console.log("Response", response);
            },
            function(err) { console.error("Execute error", err); });

    gsUpdateOverwrite(msg, cl, dataSize);
}

function gsUpdateOverwrite(msg, cl, value) {

    try {
        value = parseInt(dataSize) + 1;
    } catch (e) {
        msg.channel.send("There's been a fatal error. Check debug log.");
        console.log(e);
    }


    const gsapi = google.sheets({version: 'v4', auth: cl});
    gsapi.spreadsheets.values.update({
        "spreadsheetId": "1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0",
        "range": "C2",
        "includeValuesInResponse": true,
        "responseDateTimeRenderOption": "FORMATTED_STRING",
        "valueInputOption": "USER_ENTERED",
        "resource": {
            "values": [
                [
                    value
                ]
            ]
        }
    })
        .then(function(response) {
                // Handle the results here (response.result has the parsed body).
                console.log("Response", response);
            },
            function(err) { console.error("Execute error", err); });
    gsrun(cl).then(
        r => console.log(r)
    );
}


async function gsPushUpdate(cl, providedKey, providedLink) {
    const gsapi = google.sheets({version: 'v4', auth: cl});
    //dataSize += 1;
    // var aProvKey = new Array(providedKey);
    // const updateOptions = {
    //     spreadsheetId: process.env.stoken,
    //     range: 'entries!A51:B51',
    //     valueInputOption: 'USER_ENTERED',
    //     //resource: {values: aProvKey}
    // };
    //
    // const valueRange = {
    //     values: ['testing', '1']
    // };
    // let response = await gsapi.spreadsheets.values.update(updateOptions, valueRange);

    const params = {
        // The ID of the spreadsheet to update.
        spreadsheetId: 'process.env.stoken',
    };

    const batchUpdateValuesRequestBody = {
        // How the input data should be interpreted.
        valueInputOption: 'USER_ENTERED',
        range: 'entries!A50:B50',
        // The new values to apply to the spreadsheet.
        data: ['testing', '1'],

    };

    const request = gsapi.spreadsheets.values.batchUpdate(params, batchUpdateValuesRequestBody);

    // const valueRange2 = {
    //     values: ['testing']
    // };
    //
    // var aProvLink = new Array(providedLink);
    // const updateOptions2 = {
    //     spreadsheetId: process.env.stoken,
    //     range: 'entries!B50:C50' ,
    //     valueInputOption: 'USER_ENTERED',
    //     // resource: providedLink.toString()
    //     //resource: {values: aProvLink}
    // };
    //
    // let response2 = await gsapi.spreadsheets.values.update(updateOptions2, valueRange2);
}


//ABOVE IS GOOGLE API -----------------------------------------------
const {
    Client
} = require('discord.js');

// initialization
const bot = new Client();
const ytdl = require("discord-ytdl-core");

// async function play(connection, url) {
//     connection.play(await ytdl(url), { type: 'opus' });
// }

//const PREFIX = '!';
// UPDATE HERE - Before Git Push
var version = '3.7.8';
var buildNumber = "3708a";
var latestRelease = "Latest Release (3.7.x):\n" +
    "- Can now change the prefix of the bot (!changeprefix)\n" +
    "---3.6.x introduced---\n" +
    "- Add songs to google sheets (!a name, link)";
var servers = {};
var testingChannelGuildID = 730239813403410619;
//bot.login(token);
bot.login(process.env.token);
var whatsp = "";
//ytpl test for youtube playlists!
//var ytpl = require('ytpl');

// parses message, provides a response
bot.on('message', msg => {
    try {
        if (msg.member.displayName === "Congratz Ambassador") {
            return;
        }
    } catch (e) {
        return;
    }
    if (msg.content.toUpperCase().includes("HELLO FRIEND")) {
        msg.reply("Bonsoir " + msg.author.username);
    } else if (msg.content.toUpperCase().includes("HELLO")) {
        let randomInt = Math.floor(Math.random() * 4);
        // section 1
        if (randomInt === 1) {
            let randomInt3 = Math.floor(Math.random() * 4);
            if (randomInt3 === 0) {
                msg.reply("Howdy-.. I mean bkawhh");
            } else if (randomInt3 === 1) {
                msg.reply("Quak quack (translation: sup my dude)");
            } else if (randomInt3 === 2) {
                msg.reply("Hi. How's it going.");
            } else {
                msg.reply("Hello! I'm your friendly neighborhood penguin.");
            }

            // section 3
        } else if (randomInt === 2) {
            let randomInt4 = Math.floor(Math.random() * 2);
            if (randomInt4 === 1) {
                msg.reply("Hello friend!");
            } else if (randomInt4 === 1) {
                msg.reply("Hey! Why not listen to some music?");
            } else {
                msg.reply("Hello to you too. Oh... that wasn't for me was it")
            }
        }
    }
})


//Who's down greeting
bot.on('message', msg => {
    if (msg.content.includes("who's down")) {
        var randomIntForDown = Math.floor(Math.random() * 6);
        if (randomIntForDown === 4) {
            var randomIntForDown2 = Math.floor(Math.random() * 2);
            if (randomIntForDown2 === 0) {
                msg.reply("I would be down to play some game but I get flagged for cheating, every. single. time. Maybe it's because I am a bot :p");
            } else {
                msg.reply("You are a one player army... good luck!")
            }
        }
    }
})


// the entire reason we built this bot
function contentsContainCongrats(message) {
    return message.content.includes("grats") || message.content.includes("gratz") || message.content.includes("ongratulations");
}

var keyArray;
var s;

function skipSong(message) {
    if (enumPlayingFunction === "random") {
        if (currentRandomIntMap[message.member.voice.channel] === totalRandomIntMap[message.member.voice.channel] || totalRandomIntMap[message.member.voice.channel] === 0){
            totalRandomIntMap[message.member.voice.channel] = 0;
            currentRandomIntMap[message.member.voice.channel] = 0;
            if (!message.guild.voiceChannel) message.member.voice.channel.join().then(function (connection) {
                connection.disconnect();
            })
            whatsp = "Last Played:\n" + whatsp;
            whatspMap[message.member.voice.channel] = whatsp;
        } else {
            playRandom(message, totalRandomIntMap[message.member.voice.channel]);
        }
    } else {
        // if server queue is not empty then skip
        if (servers[message.guild.id].queue && servers[message.guild.id].queue.length > 0) {
            servers[message.guild.id].queue.shift();
            // if there is still items in the queue then play next song
        if (servers[message.guild.id].queue.length > 0) {
            whatspMap[message.member.voice.channel] = servers[message.guild.id].queue[0];
            playSongToVC(message, whatspMap[message.member.voice.channel]);
        }
      else {
            if (!message.guild.voiceChannel) message.member.voice.channel.join().then(function (connection) {
                connection.disconnect();
            })
            if (whatspMap[message.member.voice.channel] && whatspMap[message.member.voice.channel].length > 0) {
                whatspMap[message.member.voice.channel] = "Last Played:\n" + whatspMap[message.member.voice.channel];
            }
        }
    }

    }
}

// parses message, provides a response
bot.on('message', message => {
    if (message.author.bot) return;
    if (contentsContainCongrats(message)) {
        if (message.author.bot) return;
        var messageArray = message.content.substring(message.length).split(" ");
        for (i = 0; i < messageArray.length; i++) {
            if (!servers[message.guild.id]) servers[message.guild.id] = {
                queue: []
            }
            //servers[message.guild.id].queue.push(args[1]);
            let word = messageArray[i];
            console.log(word);
            if ((word.includes("grats") || word.includes("gratz") || word.includes("ongratulations")) && !(word.substring(0, 1).includes("!"))) {
                if ((i + 1) === messageArray.length) {
                    message.channel.send("Congratulations!");
                    
                } else {
                    message.channel.send("Congratulations " + messageArray[i + 1] + "!");
                }
                    playSongToVC(message, "https://www.youtube.com/watch?v=oyFQVZ2h0V8");
                return;
            }
        }
    } else {
        var args = message.content.split(" ");
        console.log(args);
        if (!prefix[message.member.voice.channel]) {
            prefix[message.member.voice.channel] = "!";
        }
        if (args[0].substr(0,1) !== prefix[message.member.voice.channel]) {
            if (args[0] == "!changeprefix") {
                message.channel.send("Use prefix to change. Prefix is: " + prefix[message.member.voice.channel])
            }
            return;
        }
        let statement = args[0].substr(1);
        switch (statement) {
            //!p is just the basic rhythm bot
            case 'p':
                console.log("b1");
                if (!args[1]) {
                    message.channel.send("Where's the link? I can't read your mind... unfortunately.");
                    return;
                }
                if (!(args[1].includes("youtube")) || !(args[1].includes(".com"))) {
                    message.channel.send("There's something wrong with what you put there.");
                    return;
                }
                if (!message.member.voice.channel) {
                    return;
                }
                if (!servers[message.guild.id]) servers[message.guild.id] = {
                    queue: []
                }
                console.log("b2");
                enumPlayingFunction = "playing";
                // push to queue
                servers[message.guild.id].queue.push(args[1]);
                // if queue has only 1 song then play
                if (servers[message.guild.id] && servers[message.guild.id].queue.length < 2){
                    playSongToVC(message, args[1]);
                } else {
                    message.channel.send("Added to queue.");
                }
                    
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
            case "e" :
                server = servers[message.guild.id];
                totalRandomIntMap[message.member.voice.channel] = 0;
                currentRandomIntMap[message.member.voice.channel] = 0;
                firstSong = true;
                if (!message.member || !message.member.voice || !message.member.voice.channel) {
                    return;
                }


                while (servers[message.guild.id] && servers[message.guild.id].queue.length > 0) {
                    server.queue.shift();
                }
                // should do same as above
                if (servers[message.guild.id] && servers[message.guild.id].queue) {
                    servers[message.guild.id].queue = [];
                }
                
                if (message.member.voice && message.member.voice.channel) {
                    message.member.voice.channel.leave();
                }
                // alternative to above code
                // if (!message.guild.voiceChannel) message.member.voice.channel.join().then(function (connection) {
                //     //server.dispatcher = connection.disconnect();
                //     connection.disconnect();
                // })
                if (whatspMap[message.member.voice.channel] && whatspMap[message.member.voice.channel].length > 0) {
                whatspMap[message.member.voice.channel] = "Last Played:\n" + whatspMap[message.member.voice.channel];
                }
                break;

            // prints out the database size
            case "s" :
                message.channel.send("Database size: " + Array.from(congratsDatabase.keys()).length);
                break;

            // !d is to run database songs
            case "d":
                if (!args[1]) {
                    message.channel.send("There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
                    return;
                }
                if (!message.member.voice.channel) {
                    return;
                }
                if (!servers[message.guild.id]) servers[message.guild.id] = {
                    queue: []
                }
                enumPlayingFunction = "playing";
                server = servers[message.guild.id];

                // no need to update what's playing on command call (should be inside play function)
                // try {
                //     whatsp = referenceDatabase.get(args[1].toUpperCase());
                //     whatspMap[message.member.voice.channel] = whatsp;
                // } catch (e) {
                //     message.channel.send("I couldn't find that key. Try '!keys' to get the full list of usable keys.");
                //     return;
                // }
                if (!referenceDatabase.get(args[1].toUpperCase())){
                    message.channel.send("Could not find name in database.");
                    return;
                }
                // push to queue
                servers[message.guild.id].queue.push(referenceDatabase.get(args[1].toUpperCase()));
                // if queue has only 1 song then play
                if (servers[message.guild.id] && servers[message.guild.id].queue.length < 2){
                    playSongToVC(message, referenceDatabase.get(args[1].toUpperCase()));
                } else {
                    message.channel.send("Added to queue.");
                }
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


            //Randomizer
            case "r" :
                if (!message.member.voice.channel) {
                    return;
                }
                if (!servers[message.guild.id]) servers[message.guild.id] = {
                    queue: []
                }
                totalRandomIntMap[message.member.voice.channel] = 0;
                currentRandomIntMap[message.member.voice.channel] = 0;
                servers[message.guild.id].queue = [];
                if (!args[1]) {
                    playRandom(message, 1);
                } else {
                    try {
                        let num = parseInt(args[1])
                        if (num === null || num === undefined) {
                            totalRandomIntMap[message.member.voice.channel] = 0;
                        } else {
                            totalRandomIntMap[message.member.voice.channel] = num;
                        }
                        currentRandomIntMap[message.member.voice.channel] = 0;
                        playRandom(message, num)
                    } catch (e) {
                        playRandom(message, 1);
                    }
                }
                break;

            case "key" :
                gsrun(client2);
                console.log('before');
                setTimeout(function(){
                    console.log('after');
                },500);
                keyArray = Array.from(congratsDatabase.keys());
                keyArray.sort();
                s = "";
                for (let key in keyArray) {
                    if (key == 0) {
                        s = keyArray[key];
                    } else {
                        s = s + ", " + keyArray[key];
                    }
                }
                message.channel.send(s);
                break;
            case "rand" :
                if (args[1]){
                    const numToCheck = parseInt(args[1]);
                    if (numToCheck < 1){
                        message.channel.send("Number has to be positive.");
                    }
                    let randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
                    message.channel.send(randomInt2);
                } else {
                    const numToCheck = message.member.voice.channel.members.size - 1;
                    if (numToCheck <= 0) {
                        message.channel.send("Upper limit required.");
                    }
                    let randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
                    message.channel.send("Assuming " + numToCheck + " people. Your number is " + randomInt2 + ".");
                    // message.channel.send("You need to input a upper limit");
                }
            break;
            case "keys" :
                gsrun(client2);
                console.log('before');
                setTimeout(function(){
                    console.log('after');
                },500);
                keyArray = Array.from(congratsDatabase.keys());
                keyArray.sort();
                s = "";
                for (let key in keyArray) {
                    if (key == 0) {
                        s = keyArray[key];
                    } else {
                        s = s + ", " + keyArray[key];
                    }
                }
                message.channel.send(s);
                break;
            case "k" :
                //message.channel.send(args[1]);
                if (!args[1]) {
                    message.channel.send("No argument was given.");
                    return;
                }
                let givenS = args[1];
                let givenSLength = givenS.length;
                let keyArray2 = Array.from(congratsDatabase.keys());
                let ss = "";
                var searchKey;
                for (let ik = 0; ik < keyArray2.length; ik++) {
                    searchKey = keyArray2[ik];
                    if (givenS.toUpperCase() === searchKey.substr(0, givenSLength).toUpperCase()) {
                        if (!ss) {
                            ss = searchKey
                        } else {
                            ss += ", " + searchKey;
                        }
                    }
                }
                if (ss.length === 0) {
                    message.channel.send("Could not find any keys that start with the given letters.");
                } else {
                    message.channel.send("Keys found: " + ss);
                    //message.channel.send("--end--");
                }
                break;
            // !? is the command for what's playing?
            case "?":
                if (args[1]) {
                    if (args[1] === "" || args[1] === " ") {
                        // intentionally left blank
                    } else {
                        if (totalRandomIntMap[message.member.voice.channel] && totalRandomIntMap[message.member.voice.channel] === 0) {
                            message.channel.send(congratsDatabase.get(args[1]));
                        } else if (currentRandomIntMap[message.member.voice.channel] && totalRandomIntMap[message.member.voice.channel] ) {
                            message.channel.send("("+ currentRandomIntMap[message.member.voice.channel] + "/" + totalRandomIntMap[message.member.voice.channel] + ")  " + congratsDatabase.get(args[1]));
                        }
                    }
                }
                if (whatspMap[message.member.voice.channel] && whatspMap[message.member.voice.channel] !== "") {
                    if (totalRandomIntMap[message.member.voice.channel] && totalRandomIntMap[message.member.voice.channel] !== 0) {
                        message.channel.send("(" + currentRandomIntMap[message.member.voice.channel] + "/" + totalRandomIntMap[message.member.voice.channel] + ")  " + whatspMap[message.member.voice.channel]);
                    } else if (servers[message.guild.id] && servers[message.guild.id].queue && servers[message.guild.id].queue.length > 1) {
                        message.channel.send("(1/" + servers[message.guild.id].queue.length + ")  " + whatspMap[message.member.voice.channel]);
                    } 
                    else {
                        message.channel.send(whatspMap[message.member.voice.channel]);
                    }
                } else {
                    message.channel.send("Nothing is playing right now");
                }
                break;
            case "changeprefix":
                if (!args[1]) {
                    message.channel.send("No argument was given. Enter the new prefix after the command.");
                    return;
                }
                prefix[message.member.voice.channel] = args[1];
                message.channel.send("Prefix successfully changed to " + args[1]);
            break;
            // list commands for public commands
            case "h" :
                let prefixString = ""; 
                prefixString = prefix[message.member.voice.channel].toString();
                message.channel.send(
                    "Help list:\n"
                    + "-------------- Core Commands  -----------------\n"
                    + prefixString
                    + "p [youtube link]  -->  Plays YouTube video\n"
                    + prefixString
                    + "?  -->  What's playing\n"
                    + prefixString
                    + "sk  -->  Skip the current song\n"
                    + prefixString
                    + "e  -->  Stops playing and clears queue\n"
                    + prefixString
                    + "changeprefix  -->  changes the prefix for all commands \n"
                    + "\n--------  Curated songs [Work in Progress] --------  \n"
                    + prefixString
                    + "key  -->  All the artist song tags (separated by a comma) \n"
                    + prefixString
                    + "d [key]  -->  Plays a song from the database \n"
                    + prefixString
                    + "k [phrase]  -->  search keys with the same starting phrase\n"
                    + prefixString
                    + "a [song] [url]  -->  Adds a song to the database \n"
                    + prefixString
                    + "rm  -->  Removes a song from the database\n"
                    + "**Or just say congrats to a friend. I will chime in too! :) **");
                break;
            case "skip" :

                skipSong(message);

                break;
            case "sk" :

                skipSong(message);

                break;
            // prints out the version number
            case "v" :
                message.channel.send("version: " + version + "\n" + latestRelease);
                break;
            // prints out the build number
            case "vv" :
                message.channel.send("build: " + buildNumber);
                break;
            case "devadd" :
                message.channel.send("Here's link to add to the database:\n" +
                    "https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622")
                break;
            // add to the databse
            case "a":
                if (!args[1] || !args[2]) {
                    message.channel.send("Could not add to the database. Put a song key followed by a link.");
                    break;
                }
                var songsAddedInt = 0;
                var z = 1;
                while (args[z] && args[z + 1]) {
                    var linkZ = args[z + 1];
                    if (linkZ.substring(linkZ.length - 1) === ",") {
                        linkZ = linkZ.substring(0, linkZ.length - 1);
                    }
                    congratsDatabase.set(args[z], args[z + 1]);
                    gsUpdateAdd(message,client2, args[z], args[z + 1]);
                    // gsPushUpdate(client2, args[z], args[z + 1]);
                    z = z + 2;
                    songsAddedInt += 1;
                }
                if (songsAddedInt === 1) {
                    message.channel.send("Song successfully added to the database.");
                    break;
                } else if (songsAddedInt > 1) {
                    message.channel.send(songsAddedInt.toString() + " songs added to the database.");
                }
                break;

            //removes database entries
            case "rm":
                var successInDelete = congratsDatabase.delete(args[1]);
                if (successInDelete === true) {
                    message.channel.send("Song successfully removed from the database.");
                } else {
                    message.channel.send("Could not find song tag within the database.");
                }
                break;
        }
    }
})
var enumPlayingFunction;
function playRandom(message, numOfTimes) {
    currentRandomIntMap[message.member.voice.channel] += 1;
    enumPlayingFunction = "random";
    var numOfRetries = 0;
    server = servers[message.guild.id];
    let rKeyArray = Array.from(congratsDatabase.keys());
    numOfRetries += 1;
    let rn = Math.floor((Math.random() * (rKeyArray.length)) + 1);
    let rk = rKeyArray[rn];
    //console.log("attempting to play key:" + rk);
    whatsp = congratsDatabase.get(rk);
    whatspMap[message.member.voice.channel] = whatsp;
    //server.queue.push(congratsDatabase.get(rk));
    if (!message.guild.voiceChannel) message.member.voice.channel.join().then(function (connection) {
        try {
            connection.voice.setSelfDeaf(true);
            //console.log("calling play method...");
            let myStream = ytdl(whatsp, {
                filter: "audioonly",
                opusEncoded: true,
                encoderArgs: ['-af', 'bass=g=10,dynaudnorm=f=200']
            });
            let dispatcher = connection.play(myStream, {
                type: "opus"
            })
                .on("finish", () => {
                    numOfTimes -= 1;
                    if (numOfTimes === 0) {
                        totalRandomIntMap[message.member.voice.channel] = 0;
                        currentRandomIntMap[message.member.voice.channel] = 0;
                        connection.disconnect();
                    } else {
                        playRandom(message, numOfTimes)
                    }

                })
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
                playRandom();
            }

        }
    })
}
/**
 *  New play song function.
 * @param {*} message the message with channel info
 * @param {*} numOfTimes should be 1.
 * @param {*} whatToPlay the link of the song to play
 */
function playSongToVC(message, whatToPlay) {
    enumPlayingFunction = "playing";
    server = servers[message.guild.id];
    let whatToPlayS = "";
    whatToPlayS = whatToPlay;
    whatsp = whatToPlayS;
    whatspMap[message.member.voice.channel] = whatToPlayS;
    if (!message.guild.voiceChannel) message.member.voice.channel.join().then(function (connection) {
        try {
            connection.voice.setSelfDeaf(true);
            let myStream = ytdl(whatToPlayS, {
                filter: "audioonly",
                opusEncoded: true,
                encoderArgs: ['-af', 'bass=g=10,dynaudnorm=f=200']
            });
            let dispatcher = connection.play(myStream, {
                type: "opus"
            })
            .on("finish", () => {
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
                }

            })
        } catch (e) {
            // Error catching - fault with the yt link?
                console.log("Below is a caught error message. (tried to play:" + whatToPlayS + ")");
                console.log("Error:", e);
                server.queue.shift();
                message.channel.send("Could not play song.");
                connection.disconnect();
            }
    })
}

/**
 * Prints the error to the testing channel.
 * @param activationType the keyword that causes the error
 * @param songKey the keyword of the song in the database
 * @param e the error message
 */
function printErrorToChannel(activationType, songKey, e) {
    bot.channels.cache.get("730239813403410619").send("ERROR: When called " + activationType + ", song key: " + songKey);
    bot.channels.cache.get("730239813403410619").send(e);
}

/**
 * Prints the error to the testing channel with no args.
 */
    //function printErrorToChannel() {
    //    bot.channels.cache.get("730239813403410619").send("There was an error!");
    //}

var whatspMap = new Map();
var prefix = new Map();
var congratsDatabase = new Map();
var referenceDatabase = new Map();
var currentRandomIntMap = new Map();
var totalRandomIntMap = new Map();