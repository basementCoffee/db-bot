import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
const version = require('../../../../../package.json').version;

exports.run = async (event: MessageEventLocal) => {
  new EmbedBuilderLocal()
    .setTitle('Version')
    .setDescription('[' + version + '](https://github.com/Reply2Zain/db-bot/commits/djs14)')
    .send(event.message.channel)
    .then();
};
