// A playable item in the queue
import { StreamType } from './constants';

export type QueueItem = {
  url: string;
  type: StreamType;
  infos: any;
  urlAlt?: string;
  embed?: any;
};
