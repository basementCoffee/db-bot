// A playable item in the queue
import { StreamType } from './constants';
import { MessageEventCore } from '@hoursofza/djs-common';
import LocalServer from './LocalServer';

export type QueueItem = {
  url: string;
  type: StreamType;
  infos: any;
  urlAlt?: string;
  embed?: any;
  // where the item was added, if from a playlist
  source?: string;
};

export type MessageEventLocal = MessageEventCore<string> & {
  server: LocalServer;
  mgid: string;
};
