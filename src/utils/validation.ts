import {MAX_QUEUE_S} from "./lib/constants";
import LocalServer from "./lib/LocalServer";
import {Message, TextChannel} from "discord.js";
import {hasDJPermissions} from "./permissions";
import { botInVC, resetSession } from './utils';

/**
 * Determines whether to proceed with the command, based on the request.
 * Will inform the user of the issue if not a valid request.
 * @param server {LocalServer} The local server object.
 * @param channel The text channel that triggered the bot.
 * @param memberId The member performing the request.
 * @param actionDescription A brief description of the command/action.
 * @return {boolean} Returns true if the command should NOT proceed.
 */
function isValidRequestSpecific(server: LocalServer, channel: TextChannel, memberId: string, actionDescription: string): boolean {
  if (server.dictator && memberId !== server.dictator.id) {
    channel.send(`only the dictator can ${actionDescription}`);
    return false;
  }
  if (server.lockQueue && !hasDJPermissions(channel, memberId, true, server.voteAdmin)) {
    channel.send(`the queue is locked: only the DJ can ${actionDescription}`);
    return false;
  }
  return true;
}

/**
 * Determines whether to proceed with the command, based on the request.
 * Will inform the user of the issue if not a valid request.
 * @param server {LocalServer} The local server object.
 * @param message The message metadata.
 * @param actionDescription A brief description of the command/action.
 * @return {boolean} Returns true if the command should NOT proceed.
 */
function isValidRequest(server: LocalServer, message: Message, actionDescription: string): boolean {
  return isValidRequestSpecific(server, <TextChannel>message.channel, message.member!.id, actionDescription);
}

/**
 * A wrapper for isValidRequest which also assumes that the user is attempting to play or add to the queue.
 * Will inform the user of the issue if not a valid request.
 * @param server {LocalServer} The local server object.
 * @param message The message metadata.
 * @param actionDescription A brief description of the command/action.
 * @return {boolean} Returns true if the command should NOT proceed.
 */
function isValidRequestWPlay(server: LocalServer, message: Message, actionDescription: string): boolean {
  if (!isValidRequest(server, message, actionDescription)) return false;
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  }
  else if (server.queue.length >= MAX_QUEUE_S) {
    message.channel.send('*max queue size has been reached*');
    return false;
  }
  return true;
}


export { isValidRequestWPlay };
