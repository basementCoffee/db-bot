import { TextChannel } from "discord.js";
import { getSheetName } from "../../../../utils/utils";
import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!event.args[0] || !event.args[1]) {
    message.channel.send(`*expected a playlist-name and new playlist-name (i.e. ${event.statement} [A] [B])*`);
    return;
  }
  commandHandlerCommon
    .renamePlaylist(
      <TextChannel>message.channel,
      server,
      getSheetName(message.member!.id),
      event.args[0],
      event.args[1]
    )
    .then();
};
