import { MessageEventLocal } from "../../../../utils/lib/types";
import { isShortCommand } from "../../../../utils/utils";
import { runRewindCommand } from "../../../stream/stream";
import { hasDJPermissions } from "../../../../utils/permissions";
import { TextChannel } from "discord.js";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (isShortCommand(message.guild!, event.statement)) return;
  if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, event.server.voteAdmin)) {
    runRewindCommand(
      message,
      event.mgid,
      message.member!.voice?.channel!,
      event.args[0],
      true,
      false,
      message.member,
      event.server
    );
  }
};
