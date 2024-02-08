import { MessageEventLocal } from "../../../../utils/lib/types";
import { isShortCommand } from "../../../../utils/utils";
import { runSkipCommand } from "../../../stream/stream";
import { hasDJPermissions } from "../../../../utils/permissions";
import { TextChannel } from "discord.js";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (isShortCommand(message.guild!, event.statement)) return;
  if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, event.server.voteAdmin)) {
    runSkipCommand(message, message.member!.voice?.channel, event.server, event.args[0], true, true, message.member);
  }
};
