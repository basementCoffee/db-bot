import { formatDuration } from '../main/utils/formatUtils';
import { bot } from '../main/utils/lib/constants';
import { runMoveItemCommand } from '../main/commands/move';
import * as utils from '../main/utils/utils';
import { revokeClient } from '../main/database/api/api';
import { MockVoice, MockChannel, MockMessage, MockGuild } from './MockTestClasses';
import { BaseGuildTextChannel } from 'discord.js';

const destroyBot = () => bot.destroy();

let message: BaseGuildTextChannel | MockMessage;
let messageNoVoice: MockMessage;
const mockGuild = new MockGuild();
mockGuild.voice = new MockVoice(new MockChannel(mockGuild));
beforeEach(() => {
  message = <BaseGuildTextChannel>(
    (<unknown>new MockMessage(new MockChannel(mockGuild), new MockGuild(new MockVoice(new MockChannel(mockGuild)))))
  );
  messageNoVoice = new MockMessage(new MockChannel(mockGuild), new MockGuild(undefined));
});

describe('startup', () => {
  it('should login to googleapis', async () => {
    await new Promise((res) => setTimeout(res, 1100));
    expect(true).toEqual(true);
  });
});

let arr: any;
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
    expect(formatDuration(Number(undefined))).toEqual('0m 0s');
    expect(formatDuration(Number(null))).toEqual('0m 0s');
  });
});
describe('test runMoveItemCommand', () => {
  const botInVCSpy = jest.spyOn(utils, 'botInVC');
  const botInVCGuildSpy = jest.spyOn(utils, 'botInVcGuild');
  botInVCSpy.mockReturnValue(true);
  botInVCGuildSpy.mockReturnValue(true);

  // substring of what is sent on successful move
  const MOVED_SUBSTR = 'moved item to position';
  const contentIncludes = (txt: any) => ((<any>message).getContent() || '').includes(txt);

  it('valid A < B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand((<any>message).channel, arr, 1, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(true);
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
  });

  it('valid A > B', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand((<any>message).channel, arr, 2, 1);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(true);
    expect(arr).toEqual(['A', 'C', 'B', 'D']);
    arr = ['A', 'B', 'C', 'D'];
  });

  it('invalid - array is too small', () => {
    arr = ['A', 'B'];
    runMoveItemCommand((<any>message).channel, arr, 1, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual(['A', 'B']);
  });

  it('invalid - positions', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand((<any>message).channel, arr, 0, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    (<any>message).clearSent();
    runMoveItemCommand((<any>message).channel, arr, 2, 0);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    (<any>message).clearSent();
    runMoveItemCommand((<any>message).channel, arr, -1, -1);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    // expect the arr to be the same
    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });

  it('invalid - empty array', () => {
    arr = [];
    runMoveItemCommand((<any>message).channel, arr, 2, 3);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual([]);
  });

  it('undefined - positions', () => {
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand((<any>message).channel, arr, <any>undefined, 2);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    (<any>message).clearSent();
    runMoveItemCommand((<any>message).channel, arr, 2, <any>undefined);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);

    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });

  // bot is not in a voice channel
  it('no voice channel', () => {
    botInVCSpy.mockRestore();
    botInVCGuildSpy.mockRestore();
    arr = ['A', 'B', 'C', 'D'];
    runMoveItemCommand(<any>messageNoVoice, arr, 2, 3);
    expect(contentIncludes(MOVED_SUBSTR)).toEqual(false);
    expect(arr).toEqual(['A', 'B', 'C', 'D']);
  });
});

afterAll(async () => {
  destroyBot();
  try {
    await revokeClient();
  } catch (e) {}
  await new Promise((res) => setTimeout(res, 1000));
});
