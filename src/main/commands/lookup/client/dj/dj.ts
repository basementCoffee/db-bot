import { MessageEventLocal } from "../../../../utils/lib/types";
import { runDJCommand } from "../../../dj";

exports.run = async (event: MessageEventLocal) => {
  runDJCommand(event.message, event.server);
};
