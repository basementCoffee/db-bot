import { MessageEventLocal } from "../../../../utils/lib/types";
import { runDictatorCommand } from "../../../dj";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  runDictatorCommand(message, event.mgid, event.prefix, event.server);
};
