import { MessageEventLocal } from "../../../../utils/lib/types";
import { getSheetName } from "../../../../utils/utils";
import { runDeleteKeyCommand_P } from "../../../../database/delete";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.args[0]) return message.channel.send("*no args provided*");
  void runDeleteKeyCommand_P(message, event.args[0], getSheetName(message.member!.id), event.server);
};
