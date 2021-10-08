const ytdl = require('ytdl-core-discord');
const {botInVC} = require('../utils/utils');
const {getData} = require('spotify-url-info');

// imports for YouTube captions
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

// Genius imports
const Genius = require("genius-lyrics");
const GeniusClient = new Genius.Client();

let botID = '730350452268597300';

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
    const lUrl = server.queue[0];
    if (args[1]) {
      args[0] = '';
      searchTerm = args.join(' ').trim();
    } else {
      if (lUrl.toLowerCase().includes('spotify')) {
        const infos = await getData(lUrl);
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
      } else {
        const infos = await ytdl.getInfo(lUrl);
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
      }
    }
    const sendSongLyrics = async (searchTerm) => {
      try {
        const searches = await GeniusClient.songs.search(searchTerm);
        const firstSong = searches[0];
        message.channel.send('***Lyrics for ' + firstSong.title + '***\n<' + firstSong.url + '>').then(async sentMsg => {
          sentMsg.react('📄').then();
          const lyrics = await firstSong.lyrics();
          const filter = (reaction, user) => {
            return user.id !== botID && ['📄'].includes(reaction.emoji.name);
          };

          const collector = sentMsg.createReactionCollector(filter, {time: 600000});
          collector.once('collect', () => {
            // send the lyrics text on reaction click
            message.channel.send((lyrics.length > 1910 ? lyrics.substr(0, 1910) + '...' : lyrics)).then(server.numSinceLastEmbed += 10);
          });
        });
        return true;
      } catch (e) {
        return false;
      }
    };
    if (searchTermRemix ? (!await sendSongLyrics(searchTermRemix)
        && !await sendSongLyrics(searchTermRemix.replace(' remix', ''))
        && !await sendSongLyrics(searchTerm)) :
      !await sendSongLyrics(searchTerm)) {
      if (!args[1] && !lUrl.toLowerCase().includes('spotify')) {
        getYoutubeSubtitles(message, lUrl, server);
      } else {
        message.channel.send('no results found');
        server.numSinceLastEmbed--;
      }
    }
    sentMsg.delete();
  });
}

/**
 * Gets the captions/subtitles from youtube using ytdl-core and then sends the captions to the
 * respective text channel.
 * @param message The message that triggered the bot.
 * @param url The video url to get the subtitles.
 * @param server The server to update.
 */
function getYoutubeSubtitles (message, url, server) {

  ytdl.getInfo(url).then(info => {
    try {
      const player_resp = info.player_response;
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
                finalString = finalString.replace(/&#39;/g, '\'');
                finalString = finalString.length > 1910 ? finalString.substr(0, 1910) + '...' : finalString;
                message.channel.send('Could not find lyrics. Video captions are available.').then(sentMsg => {
                  const mb = '📄';
                  sentMsg.react(mb).then();

                  const filter = (reaction, user) => {
                    return user.id !== botID && [mb].includes(reaction.emoji.name);
                  };

                  const collector = sentMsg.createReactionCollector(filter, {time: 600000});

                  collector.once('collect', () => {
                    message.channel.send('***Captions from YouTube***');
                    message.channel.send(finalString).then(server.numSinceLastEmbed += 10);
                  });
                });
              }
            });
          });
        }
      });
    } catch (e) {
      message.channel.send('no results found');
      server.numSinceLastEmbed -= 2;
    }
  });
}

module.exports = {runLyricsCommand};