import { MessageEventLocal } from '../../../utils/lib/types';
import { devUpdateCommand } from '../../dev/devUpdateCommand';

exports.run = async (event: MessageEventLocal) => {
  devUpdateCommand(event.message, event.args);
};
