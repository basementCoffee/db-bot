import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';
import { TextChannel } from 'discord.js';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon
    .setSplashscreen(event.server, <TextChannel>event.message.channel, 'entries', event.args[0])
    .then();
};
