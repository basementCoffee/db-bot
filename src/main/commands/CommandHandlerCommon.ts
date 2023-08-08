import { parentThread } from '../threads/parentThread';
import LocalServer from '../utils/lib/LocalServer';
import { BaseGuildTextChannel, GuildMember, Message, VoiceBasedChannel } from 'discord.js';
import { addCustomPlaylist, runAddCommandWrapper } from './add';
import { changePrefix } from './changePrefix';
import { playPlaylistDB, runDatabasePlayCommand } from './databasePlayCommand';
import { runHelpCommand } from './help';
import { runInsertCommand } from './insert';
import { joinVoiceChannelSafe } from './join';
import { getJoke } from './joke';
import { runKeysCommand } from './keys';
import { moveKeysWrapper, runMoveItemCommand } from './move';
import { runWhatsPCommand } from './now-playing';
import { pauseCommandUtil, playCommandUtil, stopPlayingUtil } from './stream/utils';
import { runPurgeCommand } from './purge';
import { removePlaylist, runRemoveCommand } from './remove';
import { runUniversalSearchCommand } from './search';
import { runRestartCommand } from './restart';
import { renameKey, renamePlaylist } from './rename';
import { playLinkNow, runPlayLinkCommand } from './playLink';
import { ZWSP } from '../utils/lib/constants';
import { runSeekCommand } from './seek';
import { runRandomToQueue } from './playRandomKeys';
import { getSettings, setSettings } from '../database/retrieval';
import { removeFormattingLink } from '../utils/formatUtils';
import { queueFind } from './queueFind';
import { shuffleQueueCommand } from './shuffle';

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
  static async addCustomPlaylist(server: LocalServer, channel: any, sheetName: any, playlistName: any) {
    await addCustomPlaylist(server, channel, sheetName, playlistName);
  }

  /**
   * Wrapper for the function 'addToDatabase', for the purpose of error checking.
   * Expects the provided playlist to exist.
   * @param channel The channel that triggered the bot
   * @param args {Array<string>} [playlist-name (optional), key-name, link (optional if in a session)]
   * @param sheetName The name of the sheet to add to
   * @param printMsgToChannel Whether to print a response to the channel
   * @param server {LocalServer} The server.
   * @param member The member that is requesting the add.
   * @returns {*}
   */
  static async addKeyToDB(
    channel: any,
    args: any,
    sheetName: string,
    printMsgToChannel: any,
    server: LocalServer,
    member: any
  ) {
    return runAddCommandWrapper(channel, args, sheetName, printMsgToChannel, server, member);
  }

  /**
   * Runs the checks to add random songs to the queue
   * @param num {Array<string>} The arguments of what to play: can be a number, keys, or a playlist-name with a number
   * @param message The message that triggered the bot
   * @param sheetName The name of the sheet to reference
   * @param server {LocalServer} The server playback metadata
   * @param addToFront Optional - true if to add to the front
   * @param isShuffle Whether it is a shuffle cmd.
   */
  static async addRandomKeysToQueue(
    num: Array<string>,
    message: Message,
    sheetName: string,
    server: LocalServer,
    addToFront = false,
    isShuffle = false
  ) {
    return runRandomToQueue(num, message, sheetName, server, addToFront, isShuffle);
  }

  /**
   * Changes the server's prefix.
   * @param message The message content metadata
   * @param server {LocalServer} The server playback metadata
   * @param oldPrefix The old prefix.
   * @param newPrefix The new prefix.
   * @returns {*}
   */
  static changePrefix(message: Message, server: LocalServer, oldPrefix: string, newPrefix: string) {
    return changePrefix(message, server, oldPrefix, newPrefix);
  }

  /**
   * Produces the help list and manages its reactions.
   * @param message The message instance.
   * @param server {LocalServer} The server.
   * @param version {string} The version.
   * @returns {void}
   */
  static help(message: Message, server: LocalServer, version: string): void {
    return runHelpCommand(message, server, version);
  }

  /**
   * Inserts a term into position into the queue. Accepts a valid link or key.
   * @param message The message metadata.
   * @param mgid The message guild id.
   * @param args {string[]} An array of string args to parse, can include multiple terms and a position.
   * @param server {LocalServer} The server to use.
   * @param sheetName {string} The sheet name to use.
   * @returns {Promise<number>} The position to insert or a negative if failed.
   */
  static async insert(
    message: Message,
    mgid: string,
    args: string[],
    server: LocalServer,
    sheetName: string
  ): Promise<number> {
    return runInsertCommand(message, mgid, args, server, sheetName);
  }

  /**
   * Joins the voice channel of the message member (if applicable).
   * If there is an error upon join attempt then it caught and forwarded to the user.
   * @param message The message metadata.
   * @param server {LocalServer} The server object.
   * @returns {Promise<boolean>} True upon successful voice channel join.
   */
  static async joinVoiceChannelSafe(message: Message, server: LocalServer): Promise<boolean> {
    return joinVoiceChannelSafe(message, server);
  }

  /**
   * Gets a random joke from the internet.
   * @param channel The text-channel to send the joke to.
   * @returns {Promise<void>}
   */
  static async joke(channel: any): Promise<void> {
    const joke = await getJoke();
    channel.send(`${ZWSP}${joke}`);
  }

  /**
   * Grabs all the keys/names from the database.
   * @param message {any} The message trigger
   * @param server {LocalServer} The server
   * @param sheetName {string} The name of the sheet to retrieve
   * @param user {any?} Optional - username, overrides the message owner's name
   * @param specificPage {string?} The name of the page to display (to show instead of the playlist-page).
   * @param overrideName {string?} overrides the name displayed for the keys list.
   */
  static async keys(
    message: Message,
    server: LocalServer,
    sheetName: string,
    user?: any,
    specificPage?: string,
    overrideName?: string
  ) {
    return runKeysCommand(message, server, sheetName, user, specificPage, overrideName);
  }

  /**
   * Gets the lyrics of what is playing and returns it in the text channel.
   * @param channelId {string} The channel id.
   * @param memberId {string} The member id.
   * @param args The args with the message content.
   * @param queueItem {any} The queueItem object of the link to get the lyrics of.
   * @returns {void}
   */
  static lyrics(channelId: string, memberId: string, args: string[], queueItem: any): void {
    parentThread('lyrics', { channelId }, [args, queueItem, memberId]);
  }

  /**
   * Moves an item in the queue from one position to another.
   * @param channel The channel object.
   * @param server {LocalServer} The server object.
   * @param posFrom {int} The position of the item to move.
   * @param posTo {int} The new position of the item.
   * @returns {void}
   */
  static moveItemInQueue(channel: any, server: LocalServer, posFrom: number | string, posTo: number | string) {
    return runMoveItemCommand(channel, server.queue, posFrom, posTo);
  }

  /**
   * Moves keys from one playlist to another.
   * @param server {LocalServer} The server object.
   * @param channel The channel to send the message to.
   * @param sheetName The name of the sheet.
   * @param xdb The database object.
   * @param args A list of keys and single playlist (the playlist should be the one to move the keys into).
   * @returns {void}
   */
  static moveKeysBetweenPlaylists(
    server: LocalServer,
    channel: BaseGuildTextChannel,
    sheetName: string,
    xdb: any,
    args: string[]
  ) {
    return moveKeysWrapper(server, channel, sheetName, xdb, args);
  }

  /**
   * Runs the what's playing command. Can also look up database values if args[2] is present.
   * @param server {LocalServer} The server metadata.
   * @param {*} message the message that activated the bot
   * @param {*} voiceChannel The active voice channel
   * @param keyName Optional - A key to search for to retrieve a link
   * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
   * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
   * (server or personal)
   */
  static async nowPlaying(
    server: LocalServer,
    message: Message,
    voiceChannel: any,
    keyName?: string,
    sheetName?: string,
    sheetLetter?: string
  ) {
    return runWhatsPCommand(server, message, voiceChannel, keyName, sheetName, sheetLetter);
  }

  /**
   * Pauses the now playing, if playing.
   * @param message The message content metadata
   * @param actionUser The member that is performing the action
   * @param server {LocalServer} The server playback metadata
   * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
   * @param force Optional - Skips the voting system if DJ mode is on
   * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
   * @returns {boolean} if successful
   */
  static pauseStream(
    message: Message,
    actionUser: GuildMember,
    server: LocalServer,
    noErrorMsg = false,
    force = false,
    noPrintMsg = false
  ) {
    return pauseCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
  }

  /**
   * Runs the commands and checks to play a link
   * @param message The message that triggered the bot
   * @param args An array of given play parameters, should be links or keywords
   * @param mgid The message guild id
   * @param server {LocalServer} The server playback metadata
   * @param sheetName The name of the sheet to reference
   */
  static async playLink(message: Message, args: string[], mgid: string, server: LocalServer, sheetName = '') {
    return runPlayLinkCommand(message, args, mgid, server, sheetName);
  }

  /**
   * Runs the play now command.
   * @param message the message that triggered the bot
   * @param args the message split into an array (ignores the first argument)
   * @param mgid the message guild id
   * @param server {LocalServer} The server playback metadata
   * @param sheetName the name of the sheet to reference
   * @param seekSec {number?} Optional - The amount of time to seek in seconds
   * @param adjustQueue {boolean?} Whether to adjust the queue (is true by default).
   */
  static async playLinkNow(
    message: Message,
    args: string[],
    mgid: string,
    server: LocalServer,
    sheetName?: string,
    seekSec?: any,
    adjustQueue?: any
  ) {
    return playLinkNow(message, args, mgid, server, sheetName, seekSec, adjustQueue);
  }

  /**
   * Purges the queue of all items that contain the term.
   * @param message The message object.
   * @param server {LocalServer} The server object.
   * @param term {string} The term to purge.
   * @return {Promise<void>}
   */
  static async purgeWordFromQueue(message: Message, server: LocalServer, term: string) {
    return runPurgeCommand(message, server, term);
  }

  /**
   * Removes an item from the queue. Does not allow for the currently playing item to be
   * removed from the queue (index 0).
   * @param message The message metadata.
   * @param server {LocalServer} The server metadata.
   * @param itemPosition The position in the queue to remove from (starting from 1).
   * @returns {Promise<*>}
   */
  static async removeFromQueue(message: Message, server: LocalServer, itemPosition: string) {
    return runRemoveCommand(message, server, itemPosition);
  }

  /**
   * Removes a playlist. Returns false if playlist could not be found. Sends the response to the channel.
   * @param server {LocalServer} The server metadata.
   * @param sheetName The sheetname to update.
   * @param playlistName The playlist to remove.
   * @param xdb The XDB.
   * @param channel The channel to send the response to.
   * @returns {Promise<boolean>}
   */
  static async removeDBPlaylist(
    server: LocalServer,
    sheetName: string,
    playlistName: string,
    xdb: any,
    channel: BaseGuildTextChannel
  ) {
    return removePlaylist(server, sheetName, playlistName, xdb, channel);
  }

  /**
   * Renames a key.
   * @param channel The channel to send the message to.
   * @param server {LocalServer}  The server metadata.
   * @param sheetName The name of the sheet to rename the key in.
   * @param oldName The old name of the key.
   * @param newName The new name of the key.
   * @returns {Promise<boolean>} True if successful
   */
  static async renameKey(
    channel: BaseGuildTextChannel,
    server: LocalServer,
    sheetName: string,
    oldName: string,
    newName: string
  ): Promise<boolean> {
    return renameKey(channel, server, sheetName, oldName, newName);
  }

  /**
   * Renames a playlist.
   * @param channel The channel to send the message to.
   * @param server {LocalServer} The server to rename the playlist in.
   * @param sheetName The name of the sheet to rename the playlist in.
   * @param oldName The old name of the playlist.
   * @param newName The new name of the playlist.
   * @returns {Promise<boolean>} True if successful
   */
  static async renamePlaylist(
    channel: BaseGuildTextChannel,
    server: LocalServer,
    sheetName: string,
    oldName: string,
    newName: string
  ) {
    return renamePlaylist(channel, server, sheetName, oldName, newName);
  }

  /**
   * Restarts the song playing and what was within an older session.
   * @param message The message that triggered the bot.
   * @param mgid The message guild id.
   * @param keyword Enum in string format, being either 'restart' or 'replay'.
   * @param server {LocalServer} The server playback metadata.
   * @returns {*}
   */
  static async restartPlaying(message: Message, mgid: string, keyword: string, server: LocalServer) {
    return runRestartCommand(message, mgid, keyword, server);
  }

  /**
   * Plays the now playing if paused.
   * @param message The message content metadata
   * @param actionUser The member that is performing the action
   * @param server {LocalServer} The server playback metadata
   * @param noErrorMsg {*?} Optional - If to avoid an error message if nothing is playing
   * @param force {*?} Optional - Skips the voting system if DJ mode is on
   * @param noPrintMsg {*?} Optional - Whether to print a message to the channel when not in DJ mode
   * @returns {boolean}
   */
  static resumeStream(
    message: Message,
    actionUser: GuildMember,
    server: LocalServer,
    noErrorMsg = false,
    force = false,
    noPrintMsg = false
  ) {
    return playCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
  }

  /**
   * Plays an entire custom playlist.
   * @param args {Array<string>} The array of playlists to play.
   * @param message {import('Discord.js').Message} The message object.
   * @param sheetName {string} The name of the sheet to reference.
   * @param playRightNow {boolean} If the playlist should be played right now.
   * @param printErrorMsg {boolean} If an error message should be printed.
   * @param server {LocalServer} The server metadata.
   * @param shuffle {boolean?}
   * @returns {Promise<void>}
   */
  static async playDBPlaylist(
    args: string[],
    message: Message,
    sheetName: string,
    playRightNow: boolean,
    printErrorMsg: boolean,
    server: LocalServer,
    shuffle?: boolean
  ) {
    await playPlaylistDB(args, message, sheetName, playRightNow, printErrorMsg, server, shuffle);
  }

  /**
   * Executes play assuming that message args are intended for a database call.
   * @param {*} args the message split by spaces into an array
   * @param {*} message the message that triggered the bot
   * @param {*} sheetName the name of the sheet to reference
   * @param playRightNow bool of whether to play now or now
   * @param printErrorMsg prints error message, should be true unless attempting a followup db run
   * @param server {LocalServer} The server playback metadata
   * @returns {Promise<boolean>} whether the play command has been handled accordingly
   */
  static async playDBKeys(
    args: string[],
    message: Message,
    sheetName: string,
    playRightNow: boolean,
    printErrorMsg: boolean,
    server: LocalServer
  ) {
    return runDatabasePlayCommand(args, message, sheetName, playRightNow, printErrorMsg, server);
  }

  static async playWithSeek(message: Message, server: LocalServer, args: string[], mgid: string) {
    return runSeekCommand(message, server, args, mgid);
  }

  /**
   * Find a title within the queue.
   * @param message The message object.
   * @param server {LocalServer} The server object.
   * @param term {string} The term to purge.
   * @return {Promise<void>}
   */
  static async queueFind(message: Message, server: LocalServer, term: string) {
    return queueFind(message, server, term);
  }

  /**
   * A search command that searches both the server and personal database for the string.
   * @param message The message that triggered the bot.
   * @param server {LocalServer} The server.
   * @param sheetName The guild id.
   * @param providedString The string to search for. Can contain multiple comma delineated strings.
   */
  static async searchForKeyUniversal(message: Message, server: LocalServer, sheetName: string, providedString: string) {
    return runUniversalSearchCommand(message, server, sheetName, providedString);
  }

  /**
   * Sets a splash-screen for a specific keys homepage.
   * @param server {LocalServer} The LocalServer object.
   * @param channel The text-channel to send updates to.
   * @param sheetName {string} The sheetName to reference.
   * @param url {string} The image to set as a splash-screen.
   * @returns {Promise<void>}
   */
  static async setSplashscreen(server: LocalServer, channel: BaseGuildTextChannel, sheetName: string, url: string) {
    if (!url || !url.includes('.')) {
      channel.send(`*provide an icon URL to set a splash screen for your playlists \`${server.prefix} [url]\`*`);
      return;
    }
    url = removeFormattingLink(url.trim());
    if (url.substring(url.length - 5) === '.gifv') {
      url = url.substring(0, url.length - 1);
    }
    const userSettings = await getSettings(server, sheetName);
    userSettings.splash = url;
    await setSettings(server, sheetName, userSettings);
    channel.send('*splashscreen set*');
  }

  /**
   * Shuffles the queue.
   * @param server {LocalServer} The server playback metadata
   * @param message The message metadata.
   */
  static shuffleQueue(server: LocalServer, message: Message) {
    shuffleQueueCommand(server, message);
  }

  /**
   * Shuffles the queue if no argument provided, otherwise shuffles a random playlist key or number of keys.
   * @param wildcardRandomArr {Array<string>} An array containing a number, keys, or a playlist with a number
   * @param message The message metadata.
   * @param sheetName The sheet name to use for db retrieval
   * @param server {LocalServer} The server playback metadata
   * @param addToFront {boolean} Whether to add to the front of the queue.
   * @param isShuffle {boolean} Whether to shuffle the new keys before adding them to the queue.
   */
  static shuffleQueueOrPlayRandom(
    wildcardRandomArr: any[] = [],
    message: Message,
    sheetName: string,
    server: LocalServer,
    addToFront?: boolean,
    isShuffle?: boolean
  ) {
    wildcardRandomArr = wildcardRandomArr.filter((x) => x);
    if (wildcardRandomArr.length < 1) {
      this.shuffleQueue(server, message);
    } else {
      this.addRandomKeysToQueue(wildcardRandomArr, message, sheetName, server, addToFront, isShuffle).then();
    }
  }

  /**
   * Stops playing in the given voice channel and leaves. This is intended for when a user attempts to alter a session.
   * @param mgid The current guild id
   * @param voiceChannel The current voice channel
   * @param stayInVC Whether to stay in the voice channel
   * @param server {LocalServer} The server playback metadata
   * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
   * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
   * @returns {void}
   */
  static stopPlaying(
    mgid: string,
    voiceChannel: VoiceBasedChannel | null | undefined,
    stayInVC: boolean,
    server: LocalServer,
    message: Message,
    actionUser: any
  ) {
    return stopPlayingUtil(mgid, voiceChannel, stayInVC, server, message, actionUser);
  }
}

export default CommandHandlerCommon;
