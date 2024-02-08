import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.lyrics(event.message.channel.id, event.message.member!.id, event.args, event.server.queue[0]);
};
