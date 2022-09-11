const {addCustomPlaylist, runAddCommandWrapper_P} = require('./add');
const {changePrefix} = require('./changePrefix');
const {playPlaylistDB, runDatabasePlayCommand} = require('./databasePlayCommand');
const {runHelpCommand} = require('./help');
const {runInsertCommand} = require('./insert');
const {joinVoiceChannelSafe} = require('./join');
const {getJoke} = require('./joke');
const {runKeysCommand} = require('./keys');
const {parent_thread} = require('../threads/parent_thread');
const {runMoveItemCommand, moveKeysWrapper} = require('./move');
const {runWhatsPCommand} = require('./now-playing');
const {pauseCommandUtil, playCommandUtil, stopPlayingUtil} = require('./stream/utils');
const {playFromWord} = require('./playFromWord');
const {runPurgeCommand} = require('./purge');
const {runRemoveCommand, removePlaylist} = require('./remove');
const {runUniversalSearchCommand} = require('./search');
const {runRestartCommand} = require('./restart');
const {renameKey, renamePlaylist} = require('./rename');
const {runRandomToQueue} = require('./runRandomToQueue');
const {runPlayLinkCommand} = require('./playLink');
const {ZWSP} = require('../utils/lib/constants');


// A common handler for user commands.
class CommandHandlerCommon {
  /**
   * Adds a custom playlist to the database.
   * @param {*} server The server.
   * @param {*} channel The channel to send the response to.
   * @param {*} sheetName The name of the sheet to add to.
   * @param {*} playlistName The name of the playlist to add.
   * @returns {void}
   */
  async addCustomPlaylist(server, channel, sheetName, playlistName) {
    await addCustomPlaylist(server, channel, sheetName, playlistName);
  }

  /**
   * Wrapper for the function 'addToDatabase', for the purpose of error checking.
   * Expects the provided playlist to exist.
   * @param channel The channel that triggered the bot
   * @param args {Array<string>} [playlist-name (optional), key-name, link (optional if in a session)]
   * @param sheetName The name of the sheet to add to
   * @param printMsgToChannel Whether to print a response to the channel
   * @param server The server.
   * @param member The member that is requesting the add.
   * @returns {*}
   */
  async addKeyToDB(channel, args, sheetName, printMsgToChannel, server, member) {
    return runAddCommandWrapper_P(channel, args, sheetName, printMsgToChannel, server, member);
  }

  /**
   * Runs the checks to add random songs to the queue
   * @param num The number of songs to be added to random, could be string
   * @param message The message that triggered the bot
   * @param sheetName The name of the sheet to reference
   * @param server The server playback metadata
   * @param addToFront Optional - true if to add to the front
   */
  async addRandomKeysToQueue(num, message, sheetName, server, addToFront) {
    return runRandomToQueue(num, message, sheetName, server, addToFront);
  }

  /**
   * Changes the server's prefix.
   * @param message The message content metadata
   * @param server The server playback metadata
   * @param oldPrefix The old prefix.
   * @param newPrefix The new prefix.
   * @returns {*}
   */
  changePrefix(message, server, oldPrefix, newPrefix) {
    return changePrefix(message, server, oldPrefix, newPrefix);
  }

  /**
   * Produces the help list and manages its reactions.
   * @param message The message instance.
   * @param server The server.
   * @param version {string} The version.
   * @returns {void}
   */
  help(message, server, version) {
    return runHelpCommand(message, server, version);
  }

  /**
   * Inserts a term into position into the queue. Accepts a valid link or key.
   * @param message The message metadata.
   * @param mgid The message guild id.
   * @param args {string[]} An array of string args to parse, can include multiple terms and a position.
   * @param server The server to use.
   * @param sheetName {string} The sheet name to use.
   * @returns {Promise<number>} The position to insert or a negative if failed.
   */
  async insert(message, mgid, args, server, sheetName) {
    return runInsertCommand(message, mgid, args, server, sheetName);
  }

  /**
   * Joins the voice channel of the message member (if applicable).
   * If there is an error upon join attempt then it caught and forwarded to the user.
   * @param message The message metadata.
   * @param server The server object.
   * @returns {Promise<boolean>} True upon successful voice channel join.
   */
  async joinVoiceChannelSafe(message, server) {
    return joinVoiceChannelSafe(message, server);
  }

  /**
   * Gets a random joke from the internet.
   * @param channel The text-channel to send the joke to.
   * @returns {Promise<void>}
   */
  async joke(channel) {
    const joke = await getJoke();
    channel.send(`${ZWSP}${joke}`);
  }

  /**
   * Grabs all the keys/names from the database.
   * @param message {any} The message trigger
   * @param server The server
   * @param sheetName {string} The name of the sheet to retrieve
   * @param user {any?} Optional - username, overrides the message owner's name
   * @param specificPage {string?} The name of the page to display (to show instead of the playlist-page).
   * @param overrideName {string?} overrides the name displayed for the keys list.
   */
  async keys(message, server, sheetName, user, specificPage, overrideName) {
    return runKeysCommand(message, server, sheetName, user, specificPage, overrideName);
  }

  /**
   * Gets the lyrics of what is playing and returns it in the text channel.
   * @param message The message object.
   * @param args The args with the message content
   * @param server The server object.
   * @returns {void}
   */
  lyrics(message, args, server) {
    parent_thread('lyrics', message.id, message.channel.id, [args, server.queue[0], message.member.id]);
  }

  /**
   * Moves an item in the queue from one position to another.
   * @param channel The channel object.
   * @param server The server object.
   * @param posFrom {int} The position of the item to move.
   * @param posTo {int} The new position of the item.
   * @returns {void}
   */
  moveItemInQueue(channel, server, posFrom, posTo) {
    return runMoveItemCommand(channel, server.queue, posFrom, posTo);
  }

  /**
   * Moves keys from one playlist to another.
   * @param server The server object.
   * @param channel The channel to send the message to.
   * @param sheetName The name of the sheet.
   * @param xdb The database object.
   * @param args A list of keys and single playlist (the playlist should be the one to move the keys into).
   * @returns {void}
   */
  moveKeysBetweenPlaylists(server, channel, sheetName, xdb, args) {
    return moveKeysWrapper(server, channel, sheetName, xdb, args);
  }

  /**
   * Runs the what's playing command. Can also look up database values if args[2] is present.
   * @param server The server metadata.
   * @param {*} message the message that activated the bot
   * @param {*} voiceChannel The active voice channel
   * @param keyName Optional - A key to search for to retrieve a link
   * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
   * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
   * (server or personal)
   */
  async nowPlaying(server, message, voiceChannel, keyName, sheetName, sheetLetter) {
    return runWhatsPCommand(server, message, voiceChannel, keyName, sheetName, sheetLetter);
  }

  /**
   * Pauses the now playing, if playing.
   * @param message The message content metadata
   * @param actionUser The member that is performing the action
   * @param server The server playback metadata
   * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
   * @param force Optional - Skips the voting system if DJ mode is on
   * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
   * @returns {boolean} if successful
   */
  pauseStream(message, actionUser, server, noErrorMsg, force, noPrintMsg) {
    return pauseCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
  }

  /**
   * Runs the commands and checks to play a link
   * @param message The message that triggered the bot
   * @param args An array of given play parameters, should be links or keywords
   * @param mgid The message guild id
   * @param server The server playback metadata
   * @param sheetName The name of the sheet to reference
   */
  async playLink(message, args, mgid, server, sheetName) {
    return runPlayLinkCommand(message, args, mgid, server, sheetName);
  }

  /**
   * Purges the queue of all items that contain the term.
   * @param message The message object.
   * @param server The server object.
   * @param term {string} The term to purge.
   * @return {Promise<void>}
   */
  async purgeWordFromQueue(message, server, term) {
    return runPurgeCommand(message, server, term);
  }

  /**
   * Removes an item from the queue. Does not allow for the currently playing item to be
   * removed from the queue (index 0).
   * @param message The message metadata.
   * @param server The server metadata.
   * @param itemPosition The position in the queue to remove from (starting from 1).
   * @returns {Promise<*>}
   */
  async removeFromQueue(message, server, itemPosition) {
    return runRemoveCommand(message, server, itemPosition);
  }

  /**
   * Removes a playlist. Returns false if playlist could not be found. Sends the response to the channel.
   * @param server The server metadata.
   * @param sheetName The sheetname to update.
   * @param playlistName The playlist to remove.
   * @param xdb The XDB.
   * @param channel The channel to send the response to.
   * @returns {Promise<boolean>}
   */
  async removeDBPlaylist(server, sheetName, playlistName, xdb, channel) {
    return removePlaylist(server, sheetName, playlistName, xdb, channel);
  }

  /**
   * Renames a key.
   * @param channel The channel to send the message to.
   * @param server  The server metadata.
   * @param sheetName The name of the sheet to rename the key in.
   * @param oldName The old name of the key.
   * @param newName The new name of the key.
   * @returns {Promise<boolean>} True if successful
   */
  async renameKey(channel, server, sheetName, oldName, newName) {
    return renameKey(channel, server, sheetName, oldName, newName);
  }

  /**
   * Renames a playlist.
   * @param channel The channel to send the message to.
   * @param server The server to rename the playlist in.
   * @param sheetName The name of the sheet to rename the playlist in.
   * @param oldName The old name of the playlist.
   * @param newName The new name of the playlist.
   * @returns {Promise<boolean>} True if successful
   */
  async renamePlaylist(channel, server, sheetName, oldName, newName) {
    return renamePlaylist(channel, server, sheetName, oldName, newName);
  }

  /**
   * Restarts the song playing and what was within an older session.
   * @param message The message that triggered the bot.
   * @param mgid The message guild id.
   * @param keyword Enum in string format, being either 'restart' or 'replay'.
   * @param server The server playback metadata.
   * @returns {*}
   */
  async restartPlaying(message, mgid, keyword, server) {
    return runRestartCommand(message, mgid, keyword, server);
  }

  /**
   * Plays the now playing if paused.
   * @param message The message content metadata
   * @param actionUser The member that is performing the action
   * @param server The server playback metadata
   * @param noErrorMsg {*?} Optional - If to avoid an error message if nothing is playing
   * @param force {*?} Optional - Skips the voting system if DJ mode is on
   * @param noPrintMsg {*?} Optional - Whether to print a message to the channel when not in DJ mode
   * @returns {boolean}
   */
  resumeStream(message, actionUser, server, noErrorMsg, force, noPrintMsg) {
    return playCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
  }

  /**
   * Plays an entire custom playlist.
   * @param args {Array<string>} The array of playlists to play.
   * @param message {import('Discord.js').Message} The message object.
   * @param sheetName {string} The name of the sheet to reference.
   * @param playRightNow {boolean} If the playlist should be played right now.
   * @param printErrorMsg {boolean} If an error message should be printed.
   * @param server {Server} The server metadata.
   * @param shuffle {boolean?}
   * @returns {Promise<void>}
   */
  async playDBPlaylist(args, message, sheetName, playRightNow, printErrorMsg, server, shuffle) {
    await playPlaylistDB(args, message, sheetName, playRightNow, printErrorMsg, server, shuffle);
  }

  /**
   * Executes play assuming that message args are intended for a database call.
   * @param {*} args the message split by spaces into an array
   * @param {*} message the message that triggered the bot
   * @param {*} sheetName the name of the sheet to reference
   * @param playRightNow bool of whether to play now or now
   * @param printErrorMsg prints error message, should be true unless attempting a followup db run
   * @param server The server playback metadata
   * @returns {Promise<boolean>} whether the play command has been handled accordingly
   */
  async playDBKeys(args, message, sheetName, playRightNow, printErrorMsg, server) {
    return runDatabasePlayCommand(args, message, sheetName, playRightNow, printErrorMsg, server);
  }

  /**
   * Determines what to play from a word, dependent on sheetName. The word is provided from args[1].
   * Uses the database if a sheetName is provided, else uses YouTube.
   * @param message The message metadata.
   * @param args The args pertaining the content.
   * @param sheetName Optional - The sheet to reference.
   * @param server The server data.
   * @param mgid The guild id.
   * @param playNow Whether to play now.
   */
  playFromWord(message, args, sheetName, server, mgid, playNow) {
    playFromWord(message, args, sheetName, server, mgid, playNow);
  }

  /**
   * A search command that searches both the server and personal database for the string.
   * @param message The message that triggered the bot.
   * @param server The server.
   * @param sheetName The guild id.
   * @param providedString The string to search for. Can contain multiple comma delineated strings.
   */
  async searchForKeyUniversal(message, server, sheetName, providedString) {
    return runUniversalSearchCommand(message, server, sheetName, providedString);
  }
  /**
   * Stops playing in the given voice channel and leaves. This is intended for when a user attempts to alter a session.
   * @param mgid The current guild id
   * @param voiceChannel The current voice channel
   * @param stayInVC Whether to stay in the voice channel
   * @param server The server playback metadata
   * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
   * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
   * @returns {void}
   */
  stopPlaying(mgid, voiceChannel, stayInVC, server, message, actionUser) {
    return stopPlayingUtil(mgid, voiceChannel, stayInVC, server, message, actionUser);
  }
}

module.exports = new CommandHandlerCommon();
