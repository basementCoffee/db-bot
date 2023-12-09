import { MessageEventLocal } from '../../../utils/lib/types';
import { bot } from '../../../utils/lib/constants';

exports.run = async (event: MessageEventLocal) => {
  event.message.channel.send(
    "Here's the dev docs:\n" +
      '<https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622>'
  );
};
