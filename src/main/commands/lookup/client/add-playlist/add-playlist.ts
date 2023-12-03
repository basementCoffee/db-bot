import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { getSheetName } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.args[0]) {
    message.channel.send(`*error: expected a playlist name to add (i.e. \`${event.statement} [playlist-name]\`)*`);
    return;
  }
  await commandHandlerCommon.addCustomPlaylist(
    event.server,
    message.channel,
    getSheetName(message.member!.id),
    event.args[0]
  );
};
