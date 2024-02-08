import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";
import { getSheetName } from "../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  await commandHandlerCommon.addKeyToDB(
    message.channel,
    event.args,
    getSheetName(message.member!.id),
    true,
    event.server,
    message.member
  );
};
