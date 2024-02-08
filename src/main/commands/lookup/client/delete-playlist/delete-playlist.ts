import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";
import { getSheetName } from "../../../../utils/utils";
import { getXdb2 } from "../../../../database/retrieval";
import { TextChannel } from "discord.js";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  commandHandlerCommon
    .removeDBPlaylist(
      event.server,
      getSheetName(message.member!.id),
      event.args[0],
      await getXdb2(event.server, getSheetName(message.member!.id), false),
      <TextChannel>message.channel
    )
    .then();
};
