const ytsr = require('ytsr');
const {playLinkToVC} = require('./stream');
const {MessageEmbed} = require('discord.js');
const {adjustQueueForPlayNow, createQueueItem} = require('../../utils/utils');
const {StreamType, botID} = require('../../utils/process/constants');
const {updateActiveEmbed} = require('../../utils/embed');
const {reactions} = require('../../utils/reactions');

/**
 * Function for searching for message contents on YouTube for playback.
 * Does not check for force disconnect.
 * @param message The discord message
 * @param playNow Bool, whether to override the queue
 * @param server The server playback metadata
 * @param searchTerm The specific phrase to search for, required if not provided a search result
 * @param indexToLookup {string | number?} The search index, requires searchResult to be valid
 * @param searchResult {Object?} The search results, used for recursive call with memoization
 * @param playlistMsg {Object?} A message to be used for other YouTube search results
 * @returns {Promise<*|boolean|undefined>}
 */

async function runYoutubeSearch (message, playNow, server, searchTerm, indexToLookup, searchResult, playlistMsg) {
  // the number of search results to return
  const NUM_SEARCH_RES = 5;
  if (!searchResult) {
    indexToLookup = 0;
    searchResult = (await ytsr(searchTerm, {pages: 1})).items.filter(x => x.type === 'video').slice(0, NUM_SEARCH_RES + 1);
    if (!searchResult[0]) {
      if (!searchTerm.includes('video')) {
        return runYoutubeSearch(message, playNow, server, `${searchTerm} video`, indexToLookup, null, playlistMsg);
      }
      return message.channel.send('could not find video');
    }
  } else {
    indexToLookup = parseInt(indexToLookup);
    if (!indexToLookup) indexToLookup = 1;
    indexToLookup--;
  }
  let ytLink;
  // if we found a video then play it
  ytLink = searchResult[indexToLookup].url;
  if (!ytLink) return message.channel.send('could not find video');
  if (playNow) {
    adjustQueueForPlayNow(server.audio.resource, server);
    server.queue.unshift(createQueueItem(ytLink, StreamType.YOUTUBE, searchResult[indexToLookup]));
    try {
      await playLinkToVC(message, server.queue[0], message.member.voice?.channel, server);
    } catch (e) {
      console.log(e);
      return;
    }
  } else {
    const queueItem = createQueueItem(ytLink, StreamType.YOUTUBE, searchResult[indexToLookup]);
    server.queue.push(queueItem);
    if (server.queue.length === 1) {
      try {
        await playLinkToVC(message, server.queue[0], message.member.voice?.channel, server);
      } catch (e) {
        return;
      }
    } else {
      const foundTitle = searchResult[indexToLookup].title;
      let sentMsg;
      if (foundTitle.charCodeAt(0) < 120) {
        sentMsg = await message.channel.send('*added **' + foundTitle.replace(/\*/g, '') + '** to queue*');
        await updateActiveEmbed(server);
      } else {
        let infos = await ytdl.getBasicInfo(ytLink);
        sentMsg = await message.channel.send('*added **' + infos.videoDetails.title.replace(/\*/g, '') + '** to queue*');
        await updateActiveEmbed(server);
      }
      sentMsg.react(reactions.X).then();
      const filter = (reaction, user) => {
        return user.id === message.member.id && [reactions.X].includes(reaction.emoji.name);
      };
      const collector = sentMsg.createReactionCollector({filter, time: 12000, dispose: true});
      collector.once('collect', () => {
        if (!collector.ended) collector.stop();
        const queueStartIndex = server.queue.length - 1;
        // 5 is the number of items checked from the end of the queue
        const queueEndIndex = Math.max(queueStartIndex - 5, 0);
        for (let i = queueStartIndex; i > queueEndIndex; i--) {
          if (server.queue[i].url === ytLink) {
            server.queue.splice(i, 1);
            sentMsg.edit(`~~${sentMsg.content}~~`);
            break;
          }
        }
        updateActiveEmbed(server);
      });
      collector.on('end', () => {
        if (sentMsg.reactions && sentMsg.deletable) sentMsg.reactions.removeAll();
      });
    }
  }
  if ((playNow || server.queue.length < 2) && !playlistMsg) {
    await message.react(reactions.PAGE_C);
    let collector;
    if (server.searchReactionTimeout) clearTimeout(server.searchReactionTimeout);
    server.searchReactionTimeout = setTimeout(() => {
      if (collector) collector.stop();
      else {
        if (playlistMsg && playlistMsg.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;});
        message.reactions.removeAll();
        server.searchReactionTimeout = null;
      }
    }, 22000);
    const filter = (reaction, user) => {
      if (message.member.voice?.channel) {
        for (const mem of message.member.voice.channel.members) {
          if (user.id === mem[1].id) {
            return user.id !== botID && [reactions.PAGE_C].includes(reaction.emoji.name);
          }
        }
      }
      return false;
    };
    collector = message.createReactionCollector({filter, time: 100000, dispose: true});
    let res;
    let notActive = true;
    let reactionCollector2;
    collector.on('collect', async (reaction, reactionCollector) => {
      clearTimeout(server.searchReactionTimeout);
      server.searchReactionTimeout = setTimeout(() => {collector.stop();}, 60000);
      if (!playlistMsg) {
        res = searchResult.slice(1).map(x => `${x.title}`);
        let finalString = '';
        let i = 0;
        res.forEach(x => {
          i++;
          return finalString += i + '. ' + x + '\n';
        });
        const playlistEmebed = new MessageEmbed()
          .setTitle(`Pick a different video`)
          .setColor('#ffffff')
          .setDescription(`${finalString}\n***What would you like me to play? (1-${res.length})*** [or type 'q' to quit]`);
        playlistMsg = await message.channel.send({embeds: [playlistEmebed]});
      }
      if (notActive) {
        notActive = false;
        reactionCollector2 = reactionCollector;
        const filter = m => {
          return (m.author.id !== botID && reactionCollector.id === m.author.id);
        };
        message.channel.awaitMessages({filter, time: 60000, max: 1, errors: ['time']})
          .then(messages => {
            if (!reactionCollector2) return;
            let playNum = parseInt(messages.first().content && messages.first().content.trim());
            if (playNum) {
              if (playNum < 1 || playNum > res.length) {
                message.channel.send('*invalid number*');
              } else {
                server.queueHistory.push(server.queue.shift());
                runYoutubeSearch(message, true, server, searchTerm, playNum + 1, searchResult, playlistMsg);
              }
            }
            if (playlistMsg?.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;}).catch();
            clearTimeout(server.searchReactionTimeout);
            server.searchReactionTimeout = setTimeout(() => {collector.stop();}, 22000);
            notActive = true;
          }).catch(() => {
          if (playlistMsg?.deletable) playlistMsg.delete().catch();
          notActive = true;
        });
      }
    });
    collector.on('end', () => {
      if (playlistMsg?.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;});
      if (message.deletable && message.reactions) message.reactions.removeAll();
      server.searchReactionTimeout = null;
    });
    collector.on('remove', (reaction, user) => {
      if (!notActive && reactionCollector2.id === user.id) {
        reactionCollector2 = false;
        if (playlistMsg?.deletable) playlistMsg.delete().catch();
        notActive = true;
        playlistMsg = undefined;
      }
    });
  }
}

module.exports = {runYoutubeSearch};
