import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  await commandHandlerCommon.removeFromQueue(message, event.server, event.args[0]);
};
