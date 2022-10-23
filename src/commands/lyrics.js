const ytdl = require('ytdl-core-discord');
const fetch = require('isomorphic-unfetch');
const {getData} = require('spotify-url-info')(fetch);
const {botID, StreamType} = require('../utils/lib/constants');
// imports for YouTube captions
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
// Genius imports
const Genius = require('genius-lyrics');
const {reactions} = require('../utils/lib/reactions');
const {EmbedBuilderLocal} = require('../utils/lib/EmbedBuilderLocal');
const GeniusClient = new Genius.Client();

/**
 * Returns lyrics for what is currently playing in a server.
 * @param channel The channel metadata
 * @param reactionCallback A callback for when the lyrics (text) is sent within the channel.
 * @param args The args with the message content
 * @param queueItem The queueItem to get the lyrics of.
 * @param messageMemberId The id of the member that sent the command.
 * @returns {*}
 */
function runLyricsCommand(channel, reactionCallback, args, queueItem, messageMemberId) {
  if (!queueItem) {
    return channel.send('must be playing a song');
  }
  channel.send('retrieving lyrics...').then(async (sentMsg) => {
    let searchTerm;
    let searchTermRemix;
    let songName;
    let artistName;
    const lUrl = queueItem.url;
    let infos;
    if (args[1]) {
      args[0] = '';
      searchTerm = args.join(' ').trim();
    } else {
      if (queueItem.type === StreamType.SPOTIFY) {
        infos = queueItem.infos || await getData(lUrl);
        songName = infos.name.toLowerCase();
        let songNameSubIndex = songName.search('[-]');
        if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
        songNameSubIndex = songName.search('[(]');
        if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
        else {
          songNameSubIndex = songName.search('[\[]');
          if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
        }
        artistName = infos.artists[0].name;
        searchTerm = songName + ' ' + artistName;
        if (infos.name.toLowerCase().includes('remix')) {
          const remixArgs = infos.name.toLowerCase().split(' ');
          const remixArgs2 = [];
          let wordIndex = 0;
          for (const i of remixArgs) {
            if (i.includes('remix') && wordIndex !== 0) {
              wordIndex--;
              break;
            }
            remixArgs2[wordIndex] = remixArgs[wordIndex];
            wordIndex++;
          }
          if (wordIndex) {
            remixArgs2[wordIndex] = '';
            searchTermRemix = remixArgs2.join(' ').trim() + ' ' +
              remixArgs[wordIndex].replace('(', '').trim() +
              ' remix';
          }
        }
      } else if (queueItem.type === StreamType.YOUTUBE) {
        infos = queueItem.infos || await ytdl.getInfo(lUrl);
        const title = infos.title || infos.videoDetails.title;
        if (infos.videoDetails?.media && title.includes(infos.videoDetails.media.song)) {
          // use video metadata
          searchTerm = songName = infos.videoDetails.media.song;
          let songNameSubIndex = songName.search('[(]');
          if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
          else {
            songNameSubIndex = songName.search('[\[]');
            if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
          }
          artistName = infos.videoDetails.media.artist;
          if (artistName) {
            let artistNameSubIndex = artistName.search('ft.');
            if (artistNameSubIndex !== -1) artistName = artistName.substring(0, artistNameSubIndex);
            else {
              artistNameSubIndex = artistName.search(' feat');
              if (artistNameSubIndex !== -1) artistName = artistName.substring(0, artistNameSubIndex);
            }
            searchTerm = songName + ' ' + artistName;
          }
        } else {
          // use title
          let songNameSubIndex = title.search('[(]');
          if (songNameSubIndex !== -1) {
            searchTerm = title.substring(0, songNameSubIndex);
          } else {
            songNameSubIndex = title.search('[\[]');
            if (songNameSubIndex !== -1) searchTerm = title.substring(0, songNameSubIndex);
            else searchTerm = title;
          }
        }
        if (title.toLowerCase().includes('remix')) {
          const remixArgs = title.toLowerCase().split(' ');
          let wordIndex = 0;
          for (const i of remixArgs) {
            if (i.includes('remix') && wordIndex !== 0) {
              wordIndex--;
              break;
            }
            wordIndex++;
          }
          if (wordIndex) {
            searchTermRemix = (songName ? songName : searchTerm) + ' ' +
              remixArgs[wordIndex].replace('(', '') +
              ' remix';
          }
        }
      } else return channel.send('*lyrics command not supported for this stream type*');
    }
    if (searchTermRemix ? (!await sendSongLyrics(sentMsg, searchTermRemix, messageMemberId, reactionCallback) &&
        !await sendSongLyrics(sentMsg, searchTermRemix.replace(' remix', ''), messageMemberId, reactionCallback) &&
        !await sendSongLyrics(sentMsg, searchTerm, messageMemberId, reactionCallback)) :
      !await sendSongLyrics(sentMsg, searchTerm, messageMemberId, reactionCallback)) {
      if (!args[1] && !lUrl.toLowerCase().includes('spotify')) {
        getYoutubeSubtitles(sentMsg, lUrl, infos, reactionCallback);
      } else {
        sentMsg.edit('no results found');
      }
    }
  });
}

/**
 * Sends song lyrics based on the search term.
 * @param message The message metadata.
 * @param searchTerm The search term to look for.
 * @param messageMemberId {string} The id of the member that send the command.
 * @param reactionCallback Callback for when the full text is sent.
 * @returns {Promise<Boolean>} The status of if the song lyrics were found and sent.
 */
async function sendSongLyrics(message, searchTerm, messageMemberId, reactionCallback) {
  try {
    const firstSong = (await GeniusClient.songs.search(searchTerm))[0];
    await message.edit('***Lyrics for ' + firstSong.title + '***\n<' + firstSong.url + '>').then(async (sentMsg) => {
      await sentMsg.react('📄');
      const filter = (reaction, user) => {
        return user.id !== botID && ['📄'].includes(reaction.emoji.name);
      };
      let lyrics;
      const collector = sentMsg.createReactionCollector({filter, time: 300000});
      collector.once('collect', async () => {
        try {
          lyrics = await firstSong.lyrics();
        } catch (e) {
          lyrics = '*could not retrieve*';
        }
        // send the lyrics text on reaction click
        const sentLyricsMsg = await (new EmbedBuilderLocal())
          .setDescription((lyrics.length > 1910 ? lyrics.substring(0, 1910) + '...' : lyrics)).send(message.channel);
        reactionCallback();
        // start reactionCollector for lyrics
        sentLyricsMsg.react(reactions.X).then();
        const lyricsFilter = (reaction, user) => {
          return user.id === messageMemberId && [reactions.X].includes(reaction.emoji.name);
        };
        const lyricsCollector = sentLyricsMsg.createReactionCollector({
          filter: lyricsFilter, time: 300000, dispose: true,
        });
        lyricsCollector.once('collect', () => {
          if (sentLyricsMsg.deletable) sentLyricsMsg.delete();
          lyricsCollector.stop();
        });
        lyricsCollector.on('end', () => {
          if (sentMsg.reactions) sentMsg.reactions.removeAll();
        });
      });
    });
    return true;
  } catch (e) {
    // GeniusClient.songs.search throws an error if the song is not found
    return false;
  }
}

/**
 * Gets the captions/subtitles from youtube using ytdl-core and then sends the captions to the
 * respective text channel.
 * @param message The message that triggered the bot.
 * @param url The video url to get the subtitles.
 * @param infos The ytdl infos.
 * @param reactionCallback Callback for when the full text is sent.
 */
function getYoutubeSubtitles(message, url, infos, reactionCallback) {
  try {
    const playerResp = infos.player_response;
    const tracks = playerResp.captions.playerCaptionsTracklistRenderer.captionTracks;
    let data = '';
    https.get(tracks[0].baseUrl.toString(), function(res) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        res.on('data', function(data_) {
          data += data_.toString();
        });
        res.on('end', function() {
          parser.parseString(data, function(err, result) {
            if (err) {
              console.log('ERROR in getYouTubeSubtitles');
              return console.log(err);
            } else {
              let finalString = '';
              let prevDuration = 0;
              let newDuration;
              for (const i of result.transcript.text) {
                if (!i._) continue;
                if (i._.trim().substring(0, 1) === '[') {
                  finalString += (finalString.substr(finalString.length - 1, 1) === ']' ? ' ' : '\n') +
                    i._;
                  prevDuration -= 5;
                } else {
                  newDuration = parseInt(i.$.start);
                  finalString += ((newDuration - prevDuration > 9) ? '\n' : ' ') +
                    i._;
                  prevDuration = newDuration;
                }
              }
              finalString = finalString.replace(/&#39;/g, '\'').trim();
              finalString = finalString.length > 1910 ? finalString.substring(0, 1910) + '...' : finalString;
              message.edit('Could not find lyrics. Video captions are available.').then((sentMsg) => {
                const mb = '📄';
                sentMsg.react(mb).then();

                const filter = (reaction, user) => {
                  return user.id !== botID && [mb].includes(reaction.emoji.name);
                };

                const collector = sentMsg.createReactionCollector({filter, time: 600000});

                collector.once('collect', () => {
                  message.edit(`***Captions from YouTube***\n${finalString}`);
                  reactionCallback();
                });
              });
            }
          });
        });
      }
    });
  } catch (e) {
    message.edit('no results found');
  }
}

module.exports = {runLyricsCommand};
