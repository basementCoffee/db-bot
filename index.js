
const {
    Client,
    Attachment
} = require('discord.js');

// initialization 
const bot = new Client();
const ytdl = require("ytdl-core");
//const token = 'N  z     MwMzUwNDUyMjY4NTk3MzAw.Xwdv7g.cQoviYyvcFsDhXSHme4m--5L_d0';
const PREFIX = '!';
var version = '1.0.2';
var servers = {};
var testingChannelGuildID = 726687842150907924;
//bot.login(token);
bot.login(process.env.token);
var whatsp = "";

// parses message, provides a response
bot.on('message', msg=>{
    if(msg.content.includes("hello" || "howdy")){
        let randomInt = Math.floor(Math.random() * 3);
        if (randomInt == 0) {
            let randomInt2 = Math.floor(Math.random() * 3);
            // valorant responses
            if (randomInt2 == 0) {
        msg.reply("Sup, who's down for some Valorant?");
            } else if(randomInt2 == 1) {
                msg.reply("Hello my fellow Valorant gamer");
            } else {
                msg.reply("Hi, just busy trying out this game called Valorant... I heard it's not half bad");
            }
            // end valorant responses
        } else if (randomInt == 1) {
            let randomInt3 = Math.floor(Math.random() * 4);
            if (randomInt3 == 0) {
            msg.reply("Howdy-.. I mean BKAWHH");
            } else if (randomInt3 == 1) {
                msg.reply("Quak quak?");
            } else if (randomInt3 == 2) {
                msg.reply("Hi. How's it going.");
            } 
            else {
                msg.reply("Hello! I'm your friendly neighborhood penguin.");
            }
        } else {
            msg.reply('HELLO FRIEND!');
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
            let args = message.content.split(" ");
            console.log(args);
            switch (args[0]) {
                
                
                //!p is just the basic rythm bot 
                case '!p':
                    function play(connection, message){
                        var server = servers[message.guild.id];
                        server.dispatcher = connection.play(ytdl(server.queue[0], { quality: 'highestaudio'}));
                        server.queue.shift();
                        server.dispatcher.on("end", function(){
                            if(server.queue[0]){
                                play(connection, message);
                            }else{
                                connection.disconnect();
                            }
                        });
                    }
                    if (!args[1]) {
                        message.channel.send("Where's the link? I can't read your mind... unfortunately.");
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
                        console.log(e);
                        whatsp = "";
                        message.channel.send("Sorry buddy, couldn't find the video. uh... is the link a real youtube video?");
                        connection.disconnect();
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
                    whatsp = congratsDatabase.get(args[1]);
                    let dPhrase = args[1];
                    server.queue.push(congratsDatabase.get(args[1]));
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                        play(connection, message);
                        } catch(e) {
                            console.log("this broke:" + dPhrase);
                            console.log(e);
                            bot.channels.cache.get("726687842150907924").send("ERROR: When called !d, song key: "+ rk);
                            printErrorToChannel("!d", rk, e);
                            message.channel.send("Sorry buddy, couldn't find the video. uh... idk what else to tell ya");
                            connection.disconnect();
                            return;
                        }
                    })
                    break;   
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
                            console.log("this broke:" + rk);
                            //bot.channels.cache.get("726687842150907924").send("ERROR: When called random, song key: "+ rk);
                            //bot.channels.cache.get("726687842150907924").send(e);
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
                       s = s + ", " + keyArray[key]
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
                            s = s + ", " + keyArray[key]
                        }
                    }
                    message.channel.send(s);
                     break;
            case "!?":
                printErrorToChannel2();
                if (whatsp != "") {
                message.channel.send(whatsp);
                } else {
                    message.channel.send("Nothing is playing right now");
                }
                break;
                // list commands for public
            case "!h" :
                printErrorToChannel();
                    message.channel.send(
                        "Things you could ask me:\n"
                        + "----------------------------------------------\n"
                        + "!p [youtube link] --> Plays YouTube video\n "
                        + "!e --> Stops playing \n "
                        + "!? --> Tells you what's playing \n"
                        + "*Curated songs[WIP]:*  \n"
                        + "!keys --> All the artist tags (separated by a comma) \n"
                        + "!d [key] --> Plays a song from the database \n"
                        + "!s --> Prints the size of the song database \n"
                        +"**Or just say congrats! I love saying that too :)**");
            break;
            // prints out the version number
            case "!hv" :
            message.channel.send("version: " + v);
            break;
          }
        }
    })


    /**
     * Prints the error to the testing channel.
     */
function printErrorToChannel(activationType, songKey, e) {
    bot.channels.cache.get("726687842150907924").send("ERROR: When called " + activationType +", song key: "+ songKey);
    bot.channels.cache.get("726687842150907924").send(e);
}

    /**
     * Prints the error to the testing channel with no args.
     */
    function printErrorToChannel() {
        bot.channels.cache.get("730239813403410619").send("There was an error Keith!");
    }

    /**
     * Prints the error to the testing channel with no args take 2.
     */
    function printErrorToChannel2() {
        bot.channels.cache.get("726687842150907924").send("There was an error Bot!");
    }




//Map for the database with [tag], [url]

    var congratsDatabase = new Map([
        ["karmafields-b", "https://www.youtube.com/watch?v=ijpgqchByuY"], 
        ["karmafields-w", "https://www.youtube.com/watch?v=9_Wl0NLl79g"],

        
        ["tycho", "https://www.youtube.com/watch?v=Z6ih1aKeETk"],

        ["broken", "https://www.youtube.com/watch?v=A6ih1aKeETk"],
        
        
        ["brockhampton", "https://www.youtube.com/watch?v=7lKl_YvTizw&list=PLql5iS_v44478m2sWcIkTqO2YZLwC9vkQ&index=2"],
        
        
        ["everything", "https://www.youtube.com/watch?v=It6OTZD140E"],
        
        
        ["tender", "https://www.youtube.com/watch?v=SN9IZ86evb4"],
        
        
        ["rkcb-v", "https://www.youtube.com/watch?v=tUwUenVk7zc"],
        ["rkcb-b", "https://www.youtube.com/watch?v=LYN4YPAFfuo"],
        
        
        ["gorillaz", "https://www.youtube.com/watch?v=NDvlD3E7DWg"],
        
        
        ["mr.robot", "https://www.youtube.com/watch?v=PxJJkfsHGyM"],
        
        
        ["glassanimals-y", "https://www.youtube.com/watch?v=Ts--MxmAFkQ"],
        ["glassanimals-t", "https://www.youtube.com/watch?v=R3QbZUekxjk"],

        ["haddaway", "https://www.youtube.com/watch?v=HEXWRTEbj1I"],
        
        
        ["brokenbells", "https://www.youtube.com/watch?v=Lkv2zF2Bgq0"],
        
        
        ["lorn", "https://www.youtube.com/watch?v=tdKBNT641V8"],

        ["postmalone-no", "https://www.youtube.com/watch?v=tdKBNT641V8"],
        
        
        ["alltta", "https://www.youtube.com/watch?v=7XEML-eYCjs"],
        
        
        ["banks-g", "https://www.youtube.com/watch?v=rD85HZQwwWw"],
        ["banks-s", "https://www.youtube.com/watch?v=Zn4TnsWUpmU"],
        ["banks-a", "https://www.youtube.com/watch?v=nIVEAQfbI5w"],
        ["banks-h", "https://www.youtube.com/watch?v=Z5mNZ6B9ESk"],
        
        
        ["bigdata-e", "https://www.youtube.com/watch?v=tlbNZ_oGgdc"],
        ["bigdata-m", "https://www.youtube.com/watch?v=ZtZc4h-m8wQ"],
        ["bigdata-l", "https://www.youtube.com/watch?v=WAmCeYz9D90"],
        
        
        ["glitch", "https://youtu.be/ezk_dD2Ia-w"],
        
        
        ["ishome", "https://www.youtube.com/watch?v=mc0BnfEMzSA"],
        
        
        ["zhu-f", "https://www.youtube.com/watch?v=7373VBAN9eU"],
        ["zhu-o", "https://www.youtube.com/watch?v=jaRsJvZgg2s"],
        ["zhu-t", "https://www.youtube.com/watch?v=qqLmXjx7Uzc"],
        
        ["beberexha", "https://www.youtube.com/watch?v=fTNnwzXrVdg"]
        
    ]);
