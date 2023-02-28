import LocalServer from './LocalServer';
import { startupDevMode } from './constants';
import { formatDuration } from '../formatUtils';
import { MessageCreateOptions, TextBasedChannel } from 'discord.js';
import { logErrorCore } from '../errorUtils';

// process related statistics
class ProcessStats {
  // total time active in MS
  activeMS = 0;
  // if active, the current Date.now()
  dateActive: any;
  // total streaming time
  totalStreamTime = 0;
  // map of active streams [guildId , Date.now()]
  activeStreamsMap = new Map();
  // if in developer mode
  devMode = false;
  // if the process is sidelined
  isInactive;
  // A message for users on first VC join
  startUpMessage = '';
  // list of server playback metadata
  servers = new Map<string, LocalServer>();
  // the interval to view the active process
  checkActiveInterval: any;
  // is null | XDB of the server prefixes. (see database/api for XDB reference)
  serverPrefixes: any;
  // a logging function for debugging
  debugFunc: any;
  isPendingStatus: boolean;

  // may run multiple times, once per thread
  constructor() {
    if (startupDevMode) {
      this.setDevMode(true);
      this.isInactive = false;
    } else {
      this.setDevMode(false);
      this.isInactive = true;
    }
    this.isPendingStatus = false;
  }

  // adds an active stream
  addActiveStream(gid: string) {
    this.activeStreamsMap.set(gid, Date.now());
  }

  // remove an active stream
  removeActiveStream(gid: string) {
    const streamStart = this.activeStreamsMap.get(gid);
    if (streamStart) {
      this.totalStreamTime += Date.now() - streamStart;
      this.activeStreamsMap.delete(gid);
    }
  }

  addActiveStreamIfNoneExists(gid: string) {
    if (!this.activeStreamsMap.has(gid)) {
      this.addActiveStream(gid);
    }
  }

  getActiveStreamSize() {
    return this.activeStreamsMap.size;
  }

  /**
   * Gets the total stream time in milliseconds
   * @returns {number}
   */
  getTotalStreamTime() {
    let activeTimes = 0;
    this.activeStreamsMap.forEach((val) => {
      activeTimes += Date.now() - val;
    });
    return this.totalStreamTime + activeTimes;
  }

  /**
   * Sets the process as inactive.
   * This does NOT activate 'checkToSeeActive' interval, which ensures that an active process is up.
   */
  setProcessInactive() {
    this.serverPrefixes = null;
    this.isInactive = true;
    console.log('-sidelined-');
    if (this.dateActive) {
      this.activeMS += Date.now() - this.dateActive;
      this.dateActive = null;
    }
  }

  /**
   * Sets the status of devMode.
   * @param status {boolean} Whether to set devMode on or off.
   */
  setDevMode(status: boolean) {
    this.devMode = status;
    if (status) {
      this.debugFunc = (...args: any) => {
        console.log(...args);
      };
    } else {
      this.debugFunc = () => {};
    }
    console.log(`-devMode ${status ? 'on' : 'off'}-`);
  }

  /**
   * A controlled console.log that is used for debugging. Only logs when in devMode (not in production).
   * @param args {...any} Arguments to log.
   */
  debug(...args: any) {
    this.debugFunc(...args);
  }

  /**
   * This method SHOULD be used instead of connection.disconnect. It will properly clean up the dispatcher and
   * the player.
   * @param server {LocalServer} The server metadata.
   */
  disconnectConnection(server: LocalServer) {
    server.audio.reset();
    this.removeActiveStream(server.guildId);
  }

  /**
   * Sets the process as active.
   */
  setProcessActive() {
    this.servers.clear();
    this.isInactive = false;
    console.log('-active-');
    this.dateActive = Date.now();
  }

  /**
   * Retrieves the server for the provided guid id. Creates a new server if one does not exist.
   * @param guildId {string} The guild id.
   * @returns {LocalServer} The LocalServer object for the guild.
   */
  getServer(guildId: string): LocalServer {
    let localServer = this.servers.get(guildId);
    if (!localServer) {
      localServer = new LocalServer(guildId);
      this.servers.set(guildId, localServer);
    }
    return localServer;
  }

  /**
   * Get the amount of time that this process has been active as a formatted string.
   * @returns {string}
   */
  getTimeActive(): string {
    if (this.dateActive) {
      return formatDuration(this.activeMS + Date.now() - this.dateActive);
    } else {
      return formatDuration(this.activeMS);
    }
  }

  /**
   * Logs an error depending on the devMode status.
   * @param errText The error object or message to send.
   */
  logError(errText: string | MessageCreateOptions | Error) {
    if (this.devMode) {
      this.debug(errText);
    } else {
      logErrorCore(errText);
    }
  }

  /**
   * Handles the error upon voice channel join. Sends the appropriate message to the user.
   * @param error The error.
   * @param textChannel The text channel to notify.
   */
  catchVCJoinError(error: Error, textChannel: TextBasedChannel) {
    const eMsg = error.toString();
    if (eMsg.includes('it is full')) {
      textChannel.send('`error: cannot join voice channel; it is full`');
    } else if (eMsg.includes('VOICE_JOIN_CHANNEL')) {
      textChannel.send('`permissions error: cannot join voice channel`');
    } else {
      textChannel.send('error when joining your VC:\n`' + error.message + '`');
      this.logError(`voice channel join error:\n\`${error.message}\``);
    }
  }
}

const processStats = new ProcessStats();

export default processStats;
