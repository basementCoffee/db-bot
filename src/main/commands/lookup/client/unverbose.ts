import { MessageEventLocal } from "../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (!event.server.verbose) {
    message.channel.send("*verbose mode is not currently enabled*");
  } else {
    event.server.verbose = false;
    message.channel.send("***verbose mode disabled***");
  }
};
