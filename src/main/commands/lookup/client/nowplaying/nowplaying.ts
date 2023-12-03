import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { getSheetName } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  await commandHandlerCommon.nowPlaying(
    event.server,
    message,
    message.member!.voice?.channel,
    event.args[0],
    getSheetName(message.member!.id),
    ""
  );
};
