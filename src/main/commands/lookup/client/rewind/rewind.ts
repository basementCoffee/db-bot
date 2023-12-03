import { MessageEventLocal } from "../../../../utils/lib/types";
import { runRewindCommand } from "../../../stream/stream";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  runRewindCommand(
    message,
    event.mgid,
    message.member!.voice?.channel!,
    event.args[0],
    false,
    false,
    message.member,
    event.server
  );
};
