import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { getSheetName, isShortCommandNoArgs } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (isShortCommandNoArgs(event.args, message.guild!, event.statement)) return;
  commandHandlerCommon
    .addRandomKeysToQueue(event.args, message, getSheetName(message.member!.id), server, false)
    .then();
};
