const {google} = require('googleapis');
const keys = require('./DiscordBot-d96fd2d64ee5.json');

const client = new google.auth.JWT(
    keys.client_email, null, keys.private_key,['https://www.googleapis.com/auth/spreadsheets']
);

client.authorize(function(err, tokens){
    if(err){
        console.log(err);
        return;
    } else {
        console.log("Connected to google apis.")
        gsrun(client);
    }
});



async function gsrun(cl){
    const gsapi = google.sheets({version: 'v4', auth: cl});

    const songObjects = {
        spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
        range: 'entries!A2:B34'

    };

    const spreadsheetSizeObjects = {
        spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
        range: 'entries!C1'
    }

    let dataSO = await gsapi.spreadsheets.values.get(songObjects);
    var arrayOfSpreadsheetValues = dataSO.data.values;
    console.log(arrayOfSpreadsheetValues);
   
    let dataSize = await gsapi.spreadsheets.values.get(spreadsheetSizeObjects);
    var dataSizeCell = dataSize.data.values;
    
    console.log(dataSizeCell);
       var line;
       var keyT
       var valueT;
        for (i = 0; i < dataSizeCell; i++){
            line = arrayOfSpreadsheetValues[i];
            keyT = line[0];
            valueT = line[1];
        congratsDatabase.set(keyT, valueT);
    }
//console.log(congratsDatabase.toString);
    
    console.log( congratsDatabase.keys );
/*
const updateOptions = {
    spreadsheetId: '1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0',
        range: 'entries!A2:B34',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newDataArray}
};
*/

//let response = await gsapi.spreadsheets.values.update(updateOptions);

}



//ABOVE IS GOOGLE API
const {
    Client,
    Attachment
} = require('discord.js');

// initialization 
const bot = new Client();
const ytdl = require("ytdl-core");
const PREFIX = '!';
var version = '2.0.1';
var buildNumber = "2.1.c";
var servers = {};
var testingChannelGuildID = 730239813403410619;
//bot.login(token);
bot.login(process.env.token);
var whatsp = "";
//ytpl test for youtube playlists
//var ytpl = require('ytpl');


// parses message, provides a response
bot.on('message', msg=>{
    if(msg.content.includes("hello" || "howdy" || "hey" || "Hello" || "sup" || "Hey")){
        let randomInt = Math.floor(Math.random() * 5);
        // section 1
        if (randomInt == 0) {
            let randomInt2 = Math.floor(Math.random() * 3);
            // valorant responses
            if (randomInt2 == 0) {
        msg.reply("Sup, who's down for some Valorant?");
            } else if(randomInt2 == 1) {
                msg.reply("Hello my fellow Valorant gamer");
            } else {
                msg.reply("Hey, just busy trying out this game called Valorant... it's not half bad");
            }
            // end valorant responses

            // section 2
        } else if (randomInt == 1) {
            let randomInt3 = Math.floor(Math.random() * 4);
            if (randomInt3 == 0) {
            msg.reply("Howdy-.. I mean BKAWHH");
            } else if (randomInt3 == 1) {
                msg.reply("Quak quack (translation: sup my dude)");
            } else if (randomInt3 == 2) {
                msg.reply("Hi. How's it going.");
            } 
            else {
                msg.reply("Hello! I'm your friendly neighborhood penguin.");
            }

            // section 3
        } else if (randomInt == 2) {
            let randomInt4 = Math.floor(Math.random() * 2);
            if (randomInt4 == 1){
            msg.reply("Hello friend!");
            } else {
                msg.reply("Hello to you too. Oh... that wasn't for me was it")
            }
        }
    }
})


//Who's down greeting
bot.on('message', msg=>{
    var randomIntForDown = Math.floor(Math.random() * 6);
    if(msg.content.includes("s down")){
        if (randomIntForDown = 4) {
        var randomIntForDown2 = Math.floor(Math.random() * 2);
        if (randomIntForDown2 == 0){
        msg.reply("I would be down but I get flagged for cheating, every. single. time. Maybe it's because I am a bot :p");
        } else {
            msg.reply("You are a one player army... good luck!")
        }
        }
    }
})


//aylmao the entire reason we built this damn bot
function contentsContainCongrats(message) {
    return message.content.includes("grats") || message.content.includes("gratz") || message.content.includes("ongratulations");
}
function playCongrats(connection, message){
    var server = servers[message.guild.id];
    try {
        server.dispatcher = connection.play(ytdl('https://www.youtube.com/watch?v=oyFQVZ2h0V8', { quality: 'highestaudio'}));
        server.dispatcher.setVolume(1);
    } catch (e) {
        printErrorToChannel("congrats", "congratulations", e);
    }
    
}

// parses message, provides a response
 bot.on('message', message=>{
    var server;
    if (message.author.bot) return;
    if(contentsContainCongrats(message)) {
        if (message.author.bot) return;
        var messageArray = message.content.substring(message.length).split(" ");
        for (i = 0; i < messageArray.length; i++) { 
            if(!servers[message.guild.id]) servers[message.guild.id] = {
                queue: []
            }
            server = servers[message.guild.id];
            //server.queue.push(args[1]);
            var word = messageArray[i];
            console.log(word);
            if ((word.includes("grats") || word.includes("gratz")|| word.includes("ongratulations")) && !(word.substring(0,1).includes("!"))) {
                if ((i+1) == messageArray.length ) {
                    message.channel.send("Congratulations!");
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        playCongrats(connection, message);
                    })
                   return; 
                } else {
                    message.channel.send("Congratulations " + messageArray[i+1]+"!");
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        playCongrats(connection, message);
                    })
                    return; 
                }
            }
            }
          } else {
            var args = message.content.split(" ");
            console.log(args);
            switch (args[0]) {
                //!p is just the basic rythm bot 
                case '!p':
                    function play(connection, message){
                        var server = servers[message.guild.id];
                        server.dispatcher = connection.play(ytdl(server.queue[0], { quality: 'highestaudio'}));
                        server.queue.shift();
                        server.dispatcher.on("end", function(){
                           //commment out if issues persist
                            //if(server.queue[0]){
                            //    play(connection, message);
                            //}else{
                            //    connection.disconnect();
                            //}
                            //comment in if issues persist
                             return;
                        })
                    }
                    if (!args[1]) {
                        message.channel.send("Where's the link? I can't read your mind... unfortunately.");
                        return;
                    }
                    if (!(args[1].includes("youtube")) || !(args[1].includes(".com"))) {
                        message.channel.send("There's something wrong with what you put there.");
                        return;
                    }
                    if(!message.member.voice.channel){
                        return;
                    }
                    if(!servers[message.guild.id]) servers[message.guild.id] = {
                        queue: []
                    }

            
                    server = servers[message.guild.id];
                    server.queue.push(args[1]);
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                        play(connection, message);
                        whatsp = args[1];
                    } catch(e) {
                        console.log("Below is a caught error, should not cause any issues.");
                        console.log(e);
                        whatsp = "";
                        message.channel.send("Sorry buddy, couldn't find the video. uh... is the link a real youtube video?");
                        //connection.disconnect();
                        return;
                    }
                    })
                break;


               //!e is the Stop feature
                case "!e" :
                        server = servers[message.guild.id];
                        if(!servers[message.guild.id]) servers[message.guild.id] = {
                            queue: []
                        }
                        
                        if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                            server.dispatcher = connection.disconnect();
                        })
                        whatsp = "";
                        break;
                
                // prints out the database size
                case "!s" :
                   message.channel.send("Database size: " + Array.from(congratsDatabase.keys()).length);
                break;

                // to run database songs
                case "!d":
                    if (!args[1]) {
                        message.channel.send("N-NANI? There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
                        return;
                    }
                    if(!message.member.voice.channel){
                        return;
                    }
                    if(!servers[message.guild.id]) servers[message.guild.id] = {
                        queue: []
                    }
                    
                    server = servers[message.guild.id];
                    try {
                    whatsp = congratsDatabase.get(args[1]);
                    } catch(e) {
                        message.channel.send("I couldn't find that key. Try '!keys' to get the full list of usable keys.");
                        return;
                    }
                    let dPhrase = args[1];
                    server.queue.push(congratsDatabase.get(args[1]));
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                        play(connection, message);
                        } catch(e) {
                            console.log("Below is a caught error messong: (this broke:" + dPhrase+")");
                            console.log(e);
                            printErrorToChannel("!d", whatsp + " - probably a broken link?", e);
                            message.channel.send("Sorry buddy, couldn't find the video. uh... idk what else to tell ya");
                            connection.disconnect();
                            return;
                        }
                    })
                    break;   
                
                
                //Randomizer    
                case "!r" :
                    if(!message.member.voice.channel){
                        return;
                    }
                    if(!servers[message.guild.id]) servers[message.guild.id] = {
                        queue: []
                    }
                    var numOfRetries = 0;
                    server = servers[message.guild.id];
                    let rKeyArray = Array.from(congratsDatabase.keys());
                    function playRandom() {
                        numOfRetries += 1;
                    let rn = Math.floor((Math.random() * (rKeyArray.length)) + 1);
                    let rk = rKeyArray[rn];
                    console.log("attempting to play key:" + rk);
                    whatsp = congratsDatabase.get(rk);
                    server.queue.push(congratsDatabase.get(rk));
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                            console.log("calling play method...");
                            play(connection, message);
                        } catch(e) {
                            // Error catching - fault with the database yt link?
                            console.log("Below is a caught error message. (this broke:" + rk+")");
                            //printErrorToChannel("!r", rk, e);
                            console.log(e);
                            if (numOfRetries > 2) {
                                message.channel.send("Actually forget it, this problem is beyond my scope... sorry.");
                                connection.disconnect();
                                return;
                            } else {
                                if (numOfRetries > 1) { 
                                    message.channel.send("Uh oh, hmm, lemme try that again...");
                                } else {
                            message.channel.send("There was a slight problem but I think I got it, here's a random song.");
                                }
                            //message.channel.send("I'm sorry kiddo, couldn't find a random song in time... I'll see myself out.");
                            playRandom();
                            }
                            return;
                        }
                    })
                }
                playRandom();
                    break;
                
                //!h returns all existing tags in the database
                case "!key" :
               var keyArray = Array.from(congratsDatabase.keys());
               keyArray.sort();
               var s = "";
               for (var key in keyArray) {
                   if (key == 0) {
                       s = keyArray[key];
                   } else {
                       s = s + ", " + keyArray[key];
                   }
               }
               message.channel.send(s);
                break;
                case "!keys" :
                    var keyArray = Array.from(congratsDatabase.keys());
                    keyArray.sort();
                    var s = "";
                    for (var key in keyArray) {
                        if (key == 0) {
                            s = keyArray[key];
                        } else {
                            s = s + ", " + keyArray[key];
                        }
                    }
                    message.channel.send(s);
                     break;

            //What's Playing?         
            case "!?":
                if (args[1] == true){
                    if(args[1] == "" || args[1] == " "){
                        // intentionally left blank
                    }else {
                        message.channel.send(congratsDatabase.get(args[1]));
                        break;
                    }
                }
                if (whatsp != "") {
                    message.channel.send(whatsp);
                } else {
                    message.channel.send("Nothing is playing right now");
                }
                break;


            // list commands for public
            case "!h" :
                    message.channel.send(
                        "Things you could ask me:\n"
                        + "----------------------------------------------\n"
                        + "!p [youtube link] --> Plays YouTube video\n "
                        + "!e --> Stops playing \n "
                        + "!? --> Tells you what's playing \n"
                        + "--- *Curated songs [Work in Progress]:* ---  \n"
                        + "!key --> All the artist song tags (separated by a comma) \n"
                        + "!d [key] --> Plays a song from the database \n"
                        + "!a --> Adds a song to the database \n"
                        + "!rm --> Removes a song from the database\n"
                        +"**Or just say congrats to a friend. I will chime in too :) **");
            break;

            
            // prints out the version number
            case "!v" :
            message.channel.send("version: " + version);
            break;
            // prints out the build number
            case "!vv" :
            message.channel.send("version: " + buildNumber);
            break;
            // add to the databse
            case "!a":
                if (!args[1] || !args[2]){
                    message.channel.send("Could not add to the databse. Put a song key followed by a link.");
                    break;
                }
                var songsAddedInt = 0;
                var z = 1;
                while (args[z] && args[z+1]){
                    var linkZ = args[z+1];
                    if (linkZ.substring(linkZ.length - 1) == ",") {
                        linkZ = linkZ.substring(0,linkZ.length-1);
                    }
                congratsDatabase.set(args[z], args[z+1]);
                z = z+2;
                songsAddedInt += 1;
            }
            if (songsAddedInt = 1){
            message.channel.send("Song successfully added to the database.");
            break;
            } else if (songsAddedInt > 1) {
                message.channel.send(songsAddedInt.toString() + " songs added to the database.");
            }
            break;
            //removes databse entries
            case "!rm":
            var successInDelete = congratsDatabase.delete(args[1]);
            if (successInDelete == true){
                message.channel.send("Song successfully removed from the database.");
            } else {
                message.channel.send("Could not find song tag within the database.");
            }
            break;
          }
        }
    })


    /**
     * Prints the error to the testing channel.
     * @param activationType the keyword that causes the error
     * @param songKey the keyword of the song in the database
     * @param e the error message
     */
function printErrorToChannel(activationType, songKey, e) {
    bot.channels.cache.get("730239813403410619").send("ERROR: When called " + activationType +", song key: "+ songKey);
    bot.channels.cache.get("730239813403410619").send(e);
}

    /**
     * Prints the error to the testing channel with no args.
     */
    //function printErrorToChannel() {
    //    bot.channels.cache.get("730239813403410619").send("There was an error!");
    //}


   
 
var congratsDatabase = new Map();


















//Map for the database with [tag], [url]
 /*   
var congratsDatabase = new Map([
    ["karmaFieldsB", "https://www.youtube.com/watch?v=ijpgqchByuY"], 
    ["karmaFieldsW", "https://www.youtube.com/watch?v=9_Wl0NLl79g"],

    
    ["tycho", "https://www.youtube.com/watch?v=Z6ih1aKeETk"],

    ["broken", "https://www.youtube.com/watch?v=A6ih1aKeETk"],
    
    
    ["brockhampton", "https://www.youtube.com/watch?v=7lKl_YvTizw&list=PLql5iS_v44478m2sWcIkTqO2YZLwC9vkQ&index=2"],
    
    
    ["everything", "https://www.youtube.com/watch?v=It6OTZD140E"],
    
    
    ["tender", "https://www.youtube.com/watch?v=SN9IZ86evb4"],
    
    
    ["rkcbV", "https://www.youtube.com/watch?v=tUwUenVk7zc"],
    ["rkcbB", "https://www.youtube.com/watch?v=LYN4YPAFfuo"],
    
    
    ["gorillaz", "https://www.youtube.com/watch?v=NDvlD3E7DWg"],
    
    
    ["mrRobot", "https://www.youtube.com/watch?v=P0sAYxS03i0"],
    
    
    ["glassanimalsY", "https://www.youtube.com/watch?v=Ts--MxmAFkQ"],
    ["glassanimalsT", "https://www.youtube.com/watch?v=R3QbZUekxjk"],

    ["haddaway", "https://www.youtube.com/watch?v=HEXWRTEbj1I"],
    
    
    ["brokenbells", "https://www.youtube.com/watch?v=Lkv2zF2Bgq0"],
    
    
    ["lorn", "https://www.youtube.com/watch?v=tdKBNT641V8"],

    ["pMaloneNoOption", "https://www.youtube.com/watch?v=tdKBNT641V8"],
    
    
    ["alltta", "https://www.youtube.com/watch?v=7XEML-eYCjs"],
    
    
    ["banksG", "https://www.youtube.com/watch?v=rD85HZQwwWw"],
    ["banksS", "https://www.youtube.com/watch?v=Zn4TnsWUpmU"],
    ["banksA", "https://www.youtube.com/watch?v=nIVEAQfbI5w"],
    ["banksH", "https://www.youtube.com/watch?v=Z5mNZ6B9ESk"],
    
    
    ["bigdataE", "https://www.youtube.com/watch?v=tlbNZ_oGgdc"],
    ["bigdataM", "https://www.youtube.com/watch?v=ZtZc4h-m8wQ"],
    ["bigdataL", "https://www.youtube.com/watch?v=WAmCeYz9D90"],
    
    
    ["glitch", "https://youtu.be/ezk_dD2Ia-w"],
    
    
    ["ishome", "https://www.youtube.com/watch?v=mc0BnfEMzSA"],

    ["toliverAp", "https://www.youtube.com/watch?v=mc0BnfEMzSA"],
    
    
    ["zhuF", "https://www.youtube.com/watch?v=7373VBAN9eU"],
    ["zhuO", "https://www.youtube.com/watch?v=jaRsJvZgg2s"],
    ["zhuT", "https://www.youtube.com/watch?v=qqLmXjx7Uzc"],
    
    ["bebeRexha", "https://www.youtube.com/watch?v=fTNnwzXrVdg"],

    ["snavesUs", "https://www.youtuWbe.com/watch?v=OjT1nqtlGGU"]
    
]);
*/





    