import fs from 'fs';
import { CommandHandler, MessageEventCore } from '@hoursofza/djs-common';
import { isAdmin } from '../utils/permissions';
import { EventDataKeyEnum } from '../utils/lib/types';
import { commandsMap } from '../utils/lib/constants';

// list of commands that should not be process-specific
// const MULTI_PROCESS_CMDS = ['boot', 'update'];
// the output directory name where source files are generated

class CommandHandlerLocal extends CommandHandler<EventDataKeyEnum> {
  constructor() {
    super(isAdmin, `./dist/src/main/commands/lookup`, '../commands/lookup');
  }

  getCommand(statement: string, userID: string) {
    // if (!processManager.isActive() && !MULTI_PROCESS_CMDS.includes(statement)) return;
    return super.getCommand(statement, userID);
  }

  protected requireModule(): NodeJS.Require {
    return require;
  }

  protected fsModule(): typeof import('fs') {
    return fs;
  }

  protected commandNotFoundDuringExecution(event: MessageEventCore<EventDataKeyEnum>) {
    this.saveStatement(event.statement);
  }

  protected postCommandExecution(event: MessageEventCore<EventDataKeyEnum>, isAdminCommand: boolean) {
    if (!isAdminCommand) this.saveStatement(event.statement);
  }

  private saveStatement(statement: string) {
    commandsMap.set(statement, (commandsMap.get(statement) || 0) + 1);
  }
}

const commandHandler = new CommandHandlerLocal();
export { commandHandler };
