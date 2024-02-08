import { getSheetName } from "../../../../utils/utils";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { MessageEventLocal } from "../../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  commandHandlerCommon
    .keys(message, server, getSheetName(message.member!.id), null, event.args[0], message.member!.nickname ?? undefined)
    .then();
};
