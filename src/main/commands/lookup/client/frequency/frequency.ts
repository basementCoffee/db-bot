import { MessageEventLocal } from '../../../../utils/lib/types';
import { botInVC, createVisualEmbed, getTitle } from '../../../../utils/utils';
import { createVisualText } from '../../../generateQueue';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!botInVC(message)) return;
  const tempAuditArray = [];
  for (const [key, value] of server.mapFinishedLinks) {
    tempAuditArray.push({ url: key, title: await getTitle(value.queueItem), index: value.numOfPlays });
  }
  // sort by times played
  tempAuditArray.sort((a, b) => {
    return b.index - a.index;
  });
  createVisualEmbed(
    'Link Frequency',
    (await createVisualText(
      server,
      tempAuditArray,
      (index: number, title: string, url: string) => `${index} | [${title}](${url})\n`
    )) || 'no completed links'
  )
    .send(message.channel)
    .then();
};
