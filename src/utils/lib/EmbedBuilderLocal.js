const { EmbedBuilder } = require('discord.js');

/**
 * Local wrapper for EmbedBuilder.
 */
class EmbedBuilderLocal {
  _embed;

  constructor() {
    this._embed = new EmbedBuilder();
  }

  setTitle(value) {
    this._embed.setTitle(value);
    return this;
  }

  setDescription(value) {
    this._embed.setDescription(value);
    return this;
  }

  setColor(value) {
    this._embed.setColor(value);
    return this;
  }

  setSplash(value) {
    this._embed.setSplash(value);
    return this;
  }

  setURL(value) {
    this._embed.setURL(value);
    return this;
  }

  setAuthor(value) {
    this._embed.setAuthor(value);
    return this;
  }

  setFooter(value) {
    if (typeof value === 'string') {
      this._embed.setFooter({ text: value });
    }
    else {
      this._embed.setFooter(value);
    }
    return this;
  }

  setImage(value) {
    this._embed.setImage(value);
    return this;
  }

  addFields(...value) {
    this._embed.addFields(...value);
    return this;
  }

  setFields(...value) {
    this._embed.setFields(...value);
    return this;
  }

  setThumbnail(value) {
    this._embed.setThumbnail(value);
    return this;
  }

  getData() {
    return this.data();
  }

  get data() {
    return this._embed.data;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Returns an EmbedBuilder.
   * @return {import('discord.js').EmbedBuilder} The EmbedBuilder.
   */
  build() {
    return this._embed;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Sends the embed to the channel.
   * @param channel {import('discord.js').TextChannel} The text channel to send the embed to.
   * @return {import('discord.js').Message} The new message.
   */
  async send(channel) {
    return channel.send({ embeds: [this.build()] });
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Sends the embed in place of an existing message.
   * @param message {import('discord.js').Message} The message to edit.
   * @return {import('discord.js').Message} The edited message.
   */
  async edit(message) {
    return message.edit({ embeds: [this.build()] });
  }
}


module.exports = { EmbedBuilderLocal };
