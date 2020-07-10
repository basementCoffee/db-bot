
const {
    Client,
    Attachment
} = require('discord.js');

// initialization 
const bot = new Client();
const ytdl = require("ytdl-core");
//const token = 'N  z     MwMzUwNDUyMjY4NTk3MzAw.Xwdv7g.cQoviYyvcFsDhXSHme4m--5L_d0';
const PREFIX = '!';
var version = '1.0.0';
var servers = {};
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
            let randomInt3 = Math.floor(Math.random() * 3);
            if (randomInt3 == 0) {
            msg.reply("Howdy-.. I mean BKAWHH");
            } else if (randomInt3 == 1) {
                msg.reply("Quak quak?");
            } else {
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
    server.dispatcher = connection.play(ytdl('https://www.youtube.com/watch?v=oyFQVZ2h0V8', { quality: 'highestaudio'}));
    server.dispatcher.setVolume(1);
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
                    whatsp = "";
                    server = servers[message.guild.id];
        
                    server.queue.push(args[1]);
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                        play(connection, message);
                    } catch(e) {
                        console.log(e);
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
                    // OLD WORKING CODE
                    /*
                    let cKeyArray = Array.from(congratsDatabase.keys());
                    message.channel.send("Database size: " + cKeyArray.length);
                    */

                   // NEW ATTEMPT - faster delivery
                   message.channel.send("Database size: " + Array.from(congratsDatabase.keys()).length);
                break;
                //!d to run database songs

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
                    whatsp = args[1];
                    server.queue.push(congratsDatabase.get(args[1]));
                    if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                        try {
                        play(connection, message);
                        } catch(e) {
                            console.log("this broke:" + whatsp);
                            console.log(e);
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
                        play(connection, message);
                        } catch(e) {
                            console.log("this key broke:" + rk);x
                            console.log(e);
                            if (numOfRetries > 2) {
                                message.channel.send("Actually forget it, this problem is beyond my scope... sorry.");
                                connection.disconnect();
                                return;
                            } else {
                                if (numOfRetries > 1) { 
                                    message.channel.send("Hmmm, lemme try that again...");
                                } else {
                            message.channel.send("There was something funky happening in my db dw but here's a random song.");
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
                case "!keys" :
                    /*
                    for (var key in congratsDatabase){
                        keys.push(key);
                    message.channel.send(key);
                }
                */
               let keyArray = Array.from(congratsDatabase.keys());
               //var keyArray = Object.keys(congratsDatabase);
               var s = "";
               for (var key in keyArray) {
                   //s = s + key;
                   //message.channel.send(s);
                   if (key == 0) {
                       s = keyArray[key];
                   } else {
                       s = s + ", " + keyArray[key]
                   }
                   
               }
               message.channel.send(s);
                break;
            case "!?":
                if (whatsp != "") {
                message.channel.send(whatsp);
                }
                break;
            case "!h" :
                    message.channel.send(
                        "Things you could ask me: (v: " + version +") \n"
                        + "!p [youtube link] --> Plays YouTube video\n "
                        + "!e --> Stops playing \n "
                        + "!? --> Tells you what's playing \n"
                        + "*Curated songs[WIP]:*  \n"
                        + "!keys --> All the artist tags (separated by a comma) \n"
                        + "!d [key] --> Plays a song from the database \n"
                        + "!s --> Prints the size of the song database \n"
                        +"**Or just say congrats! I love saying that too :)**");
            break;
            case "!hv" :
            message.channel.send("version:" + v);
            break;
          }
        }
    })


    





//Map for the database with [tag], [url]

    var congratsDatabase = new Map([
        ["karmafields-b", "https://www.youtube.com/watch?v=ijpgqchByuY"], 
        ["karmafields-w", "https://www.youtube.com/watch?v=9_Wl0NLl79g"],

        
        ["tycho", "https://www.youtube.com/watch?v=Z6ih1aKeETk"],
        
        
        ["brockhampton", "https://www.youtube.com/watch?v=7lKl_YvTizw&list=PLql5iS_v44478m2sWcIkTqO2YZLwC9vkQ&index=2"],
        
        
        ["everything", "https://www.youtube.com/watch?v=It6OTZD140E"],
        
        
        ["tender", "https://www.youtube.com/watch?v=SN9IZ86evb4"],
        
        
        ["rkcb-v", "https://www.youtube.com/watch?v=tUwUenVk7zc"],
        ["rkcb-b", "https://www.youtube.com/watch?v=LYN4YPAFfuo"],
        
        
        ["gorillaz", "https://www.youtube.com/watch?v=NDvlD3E7DWg"],
        
        
        ["mr.robot", "https://www.youtube.com/watch?v=PxJJkfsHGyM"],
        
        
        ["glassanimals-y", "https://www.youtube.com/watch?v=Ts--MxmAFkQ"],
        ["glassanimals-t", "https://www.youtube.com/watch?v=R3QbZUekxjk"],
        
        
        ["brokenbells", "https://www.youtube.com/watch?v=Lkv2zF2Bgq0"],
        
        
        ["lorn", "https://www.youtube.com/watch?v=tdKBNT641V8"],
        
        
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
