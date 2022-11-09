const { formatDuration } = require('../src/utils/utils');
const { bot } = require('../src/utils/lib/constants');
const { runMoveItemCommand } = require('../src/commands/move');
const utils = require('../src/utils/utils');
const { revokeClient } = require('../src/database/api/api');

let arr;
const destroyBot = () => bot.destroy();

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

let message;
let messageNoVoice;
beforeEach(() => {
  message = new MockMessage(new MockChannel(), new MockGuild(new MockVoice(new MockChannel())));
  messageNoVoice = new MockMessage(new MockChannel(), new MockGuild());
});

describe('startup', () => {
  it('should login to googleapis', async () => {
    await new Promise((res) => setTimeout(res, 1100));
    expect(true).toEqual(true);
  });
});

describe('test formatDuration', () => {
  it('formatDuration()', () => {
    expect(formatDuration(-1)).toEqual('0m 0s');
    expect(formatDuration(0)).toEqual('0m 0s');
    expect(formatDuration(600)).toEqual('0m 0s');
    expect(formatDuration(100)).toEqual('0m 0s');
    expect(formatDuration(1000)).toEqual('0m 1s');
    expect(formatDuration(50000)).toEqual('0m 50s');
    expect(formatDuration(700000)).toEqual('11m 40s');
  });
  it('formatDuration() undefined', () => {
    expect(formatDuration(undefined)).toEqual('0m 0s');
    expect(formatDuration(null)).toEqual('0m 0s');
  });
});
describe('test runMoveItemCommand', () => {
  const botInVCSpy = jest.spyOn(utils, 'botInVC');
  botInVCSpy.mockReturnValue(true);

  // substring of what is sent on successful move
  const MOVED_SUBSTR = 'moved item to position';
  const contentIncludes = (txt) => (message.getContent() || '').includes(txt);

  it('valid A < B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 1, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(true);
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
  });

  it('valid A > B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 2, 1);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(true);
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
    arr = ['A', 'B', 'C', 'D'];
  });

  it('invalid - array is too small', () => {
    arr = ['A', 'B'];
    runMoveItemCommand(message, arr, 1, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual(['A', 'B']);
  });

  it('invalid - positions', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 0, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    message.clearSent();
    runMoveItemCommand(message, arr, 2, 0);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    message.clearSent();
    runMoveItemCommand(message, arr, -1, -1);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    // expect the arr to be the same
    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });

  it('invalid - empty array', () => {
    arr = [];
    runMoveItemCommand(message, arr, 2, 3);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual([]);
  });

  it('undefined - positions', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, undefined, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    message.clearSent();
    runMoveItemCommand(message, arr, 2, undefined);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });

  // bot is not in a voice channel
  it('no voice channel', () => {
    botInVCSpy.mockRestore();
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(messageNoVoice, arr, 2, 3);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });
});

afterAll(async () => {
  destroyBot();
  await revokeClient();
  await new Promise((res) => setTimeout(res, 2000));
});

