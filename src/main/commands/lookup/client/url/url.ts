import { getSheetName } from "../../../../utils/utils";
import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!event.args[0]) {
    if (server.queue[0] && message.member!.voice.channel) {
      return message.channel.send(server.queue[0].url);
    } else {
      return message.channel.send(
        "*add a key to get it's " + event.statement + " `(i.e. " + event.statement + " [key])`*"
      );
    }
  }
  await commandHandlerCommon.nowPlaying(
    server,
    message,
    message.member!.voice?.channel,
    event.args[0],
    getSheetName(message.member!.id),
    "m"
  );
};
