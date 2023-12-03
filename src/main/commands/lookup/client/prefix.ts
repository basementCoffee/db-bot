import { MessageEventLocal } from "../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  message.channel.send("use the command `changeprefix` to change the bot's prefix");
};
