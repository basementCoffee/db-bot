import { getSheetName } from "../../../../utils/utils";
import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  const lookupTerm = event.args[0];
  if (!lookupTerm) {
    const lookupItem = server.queue[0];
    if (lookupItem.source) {
      message.channel.send("from playlist: <" + lookupItem.source + ">");
      return;
    }
  }
  commandHandlerCommon
    .searchForKeyUniversal(
      message,
      server,
      getSheetName(message.member!.id),
      lookupTerm ? lookupTerm : server.queue[0]?.url
    )
    .then();
};
