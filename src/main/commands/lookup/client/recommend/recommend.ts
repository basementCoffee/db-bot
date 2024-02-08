import { MessageEventLocal } from "../../../../utils/lib/types";
import { sendRecommendationWrapper } from "../../../stream/recommendations";
import { bot } from "../../../../utils/lib/constants";

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  sendRecommendationWrapper(message, event.args, bot.users, server).then();
};
