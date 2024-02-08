import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import processStats from "../../../../utils/lib/ProcessStats";
import { botInVC } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.args[0]) {
    message.channel.send("error: expected a term to search for within the queue");
    return;
  }
  if (!botInVC(message)) {
    message.channel.send("error: must be in a voice channel with db vibe");
    return;
  }
  commandHandlerCommon
    .queueFind(message, event.server, event.args.join(" "))
    .catch((er: Error) => processStats.debug(er));
};
