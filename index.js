const {
    Client,
    Attachment
} = require('discord.js');
const bot = new Client();

const ytdl = require("ytdl-core");


const token = 'NzMwMzUwNDUyMjY4NTk3MzAw.XwWN5Q.kMbc50n78vAwKw-sAAf2wl0Up6E';

const PREFIX = '!';

var version = '0.0.1';


var servers = {};


bot.on('message', message => {
  


//youtube search function
    let args = message.content.split(" ");
    console.log(args);
    switch (args[0]) {
        case '!play':
            function play(connection, message){
                var server = servers[message.guild.id];
                server.dispatcher = connection.play(ytdl(server.queue[0], {filter: "audioonly"}));
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
                message.channel.send("you need to provide a link");
                return;
            }
            if(!message.member.voice.channel){
                message.channel.send("You must be in a channel to play the bot!");
                return;
            }
            if(!servers[message.guild.id]) servers[message.guild.id] = {
                queue: []
            }
            var server = servers[message.guild.id];

            server.queue.push(args[1]);
            if(!message.guild.voiceChannel) message.member.voice.channel.join().then(function(connection){
                play(connection, message);
            })
            break;
    }
})

bot.login(token);








































/* BELOW DOESN'T WORK, SEE ABOVE FOR SIMPLIFIED REWORKED CODE

const {
    Client,
    Attachment
} = require('discord.js');
const bot = new Client();

const ytdl = require("ytdl-core");


const token = 'NzMwMzUwNDUyMjY4NTk3MzAw.XwWN5Q.kMbc50n78vAwKw-sAAf2wl0Up6E';

const PREFIX = '!';

var version = '0.0.1';

var servers = {};
//servers is open array to save all the queue songs

bot.on('ready', () => {
    console.log('Bot is up and running! ' + version);

})




bot.on('message', message => {

    let args = message.content.substring(PREFIX.length).split(" ");

    switch (args[0]) {
        case 'play':

            function play(connection, message){ 
                var server = servers[message.member.id];

                server.dispatcher = connection.play(ytdl(server.queue[0], {filter: "audioonly"}));
                
                server.queue.shift();

                server.dispatcher.on('finish', function(){
                    if(server.queue[0]){
                        play(connection, message);
                    }else {
                        connection.disconnect();
                    }
                });
           
           
            }

            
            if(!args[1]){
                message.channel.send("You need to provide a link!");
                return;
            }

            if(!message.member.voice.channel){
                message.channel.send("You must be in a channel to play the bot!");
                return;
            }

            if(!servers[message.member.id]) servers[message.member.id] = {
                queue: []
            }

            var server = servers[message.member.id];

            server.queue.push(args[1]);
           
            if(!message.member.voice.connections) message.member.voice.channel.join().then(function(conncection){
                play(connection, message);
            })

        
        
        
        
        break;
    }


});

bot.login(token);




*/