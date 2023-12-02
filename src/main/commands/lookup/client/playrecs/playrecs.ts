import { MessageEventLocal } from '../../../../utils/lib/types';
import { playRecommendation } from '../../../stream/recommendations';
import processStats from '../../../../utils/lib/ProcessStats';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  playRecommendation(message, server, event.args).catch((er: Error) => processStats.logError(er));
};
