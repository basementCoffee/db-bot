import { addCustomPlaylist, runAddCommandWrapper_P } from './add';


// User Commands
class CommonCommandsHandler {
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

  changePrefix(message, server, oldPrefix, newPrefix) {

  }
}