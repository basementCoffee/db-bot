// Audio Implementation
const {joinVoiceChannel} = require('@discordjs/voice');

class AudioImpl {
  // the player for the server
  player;
  // the audio resource
  resource;
  // if the player is playing
  status;
  // the id of the active voice channel
  voiceChannelId;
  // the VoiceConnection
  connection;

  constructor () {
    this.reset();
  }

  // reset all property values
  reset () {
    this.player = undefined;
    this.resource = undefined;
    this.status = false;
    this.voiceChannelId = undefined;
    this.connection = undefined;
  }

  /**
   * Joins a voice channel.
   * @param guild
   * @param voiceChannelId
   * @return {import('discord.js').VoiceConnection}
   */
  joinVoiceChannel (guild, voiceChannelId) {
    this.voiceChannelId = voiceChannelId;
    this.connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });
    return this.connection;
  }

  /**
   * Determine if the voice channel is active.
   * @param voiceChannelId
   */
  isActiveVoiceChannel (voiceChannelId) {
    return this.voiceChannelId && this.voiceChannelId === voiceChannelId;
  }

  /**
   * Returns true if the member is in the active voice channel.
   * @param member {import('discord.js').GuildMember} The member object
   * @return {boolean} If the member is in the active voice channel
   */
  isVoiceChannelMember (member) {
    return member.voice.channel && member.voice.channel.id === this.voiceChannelId;
  }

}

module.exports = {AudioImpl};
