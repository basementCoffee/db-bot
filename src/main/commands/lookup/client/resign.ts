import { MessageEventLocal } from "../../../utils/lib/types";
import { runResignCommand } from "../../dj";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  runResignCommand(message, event.server);
};
