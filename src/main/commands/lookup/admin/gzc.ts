import { MessageEventLocal } from '../../../utils/lib/types';
import { commandsMap } from '../../../utils/lib/constants';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';

exports.run = async (event: MessageEventLocal) => {
  let commandsMapString = '';
  const commandsMapArray: any[] = [];
  let CMAInt = 0;
  commandsMap.forEach((value: number, key: string) => {
    commandsMapArray[CMAInt++] = [key, value];
  });
  commandsMapArray.sort((a, b) => b[1] - a[1]);
  if (commandsMapArray.length < 1) {
    commandsMapString = '*empty*';
  } else {
    commandsMapArray.forEach((val) => {
      commandsMapString += val[1] + ' - ' + val[0] + '\n';
    });
  }
  new EmbedBuilderLocal()
    .setTitle('Commands Usage - Stats')
    .setDescription(commandsMapString)
    .send(event.message.channel)
    .then();
};
