import { MessageEventLocal } from "../../../utils/lib/types";
import { INVITE_MSG } from "../../../utils/lib/constants";

exports.run = async (event: MessageEventLocal) => {
  event.message.channel.send(INVITE_MSG);
};
