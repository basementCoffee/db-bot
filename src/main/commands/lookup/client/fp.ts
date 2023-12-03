import { MessageEventLocal } from "../../../utils/lib/types";
import { isShortCommand } from "../../../utils/utils";
import { hasDJPermissions } from "../../../utils/permissions";
import { TextChannel } from "discord.js";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (isShortCommand(message.guild!, event.statement)) return;
  if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, event.server.voteAdmin)) {
    message.channel.send("use 'fpl' to force play and 'fpa' to force pause.");
  }
};
