import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";

// allows seeking of YouTube and Spotify links
exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.playWithSeek(event.message, event.server, event.args, event.mgid).then();
};
