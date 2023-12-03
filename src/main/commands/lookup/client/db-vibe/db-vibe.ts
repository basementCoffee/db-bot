import { MessageEventLocal } from "../../../../utils/lib/types";
import commandHandlerCommon from "../../../CommandHandlerCommon";

const version = require("../../../../../../package.json").version;

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.help(event.message, event.server, version);
};
