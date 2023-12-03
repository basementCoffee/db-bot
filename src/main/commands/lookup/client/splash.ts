import { MessageEventLocal } from "../../../utils/lib/types";
import commandHandlerCommon from "../../CommandHandlerCommon";
import { TextChannel } from "discord.js";
import { getSheetName } from "../../../utils/utils";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  commandHandlerCommon
    .setSplashscreen(server, <TextChannel>message.channel, getSheetName(message.member!.id), event.args[0])
    .then();
};
