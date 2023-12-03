import { MessageEventLocal } from "../../../utils/lib/types";
import { EmbedBuilderLocal } from "@hoursofza/djs-common";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  // congratulate a friend
  if (!event.args[0]) return message.channel.send("*no friend provided*");
  const friend = message.mentions.users.first();
  if (!friend) return message.channel.send("*no friend provided*");
  const friendName = friend.username;
  const friendAvatar = friend.avatarURL()!;
  new EmbedBuilderLocal()
    .setTitle("Congrats!")
    .setDescription(`${friendName} has been congratulated!`)
    .setThumbnail(friendAvatar)
    .setColor("#00ff00")
    .setFooter({
      text: `By ${message.author.username}`,
      iconURL: message.author.avatarURL() || ""
    })
    .send(message.channel)
    .then();
};
