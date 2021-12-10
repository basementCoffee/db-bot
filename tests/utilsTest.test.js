const {runMoveItemCommand, destroyBot, formatDuration} = require('../src/utils/utils');

let arr;


class MockVoice{
  channel;
  constructor (channel) {
    this.channel = channel;
  }
}
class MockGuild {
  voice;
  constructor (voice) {
    this.voice = voice;
  }
}

class MockChannel {
  sentMsg;

  constructor () {}

  send (msg) {
    this.sentMsg = msg;
  }

  getSent(){
    return this.sentMsg;
  }
}

class MockMessage {
  channel;
  guild;
  constructor (channel, guild) {
    this.channel = channel;
    this.guild = guild;
  }

  getSent(){
    return this.channel.getSent();
  }
}
let message;
let messageNoVoice;
beforeEach(()=> {
message = new MockMessage(new MockChannel(), new MockGuild(new MockVoice(new MockChannel())));
messageNoVoice = new MockMessage(new MockChannel(), new MockGuild());
});


describe('test formatDuration', ()=> {
  it('formatDuration()', ()=> {
    expect(formatDuration(-1)).toEqual('0m 0s');
    expect(formatDuration(0)).toEqual('0m 0s');
    expect(formatDuration(600)).toEqual('0m 0s');
    expect(formatDuration(100)).toEqual('0m 0s');
    expect(formatDuration(1000)).toEqual('0m 1s');
    expect(formatDuration(50000)).toEqual('0m 50s');
    expect(formatDuration(700000)).toEqual('11m 40s');
  });
  it('formatDuration() undefined', ()=>{
    expect(formatDuration(undefined)).toEqual('0m 0s');
    expect(formatDuration(null)).toEqual('0m 0s');
  });

})
describe('test runMoveItemCommand', () => {
  it ('small array', ()=> {
    arr = ['A', 'B'];
    runMoveItemCommand(message, arr, 1, 2)
    expect(typeof message.getSent()).toEqual('string');
    expect(arr).toEqual(['A', 'B']);
  });
  it('valid A < B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 1, 2);
    expect(typeof message.getSent()).toEqual('string');
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
  });

  it('valid A > B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 2, 1);
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
    arr = ['A', 'B', 'C', 'D'];
  });

  it('invalid', ()=> {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(message, arr, 0, 2);
    expect(!message.getSent()).toEqual(false);

    runMoveItemCommand(message, arr, -1, -1);
    expect(!message.getSent()).toBe(false);
    // expect the arr to be the same
    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });

  it('empty array', ()=> {
    arr = [];
    runMoveItemCommand(message, arr, 2, 3);
    expect(!message.getSent()).toEqual(false);
    expect(arr).toEqual([]);
  });

  it ('no voice channel', ()=> {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(messageNoVoice, arr, 2, 3);
    expect(arr).toEqual( ['A', 'B', 'C', 'D']);
  });

});

afterAll(() => {
  destroyBot();
});

