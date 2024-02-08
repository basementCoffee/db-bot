import { MessageEventLocal } from '../../../utils/lib/types';
import { createMemoryEmbed } from '../../../utils/utils';

exports.run = async (event: MessageEventLocal) => {
  (await createMemoryEmbed()).send(event.message.channel).then();
};
