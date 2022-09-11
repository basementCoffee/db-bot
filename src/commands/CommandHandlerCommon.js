import { addCustomPlaylist, runAddCommandWrapper_P } from './add';
import { changePrefix } from './changePrefix';
import { playPlaylistDB, runDatabasePlayCommand } from './databasePlayCommand';


// A common handler for user commands.
class CommandHandlerCommon {
  /**
   * Wrapper for the function 'addToDatabase', for the purpose of error checking. Expects the provided playlist to exist.
   * @param channel The channel that triggered the bot
   * @param args {Array<string>} [playlist-name (optional), key-name, link (optional if in a session)]
   * @param sheetName The name of the sheet to add to
   * @param printMsgToChannel Whether to print a response to the channel
   * @param server The server.
   * @param member The member that is requesting the add.
   * @returns {*}
   */
  async addKey (channel, args, sheetName, printMsgToChannel, server, member) {
    await runAddCommandWrapper_P(channel, args, sheetName, printMsgToChannel, server, member);
  }


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
   * Changes the server's prefix.
   * @param message The message content metadata
   * @param server The server playback metadata
   * @param oldPrefix The old prefix.
   * @param newPrefix The new prefix.
   * @returns {*}
   */
  changePrefix(message, server, oldPrefix, newPrefix) {
    changePrefix(message, server, oldPrefix, newPrefix)
  }

  /**
   * Plays an entire custom playlist.
   * @param args {Array<string>} The array of playlists to play.
   * @param message {Message} The message object.
   * @param sheetName {string} The name of the sheet to reference.
   * @param playRightNow {boolean} If the playlist should be played right now.
   * @param printErrorMsg {boolean} If an error message should be printed.
   * @param server {Server} The server metadata.
   * @param shuffle {boolean?}
   * @returns {Promise<void>}
   */
  async playDBPlaylist(args, message, sheetName, playRightNow, printErrorMsg, server, shuffle){
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
    await runDatabasePlayCommand(args, message, sheetName, playRightNow, printErrorMsg, server);
  }
}

module.exports = new CommandHandlerCommon();