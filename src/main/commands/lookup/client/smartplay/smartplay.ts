import { MessageEventLocal } from "../../../../utils/lib/types";
import { botInVC } from "../../../../utils/utils";
import { updateActiveEmbed } from "../../../../utils/embed";

exports.run = async (event: MessageEventLocal) => {
  if (!botInVC(event.message)) {
    // avoid sending a message for smaller command names
    if (event.statement.length > 4) event.message.channel.send("must be playing something to use smartplay");
    return;
  }
  if (event.server.autoplay) {
    event.server.autoplay = false;
    event.message.channel.send("*smartplay turned off*");
  } else {
    event.server.autoplay = true;
    event.message.channel.send("*smartplay turned on*");
  }
  updateActiveEmbed(event.server).then();
};
