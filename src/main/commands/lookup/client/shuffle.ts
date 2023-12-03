import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";
import { getSheetName } from "../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.shuffleQueueOrPlayRandom(
    event.args,
    event.message,
    getSheetName(event.message.member!.id),
    event.server,
    false,
    true
  );
};
