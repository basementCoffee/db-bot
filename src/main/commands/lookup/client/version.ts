import { EventDataKeyEnum, MessageEventLocal } from "../../../utils/lib/types";
import { EmbedBuilderLocal } from "@hoursofza/djs-common";

exports.run = async (event: MessageEventLocal) => {
  new EmbedBuilderLocal()
    .setTitle("Version")
    .setDescription(
      "[" + event.data.get(EventDataKeyEnum.BOT_VERSION) + "](https://github.com/Reply2Zain/db-bot/commits/djs14)"
    )
    .send(event.message.channel)
    .then();
};
