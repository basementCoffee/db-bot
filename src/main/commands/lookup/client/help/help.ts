import { isShortCommand } from "../../../../utils/utils";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { EventDataKeyEnum, MessageEventLocal } from "../../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  if (isShortCommand(event.message.guild!, event.statement)) return;
  commandHandlerCommon.help(event.message, event.server, event.data.get(EventDataKeyEnum.BOT_VERSION));
};
