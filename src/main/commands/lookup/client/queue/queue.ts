import { MessageEventLocal } from "../../../../utils/lib/types";
import { runQueueCommand } from "../../../generateQueue";
import { isShortCommand } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  runQueueCommand(server, message, event.mgid, isShortCommand(event.message.guild!, event.statement));
};
