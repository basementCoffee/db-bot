import fs from 'fs';
import { EventHandler } from '@hoursofza/djs-common';

class EventHandlerLocal extends EventHandler {
  constructor() {
    super(`./dist/src/main/events`, '../events');
  }
  protected requireModule(): NodeJS.Require {
    return require;
  }

  protected fsModule(): typeof import('fs') {
    return fs;
  }
}

const eventHandler = new EventHandlerLocal();
export { eventHandler };
