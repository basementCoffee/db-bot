class MockVoice {
  channel;

  constructor(channel) {
    this.channel = channel;
  }
}

class MockGuild {
  voice;

  constructor(voice) {
    this.voice = voice;
  }
}

class MockChannel {
  sentMsg;


  send(msg) {
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

  constructor(channel, guild) {
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


module.exports = { MockChannel, MockVoice, MockMessage, MockGuild };
