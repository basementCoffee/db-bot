class MockVoice {
  channel;
  id = (Math.random() * 1000000 + 1).toString();
  constructor(channel: MockChannel) {
    this.channel = channel;
  }
}

class MockGuild {
  voice;
  id = (Math.random() * 1000000 + 1).toString();
  constructor(voice?: any) {
    this.voice = voice;
  }
}

class MockChannel {
  sentMsg: MockMessage | undefined;
  id = (Math.random() * 1000000 + 1).toString();
  guild: MockGuild;
  constructor(guild: MockGuild) {
    this.guild = guild;
  }

  send(msg: MockMessage) {
    this.sentMsg = msg;
  }

  getContent() {
    return this.sentMsg;
  }

  clearSent() {
    this.sentMsg = undefined;
  }
}

class MockMessage {
  channel;
  guild;
  id = (Math.random() * 1000000 + 1).toString();
  constructor(channel: MockChannel, guild: MockGuild) {
    this.channel = channel;
    this.guild = guild;
  }

  getContent() {
    return this.channel.getContent();
  }

  clearSent() {
    return this.channel.clearSent();
  }
}

export { MockChannel, MockVoice, MockMessage, MockGuild };
