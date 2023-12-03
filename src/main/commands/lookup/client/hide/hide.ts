import { MessageEventLocal } from "../../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  if (!event.message.member!.voice?.channel) {
    return event.message.channel.send("You must be in a voice channel to silence");
  }
  if (event.server.silence) {
    return event.message.channel.send("*song notifications already silenced, use 'unsilence' to unsilence.*");
  }
  event.server.silence = true;
  event.message.channel.send("*song notifications silenced for this session*");
};
