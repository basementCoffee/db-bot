import { MessageEventLocal } from "../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.server.verbose) {
    event.server.verbose = true;
    message.channel.send("***verbose mode enabled***, *embeds will be kept during this listening session*");
  } else {
    event.server.verbose = false;
    message.channel.send("***verbose mode disabled***");
  }
};
