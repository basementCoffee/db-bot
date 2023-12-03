import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.restartPlaying(event.message, event.mgid, "replay", event.server);
};
