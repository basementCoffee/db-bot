import { MessageEventLocal } from "../../../../utils/lib/types";
import { runSkipCommand } from "../../../stream/stream";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  runSkipCommand(message, message.member!.voice?.channel, server, event.args[0], true, false, message.member);
};
