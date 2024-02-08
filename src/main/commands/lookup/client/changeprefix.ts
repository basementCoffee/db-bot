import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  commandHandlerCommon.changePrefix(message, server, event.prefix, event.args[0]);
};
