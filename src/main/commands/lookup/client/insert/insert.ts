import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { getSheetName } from "../../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  commandHandlerCommon.insert(message, event.mgid, event.args, event.server, getSheetName(message.member!.id)).then();
};
