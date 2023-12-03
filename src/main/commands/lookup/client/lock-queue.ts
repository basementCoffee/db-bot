import { MessageEventLocal } from "../../../utils/lib/types";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (event.server.voteAdmin.filter((x: any) => x.id === message.member!.id).length > 0) {
    if (event.server.lockQueue) message.channel.send("***the queue has been unlocked:*** *any user can add to it*");
    else message.channel.send("***the queue has been locked:*** *only the dj can add to it*");
    event.server.lockQueue = !event.server.lockQueue;
  } else {
    message.channel.send("only a dj can lock the queue");
  }
};
