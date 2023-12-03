import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";
import { TextChannel } from "discord.js";
import { getSheetName } from "../../../utils/utils";
import { getXdb2 } from "../../../database/retrieval";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.args[0]) return message.channel.send(`*no args provided (i.e. ${event.statement} [key] [playlist])*`);
  commandHandlerCommon.moveKeysBetweenPlaylists(
    event.server,
    <TextChannel>message.channel,
    getSheetName(message.member!.id),
    await getXdb2(event.server, getSheetName(message.member!.id), false),
    event.args
  );
};
