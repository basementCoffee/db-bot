import { MessageEventLocal } from "../../../utils/lib/types";
import { getSheetName } from "../../../utils/utils";
import { sendListSize } from "../../../database/retrieval";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (event.args[0]) sendListSize(message, server, getSheetName(message.member!.id), event.args[0]).then();
};
