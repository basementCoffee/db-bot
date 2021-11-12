const ytdl = require('ytdl-core-discord');
const {botInVC} = require('../utils/utils');
const {getData} = require('spotify-url-info');
const {botID, StreamType} = require('../utils/constants');
// imports for YouTube captions
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
// Genius imports
const Genius = require("genius-lyrics");
const GeniusClient = new Genius.Client();

/**
 * Returns lyrics for what is currently playing in a server.
 * @param message The message metadata
 * @param mgid The message guild id
 * @param args The args with the message content
 * @param server The server playback metadata
 * @returns {*}
 */
function runLyricsCommand (message, mgid, args, server) {
  if ((!botInVC(message) || !server.queue[0]) && !args[1]) {
    return message.channel.send('must be playing a song');
  }
  message.channel.send('retrieving lyrics...').then(async sentMsg => {
    server.numSinceLastEmbed += 2;
    let searchTerm;
    let searchTermRemix;
    let songName;
    let artistName;
    const lUrl = server.queue[0].url;
    let infos;
    if (args[1]) {
      args[0] = '';
      searchTerm = args.join(' ').trim();
    } else {
      if (server.queue[0].type === StreamType.SPOTIFY) {
        infos = server.queue[0].infos || await getData(lUrl);
        songName = infos.name.toLowerCase();
        let songNameSubIndex = songName.search('[-]');
        if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        songNameSubIndex = songName.search('[(]');
        if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        else {
          songNameSubIndex = songName.search('[\[]');
          if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        }
        artistName = infos.artists[0].name;
        searchTerm = songName + ' ' + artistName;
        if (infos.name.toLowerCase().includes('remix')) {
          let remixArgs = infos.name.toLowerCase().split(' ');
          let remixArgs2 = [];
          let wordIndex = 0;
          for (let i of remixArgs) {
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
      } else if (server.queue[0].type === StreamType.YOUTUBE) {
        infos = server.queue[0].infos || await ytdl.getBasicInfo(lUrl);
        if (infos.videoDetails.media && infos.videoDetails.title.includes(infos.videoDetails.media.song)) {
          // use video metadata
          searchTerm = songName = infos.videoDetails.media.song;
          let songNameSubIndex = songName.search('[(]');
          if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
          else {
            songNameSubIndex = songName.search('[\[]');
            if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
          }
          artistName = infos.videoDetails.media.artist;
          if (artistName) {
            let artistNameSubIndex = artistName.search('ft.');
            if (artistNameSubIndex !== -1) artistName = artistName.substr(0, artistNameSubIndex);
            else {
              artistNameSubIndex = artistName.search(' feat');
              if (artistNameSubIndex !== -1) artistName = artistName.substr(0, artistNameSubIndex);
            }
            searchTerm = songName + ' ' + artistName;
          }
        } else {
          // use title
          let songNameSubIndex = infos.videoDetails.title.search('[(]');
          if (songNameSubIndex !== -1) {
            searchTerm = infos.videoDetails.title.substr(0, songNameSubIndex);
          } else {
            songNameSubIndex = infos.videoDetails.title.search('[\[]');
            if (songNameSubIndex !== -1) searchTerm = infos.videoDetails.title.substr(0, songNameSubIndex);
            else searchTerm = infos.videoDetails.title;
          }
        }
        if (infos.videoDetails.title.toLowerCase().includes('remix')) {
          let remixArgs = infos.videoDetails.title.toLowerCase().split(' ');
          let wordIndex = 0;
          for (let i of remixArgs) {
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
      } else return message.channel.send('*lyrics command not supported for this stream type*');
    }
    if (searchTermRemix ? (!await sendSongLyrics(sentMsg, searchTermRemix, server)
        && !await sendSongLyrics(sentMsg, searchTermRemix.replace(' remix', ''), server)
        && !await sendSongLyrics(sentMsg, searchTerm, server)) :
      !await sendSongLyrics(sentMsg, searchTerm, server)) {
      if (!args[1] && !lUrl.toLowerCase().includes('spotify')) {
        getYoutubeSubtitles(sentMsg, lUrl, server, infos);
      } else {
        sentMsg.edit('no results found');
        server.numSinceLastEmbed--;
      }
    }
  });
}

/**
 * Sends song lyrics based on the search term.
 * @param message The message metadata.
 * @param searchTerm The search term to look for.
 * @param server The server.
 * @returns {Promise<Boolean>} The status of if the song lyrics were found and sent.
 */
async function sendSongLyrics (message, searchTerm, server) {
  try {
    const firstSong = (await GeniusClient.songs.search(searchTerm))[0];
    await message.edit('***Lyrics for ' + firstSong.title + '***\n<' + firstSong.url + '>').then(async sentMsg => {
      await sentMsg.react('📄');
      const filter = (reaction, user) => {
        return user.id !== botID && ['📄'].includes(reaction.emoji.name);
      };
      const collector = sentMsg.createReactionCollector(filter, {time: 600000});
      collector.once('collect', async () => {
        const lyrics = await firstSong.lyrics();
        // send the lyrics text on reaction click
        message.channel.send((lyrics.length > 1910 ? lyrics.substr(0, 1910) + '...' : lyrics)).then(server.numSinceLastEmbed += 10);
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
 * @param server The server to update.
 * @param infos The ytdl infos.
 */
function getYoutubeSubtitles (message, url, server, infos) {
  try {
    const player_resp = infos.player_response;
    const tracks = player_resp.captions.playerCaptionsTracklistRenderer.captionTracks;
    let data = '';
    https.get(tracks[0].baseUrl.toString(), function (res) {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        res.on('data', function (data_) { data += data_.toString(); });
        res.on('end', function () {
          parser.parseString(data, function (err, result) {
            if (err) {
              console.log('ERROR in getYouTubeSubtitles');
              return console.log(err);
            } else {
              let finalString = '';
              let prevDuration = 0;
              let newDuration;
              for (let i of result.transcript.text) {
                if (i._.trim().substr(0, 1) === '[') {
                  finalString += (finalString.substr(finalString.length - 1, 1) === ']' ? ' ' : '\n') +
                    i._;
                  prevDuration -= 5;
                } else {
                  newDuration = parseInt(i.$.start);
                  finalString += ((newDuration - prevDuration > 9) ? '\n' : ' ')
                    + i._;
                  prevDuration = newDuration;
                }
              }
              finalString = finalString.replace(/&#39;/g, '\'').trim();
              finalString = finalString.length > 1910 ? finalString.substr(0, 1910) + '...' : finalString;
              message.edit('Could not find lyrics. Video captions are available.').then(sentMsg => {
                const mb = '📄';
                sentMsg.react(mb).then();

                const filter = (reaction, user) => {
                  return user.id !== botID && [mb].includes(reaction.emoji.name);
                };

                const collector = sentMsg.createReactionCollector(filter, {time: 600000});

                collector.once('collect', () => {
                  message.edit(`***Captions from YouTube***\n${finalString}`).then(server.numSinceLastEmbed += 10);
                });
              });
            }
          });
        });
      }
    });
  } catch (e) {
    message.edit('no results found');
    server.numSinceLastEmbed -= 2;
  }
}

module.exports = {runLyricsCommand};