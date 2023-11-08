import { MessageEventLocal } from '../../../../utils/lib/types';
import { congratsCommand } from '../../../congrats';

exports.run = async (event: MessageEventLocal) => {
  congratsCommand(event.message, event.server, event.statement, event.args);
};
