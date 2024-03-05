import reactions from '../utils/lib/reactions';
import { BaseGuildTextChannel, Message, MessageReaction, User } from 'discord.js';
import { botID, StreamType } from '../utils/lib/constants';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import ytdl from 'ytdl-core-discord';
import fetch from 'isomorphic-unfetch';
import { Song } from 'genius-lyrics';

const { getData } = require('spotify-url-info')(fetch);
// imports for YouTube captions
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
// Genius imports
const Genius = require('genius-lyrics');
const GeniusClient = new Genius.Client();

/**
 * Returns lyrics for what is currently playing in a server.
 * @param channel The channel metadata
 * @param reactionCallback Optional - A callback for when the lyrics (text) is sent within the channel. [FOR THREADS]
 * @param args The args with the message content
 * @param queueItem The queueItem to get the lyrics of.
 * @param messageMemberId The id of the member that sent the command.
 * @returns {*}
 */
async function runLyricsCommand(
  channel: BaseGuildTextChannel,
  reactionCallback: any,
  args: string[],
  queueItem: any,
  messageMemberId: string
): Promise<void> {
  if (!queueItem) {
    await channel.send('must be playing a song');
    return;
  }
  channel.send('retrieving lyrics...').then(async (sentMsg) => {
    let searchTerm;
    let searchTermRemix;
    let songName;
    let artistName;
    const lUrl = queueItem.url;
    let infos;
    if (args[0]) {
      searchTerm = args.join(' ').trim();
    } else if (queueItem.type === StreamType.SPOTIFY) {
      infos = queueItem.infos || (await getData(lUrl));
      songName = infos.name.toLowerCase();
      let songNameSubIndex = songName.search('[-]');
      if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
      songNameSubIndex = songName.search('[(]');
      if (songNameSubIndex !== -1) {
        songName = songName.substring(0, songNameSubIndex);
      } else {
        songNameSubIndex = songName.search('[[]');
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
          searchTermRemix = remixArgs2.join(' ').trim() + ' ' + remixArgs[wordIndex].replace('(', '').trim() + ' remix';
        }
      }
    } else if (queueItem.type === StreamType.YOUTUBE) {
      infos = queueItem.infos || (await ytdl.getInfo(lUrl));
      const title = infos.title || infos.videoDetails.title;
      if (infos.videoDetails?.media && title.includes(infos.videoDetails.media.song)) {
        // use video metadata
        searchTerm = songName = infos.videoDetails.media.song;
        let songNameSubIndex = songName.search('[(]');
        if (songNameSubIndex !== -1) {
          songName = songName.substring(0, songNameSubIndex);
        } else {
          songNameSubIndex = songName.search('[[]');
          if (songNameSubIndex !== -1) songName = songName.substring(0, songNameSubIndex);
        }
        artistName = infos.videoDetails.media.artist;
        if (artistName) {
          let artistNameSubIndex = artistName.search('ft.');
          if (artistNameSubIndex !== -1) {
            artistName = artistName.substring(0, artistNameSubIndex);
          } else {
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
          // todo: extract this functionality into an external function & use with "(" and ")"
          songNameSubIndex = title.search('[[]');
          const songNameSubIndex2 = title.search('[\\]]');
          if (songNameSubIndex !== -1 && songNameSubIndex2 !== -1 && songNameSubIndex < songNameSubIndex2) {
            searchTerm = `${title.substring(0, songNameSubIndex)}${title.substring(songNameSubIndex2 + 1)}`;
            if (!searchTerm.trim().length) searchTerm = title;
          } else {
            searchTerm = title;
          }
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
          searchTermRemix = (songName ? songName : searchTerm) + ' ' + remixArgs[wordIndex].replace('(', '') + ' remix';
        }
      }
    } else {
      return channel.send('*lyrics command not supported for this stream type*');
    }
    if (
      searchTermRemix
        ? !(await sendSongLyrics(sentMsg, searchTermRemix, messageMemberId, reactionCallback)) &&
          !(await sendSongLyrics(sentMsg, searchTermRemix.replace(' remix', ''), messageMemberId, reactionCallback)) &&
          !(await sendSongLyrics(sentMsg, searchTerm, messageMemberId, reactionCallback))
        : !(await sendSongLyrics(sentMsg, searchTerm, messageMemberId, reactionCallback))
    ) {
      if (!args[0] && !lUrl.toLowerCase().includes('spotify')) {
        if (!(await getYoutubeSubtitles(sentMsg, lUrl, infos, reactionCallback))) {
          if (searchTerm.toLowerCase().includes('lyrics')) {
            const newSearchArr = searchTerm.toLowerCase().split(' ');
            const newSearchIndex = newSearchArr.findIndex((value: string) => value.includes('lyrics'));
            const newSearchTerm = searchTerm.split(' ').splice(newSearchIndex, 1);
            if (newSearchIndex !== -1) {
              if (await sendSongLyrics(sentMsg, newSearchTerm, messageMemberId, reactionCallback)) {
                return;
              }
            }
          }
          sentMsg.edit('no results found');
        }
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
 * @returns {Promise<Boolean>} The status of if the song lyrics were found and sent. True if successful.
 */
async function sendSongLyrics(
  message: Message,
  searchTerm: string,
  messageMemberId: string,
  reactionCallback: any
): Promise<boolean> {
  let firstSong: Song;
  try {
    firstSong = (await GeniusClient.songs.search(searchTerm))[0];
  } catch (e) {
    // GeniusClient.songs.search throws an error if the song is not found
    return false;
  }
  await message.edit('***Lyrics for ' + firstSong.title + '***\n<' + firstSong.url + '>').then(async (sentMsg) => {
    await sentMsg.react(reactions.PAGE);
    const filter = (reaction: MessageReaction, user: User) => {
      return user.id !== botID && [reactions.PAGE].includes(reaction.emoji.name!);
    };
    let lyrics: string | undefined;
    const collector = sentMsg.createReactionCollector({ filter, time: 300000 });
    let pageIsShowing = false;
    collector.on('collect', async () => {
      if (pageIsShowing) return;
      if (!lyrics) {
        try {
          lyrics = await firstSong.lyrics();
        } catch (e) {
          collector.stop();
          message.channel.send('*could not retrieve lyrics*');
          return;
        }
      }
      pageIsShowing = true;
      // send the lyrics text on reaction click
      const sentLyricsMsg = await new EmbedBuilderLocal()
        .setDescription(lyrics.length > 1910 ? lyrics.substring(0, 1910) + '...' : lyrics)
        .send(message.channel);
      reactionCallback();
      // start reactionCollector for lyrics
      sentLyricsMsg.react(reactions.X).then();
      const lyricsFilter = (reaction: any, user: any) => {
        return user.id === messageMemberId && [reactions.X].includes(reaction.emoji.name);
      };
      const lyricsCollector = sentLyricsMsg.createReactionCollector({
        filter: lyricsFilter,
        time: 300000,
        dispose: true
      });
      lyricsCollector.once('collect', () => {
        if (sentLyricsMsg.deletable) sentLyricsMsg.delete();
        lyricsCollector.stop();
        pageIsShowing = false;
      });
      lyricsCollector.once('end', () => {
        if (sentLyricsMsg.deletable) sentLyricsMsg.reactions?.removeAll();
      });
    });
  });
  return true;
}

/**
 * Gets the captions/subtitles from YouTube using ytdl-core and then sends the captions to the
 * respective text channel.
 * @param message The message that triggered the bot.
 * @param url The video url to get the subtitles.
 * @param infos The ytdl infos.
 * @param reactionCallback Callback for when the full text is sent.
 * @returns {Promise<boolean>} Whether the call was successful.
 */
function getYoutubeSubtitles(message: Message, url: string, infos: any, reactionCallback: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const playerResp = infos.player_response;
      const tracks = playerResp.captions.playerCaptionsTracklistRenderer.captionTracks;
      let data = '';
      https.get(tracks[0].baseUrl.toString(), function (res: any) {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          res.on('data', function (data_: { toString: () => string }) {
            data += data_.toString();
          });
          res.on('end', function () {
            parser.parseString(data, function (err: any, result: { transcript: { text: any } }) {
              if (err) {
                console.log('ERROR in getYouTubeSubtitles', err);
                resolve(false);
              } else {
                let finalString = '';
                let prevDuration = 0;
                let newDuration;
                for (const i of result.transcript.text) {
                  if (!i._) continue;
                  if (i._.trim().substring(0, 1) === '[') {
                    finalString += (finalString.substr(finalString.length - 1, 1) === ']' ? ' ' : '\n') + i._;
                    prevDuration -= 5;
                  } else {
                    newDuration = parseInt(i.$.start);
                    finalString += (newDuration - prevDuration > 9 ? '\n' : ' ') + i._;
                    prevDuration = newDuration;
                  }
                }
                finalString = finalString.replace(/&#39;/g, "'").trim();
                finalString = finalString.length > 1910 ? finalString.substring(0, 1910) + '...' : finalString;
                message.edit('Could not find lyrics. Video captions are available.').then((sentMsg: Message) => {
                  const mb = '📄';
                  sentMsg.react(mb).then();

                  const filter = (reaction: MessageReaction, user: User) => {
                    return user.id !== botID && [mb].includes(reaction.emoji.name!);
                  };

                  const collector = sentMsg.createReactionCollector({ filter, time: 600000 });

                  collector.once('collect', () => {
                    message.edit(`***Captions from YouTube***\n${finalString}`);
                    if (reactionCallback) reactionCallback();
                  });
                });
              }
            });
          });
        }
      });
      resolve(true);
    } catch (e) {
      message.edit('no results found');
      resolve(false);
    }
  });
}

export { runLyricsCommand };
