import { ADMINS, CORE_ADM } from './lib/constants';
import { BaseGuildTextChannel } from 'discord.js';

/**
 * Returns whether a given ID has Admin rights.
 * @param id {string} The id of the member.
 * @returns {boolean} True if provided Admin rights.
 */
function isAdmin(id: string) {
  // kzb
  // add a space to ensure exact match
  return ADMINS.includes(`${id} `);
}

/**
 * If the id is a coreAdmin ID;
 * @param id {string} The id of the user.
 * @returns {boolean} If the user is a core admin.
 */
function isCoreAdmin(id: string): boolean {
  return CORE_ADM.includes(id);
}

/**
 * Verifies if a member is a vote admin (DJ moderator) or has the same permissions as a vote admin.
 * @param channel The text channel to send a response to
 * @param memberID The member id of the user to verify
 * @param printErrMsg True if to print an error if the user is not a vote admin
 * @param voteAdminList The list of admins for the DJ.
 * @returns {boolean} Returns true if the member has DJ permissions.
 */
function hasDJPermissions(
  channel: BaseGuildTextChannel,
  memberID: string,
  printErrMsg: boolean,
  voteAdminList: Array<any>
) {
  if (voteAdminList.length < 1 || voteAdminList.filter((x) => x.id === memberID).length > 0) {
    return true;
  } else if (printErrMsg) {
    channel.send('*you do not have the necessary permissions to perform this action*');
  }
  return false;
}

export { isAdmin, isCoreAdmin, hasDJPermissions };
