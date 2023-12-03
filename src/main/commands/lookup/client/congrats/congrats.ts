import { botInVC, createQueueItem } from "../../../../utils/utils";
import { StreamType, whatspMap } from "../../../../utils/lib/constants";
import processStats from "../../../../utils/lib/ProcessStats";
import LocalServer from "../../../../utils/lib/LocalServer";
import { Message } from "discord.js";
import { MessageEventLocal } from "../../../../utils/lib/types";
import { playLinkToVC, skipLink } from "../../../stream/stream";

exports.run = async (event: MessageEventLocal) => {
  congratsCommand(event.message, event.server, event.statement, event.args);
};

/**
 * The congrats command.
 * @param message The message object.
 * @param server The localserver.
 * @param statement The specific command-name used
 * @param args Message contents.
 */
export function congratsCommand(message: Message, server: LocalServer, statement: string, args: string[]) {
  if (!botInVC(message)) {
    server.queue.length = 0;
    server.queueHistory.length = 0;
    server.loop = false;
  }
  server.numSinceLastEmbed++;
  const args2 = message.content.toLowerCase().replace(/\s+/g, " ").split(" ");
  const findIndexOfWord = (word: string) => {
    for (const w in args) {
      if (args[w].includes(word)) {
        return w;
      }
    }
    return "-1";
  };
  let name;
  let indexOfWord = findIndexOfWord("grats") || findIndexOfWord("congratulations");
  if (indexOfWord !== "-1") {
    name = args2[parseInt(indexOfWord) + 1];
    const excludedWords = ["on", "the", "my", "for", "you", "dude", "to", "from", "with", "by"];
    if (excludedWords.includes(name)) name = "";
    if (name && name.length > 1) name = name.substring(0, 1).toUpperCase() + name.substring(1);
  } else {
    name = "";
  }
  message.channel.send("Congratulations" + (name ? " " + name : "") + "!");
  const congratsLink = statement.includes("omedetou")
    ? "https://www.youtube.com/watch?v=hf1DkBQRQj4"
    : "https://www.youtube.com/watch?v=oyFQVZ2h0V8";
  if (server.queue[0]?.url !== congratsLink) {
    server.queue.unshift(createQueueItem(congratsLink, StreamType.YOUTUBE, null));
  } else {
    return;
  }
  if (message.member!.voice?.channel) {
    const vc = message.member!.voice.channel;
    setTimeout(() => {
      if (whatspMap.get(vc.id) === congratsLink) {
        skipLink(message, vc, false, server, true);
      }
      const item = server.queueHistory.findIndex((val) => val.url === congratsLink);
      if (item !== -1) server.queueHistory.splice(item, 1);
    }, 20000);
    const embedStatus = server.silence;
    server.silence = true;
    playLinkToVC(message, server.queue[0], vc, server).catch((er: Error) => processStats.debug(er));
    setTimeout(() => (server.silence = embedStatus), 4000);
    const item = server.queueHistory.findIndex((val) => val.url === congratsLink);
    if (item !== -1) server.queueHistory.splice(item, 1);
    return;
  }
}
