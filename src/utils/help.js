const {MessageEmbed} = require('discord.js');
const {botID} = require('./process/constants');

function getPages (prefixString, version) {
  return [
    // PAGE 1
    '***[NEW]** - added seek command (March 2022)*\n\n' +
    '--------------  **Music Commands** --------------\n\`' +
    prefixString +
    'play [word] \` Searches YouTube and plays *[p]* \n\`' +
    prefixString +
    'play [link] \` Play YT/Spotify/SoundCloud/Twitch link *[p]* \n\`' +
    prefixString +
    'playnow [word/link] \` Plays now, overrides queue *[pn]*\n\`' +
    prefixString +
    'playnow [link] [time] \` Begin at a specific timestamp\n\`' +
    prefixString +
    'pause \` Pause *[pa]*\n\`' +
    prefixString +
    'resume \` Resume if paused *[res]* \n\`' +
    prefixString +
    'skip [# times] \` Skip the current link *[sk]*\n\`' +
    prefixString +
    'rewind [# times] \` Rewind to play previous links *[rw]*\n\`' +
    prefixString +
    'end \` Stops playing and ends session  *[e]*\n\`' +
    prefixString +
    'now \` See now playing *[np]*\n\`' +
    prefixString +
    'loop \` Loops songs on finish *[l]*\n\`' +
    prefixString +
    'queue \` Displays the queue *[q]*\n\`' +
    prefixString +
    'seek [link] [duration]\` Seek to a certain timestamp' +
    '\n\n-----------  **Advanced Music Commands**  -----------\n\`' +
    prefixString +
    'smartplay \` Autoplay when there is nothing next to play\n\`' +
    prefixString +
    'lyrics \` Get lyrics of what\'s currently playing\n\`' +
    prefixString +
    'shuffle [link] \` Shuffle a playlist before playing\n\`' +
    prefixString +
    'dj \` DJ mode, members have to vote to skip tracks\n\`' +
    prefixString +
    'dictator \` Dictator mode, one member controls all music commands\n\`' +
    prefixString +
    'verbose \` Keep all song embeds during a session\n\`' +
    prefixString +
    'silence \` Silence/hide the now-playing embed \n'
    , // PAGE 2
    '-----------  **Keys**  -----------\n' +
    '*Keys are ways to save your favorite links as words.*\n' +
    '*There are two types of keys: Server Keys & Personal Keys*\n\n' +
    '-----------  **Server Keys**  -----------\`\n' +
    prefixString +
    "keys \` See all of the server's keys *[k]*\n\`" +
    prefixString +
    'd [key] \` Play a song from the server keys \n\`' +
    prefixString +
    'dnow [key] \` Play immediately, overrides queue *[kn]* \n\`' +
    prefixString +
    'add [key] [url] \` Add a link to the server keys  *[a]*\n\`' +
    prefixString +
    'delete [key] \` Deletes a link from the server keys  *[del]*\n\`' +
    prefixString +
    'shuffle [# times] \` Play a random song from server keys  *[r]*\n\`' +
    prefixString +
    'find [key / link] \` See if a link/key is in the keys-list *[s]*\n\`' +
    prefixString +
    'link [key] \` Get the full link of a specific key  *[url]*\n' +
    '\n-----------  **Personal Keys**  -----------\n' +
    "*Prepend 'm' to each command above to access your personal keys list*\nex: \`" + prefixString + "mkeys \`\n" +
    '\n--------------  **Other Commands**  -----------------\n\`' +
    prefixString +
    'guess \` Random roll for the number of people in the voice channel \n\`' +
    prefixString +
    'changeprefix [new prefix] \` Changes the prefix for all commands \n\`' +
    prefixString +
    'insert [link] \` Insert a link anywhere within the queue\n\`' +
    prefixString +
    'remove [num] \` Remove a link from the queue\n\`' +
    prefixString +
    'ticket [message] \` contact the developers, request a feature \n' +
    `\n*version ${version}*`
    ,
    `
    Why isn't the db bot verified?
    - *discord no longer allows music bots to become verified.*
    
    How is db bot free?
     - *currently we can support running costs of the db bot,
     but there will soon be a server cap in place to keep it free.
     Once at capacity, new servers will not be able to add this bot
     unless there is an open slot available.*
     
     Where can I view updates for the db bot? 
     - [*view updates here*](https://github.com/basementCoffee/db-bot/commits/master)
     
     What if there is an issue with the db bot?
     - use the command \`${prefixString}ticket\`.
     We will promptly look into fixing any issues experienced! 
     
     [support us](https://top.gg/bot/730350452268597300)
   `
  ];
}

function getTitleArray () {
  return [
    'Help List  *[short-command]*', 'Help List  *[short-command]*', 'FAQs'
  ];
}

/**
 * Function to generate an array of embeds representing the help list.
 * @param {string} prefixString the prefix in string format
 * @param numOfPages {number} optional - the number of embeds to generate
 * @param version {string} the current version of the db bot
 */
function getHelpList (prefixString, numOfPages, version) {
  const pages = getPages(prefixString, version);
  const embedPages = [];
  const titleArray = getTitleArray();
  if (!numOfPages || numOfPages > pages.length) numOfPages = pages.length;
  for (let i = 0; i < numOfPages; i++) {
    const helpListEmbed = new MessageEmbed();
    helpListEmbed
      .setTitle(titleArray[i] || titleArray.slice(-1)[0])
      .setDescription(pages[i])
      .setFooter(`(${i + 1}/${numOfPages})`);
    embedPages.push(helpListEmbed);
  }

  return embedPages;
}

/**
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server The server.
 * @param version {string} The version.
 */
function runHelpCommand (message, server, version) {
  server.numSinceLastEmbed += 10;
  let helpPages = getHelpList(server.prefix, 2, version);
  message.channel.send(helpPages[0]).then((sentMsg) => {
    let currentHelp = 0;
    const hr = '➡️';
    sentMsg.react(hr).then();
    const filter = (reaction, user) => {
      return user.id !== botID;
    };

    const collector = sentMsg.createReactionCollector(filter, {time: 600000, dispose: true});
    collector.on('collect', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % helpPages.length)]);
      }
    });
    collector.on('remove', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % helpPages.length)]);
      }
    });
    collector.on('end', () => {
      if (sentMsg.reactions) sentMsg.reactions.removeAll().then();
    });
  });
}

module.exports = {runHelpCommand, getHelpList};
