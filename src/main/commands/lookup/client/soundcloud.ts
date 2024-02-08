import { MessageEventLocal } from "../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  message.channel.send(`*try the play command with a soundcloud link \` Ex: ${event.prefix}play [SOUNDCLOUD_URL]\`*`);
};
