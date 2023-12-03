import AudioImpl from "./AudioImpl";
import { GuildMember, Message } from "discord.js";
import { QueueItem } from "./types";

type StreamData = {
  // the StreamType enum
  type: string | undefined;
  // the readable stream
  stream: any;
  // urlAlt is added if it's a YT stream
  urlAlt: string | undefined;
  // the specific stream source for YT streams (fluent, ytdl-core-discord, play-dl)
  ytPlayer: string | undefined;
};

class LocalServer {
  guildId: string;
  // now playing is the first element
  queue: Array<QueueItem>;
  // newest items are pushed
  queueHistory: Array<QueueItem>;
  /*
    a log of completed links and their metadata
    Map<url, {queueItem, numOfPlays: number}>
     */
  mapFinishedLinks;
  // continue playing after queue end
  autoplay;
  // boolean status of looping
  loop;
  // the number of items sent since embed generation
  numSinceLastEmbed;
  // the embed message
  currentEmbed: Message | undefined;
  // the collector for the current embed message
  collector: any;
  // the playback status message
  followUpMessage: Message | undefined;
  // the id of the channel for now-playing embeds
  currentEmbedChannelId: string | undefined;
  // boolean status of verbose mode - save embeds on true
  verbose: boolean;
  // A list of vote admins (members) in a server
  voteAdmin: any;
  // the ids of members who voted to skip
  voteSkipMembersId: Array<string>;
  // the ids of members who voted to rewind
  voteRewindMembersId: Array<string>;
  // the ids of members who voted to play/pause the link
  votePlayPauseMembersId: Array<string>;
  // locks the queue for dj mode
  lockQueue: boolean;
  // The member that is the acting dictator
  dictator: GuildMember | undefined;
  // the last startup message sent to the user
  startUpMessage: string;
  // the timeout IDs for the bot to leave a VC
  leaveVCTimeout: any;
  // the number of consecutive playback errors
  skipTimes;
  // a map of user ids to an active query message [id => Message]
  activeUserQuestion;
  // persistent user settings
  userSettings;
  // the specific server's audio class
  audio: AudioImpl;
  // properties pertaining to the active stream
  streamData: StreamData;
  // if a twitch notification was sent
  twitchNotif = {
    isSent: false,
    isTimer: false
  };
  // hold a ready-to-go function in case of vc join
  seamless: {
    function: ([]) => any;
    args: Array<Object> | undefined;
    message: Message | undefined;
    timeout: any;
  } = {
    // the name of the type of function
    function: () => {
    },
    // args for the function
    args: undefined,
    // optional message to delete
    message: undefined,
    // timeout before clearing this object
    timeout: undefined
  };
  // [id, xdb]
  // use getXdb2() for user data
  userKeys;
  // the server's prefix
  prefix: string | undefined;
  // the timeout for the YT search results
  searchReactionTimeout: any;
  // the timer for the active DJ
  djTimer: {
    timer: any;
    startTime: any;
    duration: number;
  };
  // the last time a DJ tip was sent to a group
  djMessageDate;
  // error manager - keep track of errors
  errors: {
    // if a reaction permissions error occurred
    permissionReaction: boolean;
    continuousStreamErrors: number;
  };
  // whether to display the embed
  silence;

  /**
   * Constructor for LocalServer.
   * @param guildId {string} The id of the server.
   */
  constructor(guildId: string) {
    this.guildId = guildId;
    this.queue = [];
    this.queueHistory = [];
    this.mapFinishedLinks = new Map();
    this.autoplay = false;
    this.loop = false;
    this.numSinceLastEmbed = 0;
    this.currentEmbed = undefined;
    this.collector = undefined;
    this.followUpMessage = undefined;
    this.currentEmbedChannelId = undefined;
    this.verbose = false;
    this.voteAdmin = [];
    this.voteSkipMembersId = [];
    this.voteRewindMembersId = [];
    this.votePlayPauseMembersId = [];
    this.lockQueue = false;
    this.dictator = undefined;
    this.startUpMessage = "";
    this.leaveVCTimeout = undefined;
    this.skipTimes = 0;
    this.activeUserQuestion = new Map();
    this.userSettings = new Map();
    this.audio = new AudioImpl();
    this.streamData = {
      type: undefined,
      stream: undefined,
      urlAlt: undefined,
      ytPlayer: undefined
    };
    this.twitchNotif = {
      isSent: false,
      isTimer: false
    };
    this.seamless = {
      function: () => {
      },
      args: undefined,
      message: undefined,
      timeout: undefined
    };
    this.userKeys = new Map();
    this.prefix = undefined;
    this.searchReactionTimeout = undefined;
    this.djTimer = {
      timer: undefined,
      startTime: undefined,
      duration: 1800000
    };
    this.djMessageDate = false;
    this.errors = {
      permissionReaction: false,
      continuousStreamErrors: 0
    };
    this.silence = false;
  }

  resetStreamData() {
    this.streamData.type = undefined;
    this.streamData.stream = undefined;
    this.streamData.urlAlt = undefined;
    this.streamData.ytPlayer = undefined;
  }
}

export default LocalServer;
