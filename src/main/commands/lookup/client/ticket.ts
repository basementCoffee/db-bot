import { MessageEventLocal } from "../../../utils/lib/types";
import { dmHandler } from "../../../utils/dms";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (event.args[0]) {
    dmHandler(message, event.args.join(""));
    message.channel.send("Your message has been sent");
  } else {
    return message.channel.send("*input a message after the command to submit a request/issue*");
  }
};
