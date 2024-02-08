import { AudioPlayer, AudioResource, VoiceConnection } from "@discordjs/voice";
import { Guild, GuildMember } from "discord.js";

const { joinVoiceChannel } = require("@discordjs/voice");

// Audio Implementation
class AudioImpl {
  // the player for the server
  player: AudioPlayer | undefined;
  // the audio resource
  resource: AudioResource | undefined;
  // if the player is playing
  status = false;
  // the id of the active voice channel
  voiceChannelId: string | null | undefined;
  // the VoiceConnection
  connection: VoiceConnection | undefined;

  // reset all property values
  reset() {
    if (this.connection) {
      try {
        this.connection.destroy();
        this.connection.disconnect();
      } catch (e) {
      }
    }
    this.player = undefined;
    this.resource = undefined;
    this.status = false;
    this.voiceChannelId = null;
    this.connection = undefined;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Joins a voice channel.
   * @param guild The guild object
   * @param voiceChannelId The id of the voice channel
   * @return {import("discord.js").VoiceConnection}
   */
  joinVoiceChannel(guild: Guild, voiceChannelId: string): VoiceConnection {
    this.voiceChannelId = voiceChannelId;
    this.connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });
    return this.connection!;
  }

  /**
   * Returns true if the member is in the active voice channel.
   * @param member The member object
   * @returns {boolean} If the member is in the active voice channel
   */
  isVoiceChannelMember(member: GuildMember): boolean {
    return !!(member.voice.channel && member.voice.channel.id === this.voiceChannelId);
  }
}

export default AudioImpl;
