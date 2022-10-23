const {EmbedBuilderLocal} = require('./lib/EmbedBuilderLocal');

/**
 * Full description of the help list.
 * @param {*} ps the prefix in string format.
 * @param {*} version the current version of db vibe.
 * @returns {Array<string>} an array of strings representing the help list.
 */
function getPages(ps, version) {
  // example of help list change-log highlight
  // '***[NEW]** - example_feature_here (May 2022)*\n\n' +
  return [
    // PAGE 1
    '--------------  **Music Commands** --------------\n' +
    `\`${ps}play [word] \` Searches YouTube and plays *[p]* \n` +
    `\`${ps}play [link] \` Play YT/Spotify/SoundCloud/Twitch link *[p]* \n` +
    `\`${ps}playnow [word/link] \` Plays now, overrides queue *[pn]*\n` +
    `\`${ps}playnow [link] [time] \` Begin at a specific timestamp\n` +
    `\`${ps}pause \` Pause *[pa]*\n` +
    `\`${ps}resume \` Resume if paused *[res]* \n` +
    `\`${ps}skip [# times] \` Skip the current link *[sk]*\n` +
    `\`${ps}rewind [# times] \` Rewind to play previous links *[rw]*\n` +
    `\`${ps}end \` Stops playing and ends session  *[e]*\n` +
    `\`${ps}now \` See now playing *[np]*\n` +
    `\`${ps}loop \` Loops songs on finish *[l]*\n` +
    `\`${ps}queue \` Displays the queue *[q]*\n` +
    `\`${ps}seek [link] [duration]\` Seek to a certain timestamp` +
    '\n\n-----------  **Advanced Music Commands**  -----------\n' +
    `\`${ps}shuffle \` Shuffle the queue\n` +
    `\`${ps}smartplay \` Autoplay when there is nothing next to play\n` +
    `\`${ps}lyrics \` Get lyrics of what\'s currently playing\n` +
    `\`${ps}dj \` DJ mode, members have to vote to skip tracks\n` +
    `\`${ps}dictator \` Dictator mode, one member controls all music commands\n` +
    `\`${ps}frequency \` View the frequency of the links played in a Session\n` +
    `\`${ps}purge [keyword]\` purge a keyword from all links in the queue \n` +
    `\`${ps}verbose \` Keep all song embeds during a session\n` +
    `\`${ps}silence \` Silence/hide the now-playing embed \n`,
    // PAGE 2
    '-----------  **Keys**  -----------\n' +
    '*Keys are ways to save your favorite links as words.*\n' +
    '*Keys are saved within playlists*\n' +
    `\`${ps}keys \` See all of your keys / playlists *[k]*\n` +
    `\`${ps}d [key] \` Play any of your keys \n` +
    `\`${ps}dnow [key] \` Play key immediately, overrides queue *[kn]* \n` +
    `\`${ps}s [# of keys] \` shuffle and play random keys  *[r]*\n` +
    `\`${ps}add [playlist] [key] [url] \` Add a key to a playlist (or general) *[a]*\n` +
    `\`${ps}delete [key] \` Deletes a link from the keys  *[del]*\n` +
    `\`${ps}find [key / link] \` See if a link/key is in the keys-list *[s]*\n` +
    `\`${ps}link [key] \` Get the full link of a specific key  *[url]*\n` +
    `\`${ps}move-keys [keys] [playlist] \` move keys to a different playlist *[mk]*\n` +
    '\n-----------  **Playlists**  -----------\n' +
    `\`${ps}pd [playlist] \` Play an entire playlist\n` +
    `\`${ps}ps [playlist] \` Shuffle and play a playlist\n` +
    `\`${ps}add-playlist [playlist] \` Add a new playlist  *[p-add]*\n` +
    `\`${ps}delete-playlist [playlist] \` Delete a playlist and its contents *[p-del]*\n` +
    `\`${ps}splash [url] \` Add a custom image to your keys page\n` +
    '\n--------------  **Other Commands**  -----------------\n' +
    `\`${ps}guess \` Random roll for the number of people in the voice channel \n` +
    `\`${ps}changeprefix [new prefix] \` Changes the prefix for all commands \n` +
    `\`${ps}insert [link] \` Insert a link anywhere within the queue\n` +
    `\`${ps}remove [num] \` Remove a link from the queue\n` +
    `\`${ps}ticket [message] \` contact the developers, request a feature \n` +
    `\n*version ${version}*`,
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
     - use the command \`${ps}ticket\`.
     We will promptly look into fixing any issues experienced! 
     
     [support us](https://top.gg/bot/730350452268597300)
   `,
  ];
}
/**
 * List of titles for the help list.
 * @returns {Array<string>} an array of strings representing respective titles for the help list.
 */
function getTitleArray() {
  return [
    'Help List  *[short-command]*', 'Help List  *[short-command]*', 'FAQs',
  ];
}

/**
 * Function to generate an array of embeds representing the help list.
 * @param {string} prefixString the prefix in string format
 * @param numOfPages {number} optional - the number of embeds to generate
 * @param version {string} the current version of the db vibe
 * @returns {Array<EmbedBuilderLocal>} an array of embeds representing the help list.
 */
function getHelpList(prefixString, numOfPages, version) {
  const pages = getPages(prefixString, version);
  const embedPages = [];
  const titleArray = getTitleArray();
  if (!numOfPages || numOfPages > pages.length) numOfPages = pages.length;
  for (let i = 0; i < numOfPages; i++) {
    const helpListEmbed = new EmbedBuilderLocal()
      .setTitle(titleArray[i] || titleArray.slice(-1)[0])
      .setDescription(pages[i])
      .setFooter({text: `(${i + 1}/${numOfPages})`});
    embedPages.push(helpListEmbed);
  }

  return embedPages;
}

module.exports = {getHelpList};
