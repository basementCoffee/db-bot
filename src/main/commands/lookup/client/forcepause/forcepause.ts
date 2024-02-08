import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { hasDJPermissions } from "../../../../utils/permissions";
import { TextChannel } from "discord.js";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, event.server.voteAdmin)) {
    commandHandlerCommon.pauseStream(message, message.member!, event.server, false, true, false);
  }
};
