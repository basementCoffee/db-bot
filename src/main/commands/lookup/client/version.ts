import { MessageEventLocal } from '../../../utils/lib/types';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import { botVersion } from '../../../utils/lib/constants';

exports.run = async (event: MessageEventLocal) => {
  new EmbedBuilderLocal()
    .setTitle('Version')
    .setDescription('[' + event.data.get(botVersion) + '](https://github.com/Reply2Zain/db-bot/commits/djs14)')
    .send(event.message.channel)
    .then();
};
