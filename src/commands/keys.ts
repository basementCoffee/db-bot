import {
  ColorResolvable,
  Message,
  MessageCreateOptions,
  MessagePayload,
  MessageReaction,
  TextChannel,
  User
} from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import { botInVC, isPersonalSheet, linkValidator } from '../utils/utils';
import { getSettings, getXdb2 } from '../database/retrieval';
import { getAssumptionMultipleMethods } from './search';
import reactions from '../utils/lib/reactions';
import { botID } from '../utils/lib/constants';
import { isAdmin } from '../utils/permissions';
import { renameKey, renamePlaylist } from './rename';
import { serializeAndUpdate } from '../database/utils';
import { removePlaylist } from './remove';
import { universalLinkFormatter } from '../utils/formatUtils';

// returns an array of tips
const getTips = (prefixS: string) => [
  'click on the arrow keys!',
  'the gear icon is page-specific',
  `add an icon using ${prefixS}splash [url]`,
  `${prefixS}ps [playlist] -> is the playlist shuffle command`,
  `${prefixS}random [num] -> plays random keys`,
  `${prefixS}pd [playlist] -> plays a playlist`
];

// eslint-disable-next-line valid-jsdoc
/**
 * Generates the full keys-list embed pages.
 * @param title the title of the embed
 * @param keyEmbedColor the color of the embed
 * @param prefixString the prefix string
 * @param xdb the xdb object
 * @param server {LocalServer} the server object
 * @param sheetName the name of the sheet
 * @param iconUrl Optional - An icon to display alongside the key embed.
 * @returns {Promise<EmbedBuilderLocal>}
 */
async function createKeyEmbedPages(
  title: string,
  keyEmbedColor: ColorResolvable,
  prefixString: string,
  xdb: any,
  server: LocalServer,
  sheetName: string,
  iconUrl?: string
): Promise<Array<EmbedBuilderLocal>> {
  let playlistString = '';
  let counter = 1;
  const embedPages = [];
  xdb.playlistArray.forEach((key: string) => (playlistString += `${counter++}. ${key}\n`));
  const settings = await getSettings(server, sheetName);
  embedPages.push(
    new EmbedBuilderLocal()
      .setTitle(`----- ${title} playlists -----`)
      .setDescription(playlistString)
      .setColor(keyEmbedColor)
      .setFooter({
        text: `${getTips(prefixString)[Math.floor(Math.random() * getTips(prefixString).length)]}`,
        iconURL: iconUrl
      })
      .setThumbnail(settings.splash)
  );
  let keysString: string | null;
  // iterate over playlists
  xdb.playlists.forEach((playlist: Map<string, any>, key: number) => {
    keysString = '';
    // iterate over a single playlist
    playlist.forEach((val) => {
      keysString = `${val.name}, ${keysString}`;
    });
    if (keysString.length) {
      keysString = keysString.substring(0, keysString.length - 2);
    } else {
      keysString = ' *this playlist is empty* ';
    }
    embedPages.push(
      new EmbedBuilderLocal()
        .setTitle(`${key}`)
        .setDescription(keysString)
        .setColor(keyEmbedColor)
        .setFooter({ text: `play command: ${prefixString}d [key]` })
    );
  });
  return embedPages;
}

/**
 * Grabs all the keys/names from the database.
 * @param message {any} The message trigger
 * @param server {LocalServer} The server
 * @param sheetName {string} The name of the sheet to retrieve
 * @param user {any?} Optional - username, overrides the message owner's name
 * @param specificPage {string?} The name of the page to display (to show instead of the playlist-page).
 * @param overrideName {string?} overrides the name displayed for the keys list.
 */
async function runKeysCommand(
  message: Message,
  server: LocalServer,
  sheetName: string,
  user: any | null,
  specificPage?: string,
  overrideName?: string | null
) {
  if (!user) user = message.member!.user;
  const keysMsg = botInVC(message)
    ? { edit: (editOptions: string | MessagePayload | MessageCreateOptions) => message.channel.send(editOptions) }
    : await message.channel.send('*getting keys...*');
  let xdb = await getXdb2(server, sheetName, botInVC(message));
  const prefixString = server.prefix;
  const keyArray: any[] = [];
  xdb.globalKeys.forEach((val: any) => keyArray.push(val.name));
  keyArray.reverse();
  // the keyArray to generate
  if (keyArray.length < 1) {
    keysMsg.edit(
      '**Your saved-links list is empty.**\n*Save a link by putting a word followed by a link.' +
        '\nEx:* ` ' +
        prefixString +
        'add [key] [link] `'
    );
  } else {
    const keyEmbedColors: Array<ColorResolvable> = [
      '#cdfc41',
      '#4192fc',
      '#fc4182',
      '#41fc9f',
      '#47fc41',
      '#41ecfc',
      '#90d5cf'
    ];
    const keyEmbedColor = keyEmbedColors[Math.floor(Math.random() * keyEmbedColors.length)];
    let title = '';
    let name;
    if (overrideName) {
      name = overrideName;
    } else {
      user ? (name = user.username) : (name = message.member!.nickname);
      if (!name) {
        name = message.author.username;
      }
    }
    if (!isPersonalSheet(sheetName)) {
      title += '**Server**';
    } else if (name) {
      title += `**${name}'s**`;
    } else {
      title += '**Personal** ';
    }
    let pageIndex = 0;
    let embedPages = await createKeyEmbedPages(title, keyEmbedColor, prefixString!, xdb, server, sheetName);
    // eslint-disable-next-line valid-jsdoc
    /**
     * Generates the keys list embed.
     * @param requiresUpdate {boolean} If to grab new data for the embed.
     * @returns {Promise<EmbedBuilderLocal>}
     */
    const generateKeysEmbed = async (requiresUpdate: boolean) => {
      // returns an array of embeds
      if (pageIndex < 0) pageIndex = embedPages.length - 1;
      else pageIndex = pageIndex % embedPages.length;
      if (specificPage) {
        const pArrayUpper = xdb.playlistArray.map((playlist: string) => playlist.toUpperCase());
        let index = pArrayUpper.indexOf(specificPage.toUpperCase());
        if (index === -1) {
          const ss = getAssumptionMultipleMethods(
            specificPage,
            <string[]>Array.from(xdb.playlists, ([name2]) => name2)
          );
          // ss should be uppercase since Map has names in uppercase
          if (ss) index = pArrayUpper.indexOf(ss);
        }
        if (index !== -1) {
          pageIndex = index + 1;
        }
        specificPage = undefined;
      } else if (requiresUpdate) {
        xdb = await getXdb2(server, sheetName, botInVC(message));
        keyArray.length = 0;
        xdb.globalKeys.forEach((val: any) => keyArray.push(val.name));
        keyArray.reverse();
        embedPages = await createKeyEmbedPages(title, keyEmbedColor, prefixString || '', xdb, server, sheetName);
      }
      return embedPages[pageIndex];
    };
    keysMsg
      .edit({
        content: ' ',
        embeds: [(await generateKeysEmbed(false)).build()]
      })
      .then(async (sentMsg) => {
        sentMsg
          .react(reactions.ARROW_L)
          .then(() => sentMsg.react(reactions.ARROW_R))
          .then(() => sentMsg.react(reactions.QUESTION))
          .then(() => sentMsg.react(reactions.GEAR));
        const filter = (reaction: MessageReaction, user2: User) => {
          return (
            user2.id !== botID &&
            [reactions.QUESTION, reactions.ARROW_R, reactions.ARROW_L, reactions.GEAR, reactions.SHUFFLE].includes(
              reaction.emoji.name!
            )
          );
        };
        const keysButtonCollector = sentMsg.createReactionCollector({ filter, time: 1200000 });
        keysButtonCollector.on('collect', async (reaction, reactionCollector) => {
          if (reaction.emoji.name === reactions.QUESTION) {
            new EmbedBuilderLocal()
              .setTitle('Commands')
              .setDescription(
                '**Edit Keys:** *allows you to save a link as a playable word*\n' +
                  `Create a key -> \` ${prefixString}add [key] [link]\`\n` +
                  `Create a key (in playlist) -> \` ${prefixString}add [playlist] [key] [link]\`\n` +
                  `Delete a key -> \` ${prefixString}delete [key]\`\n` +
                  `Move a key -> \` ${prefixString}move [keys] [new-playlist]\`\n` +
                  `Rename a key -> \` ${prefixString}rename-key [old-name] [new-name]\`\n` +
                  '\n**Edit Playlists:** *organize your keys*\n' +
                  `Create a playlist -> \` ${prefixString}add-playlist [playlist]\`\n` +
                  `Delete a playlist -> \` ${prefixString}delete-playlist [playlist]\`\n` +
                  `Rename a playlist -> \` ${prefixString}rename-playlist [old-name][new]\`\n` +
                  '\n**Play:** *a key or playlist*\n' +
                  `Play a key -> \` ${prefixString}d [key]\`\n` +
                  `Play a key (front of queue) -> \` ${prefixString}dnow [key]\`\n` +
                  `Play random keys -> \` ${prefixString}shuffle [number]\`\n` +
                  `Play a playlist -> \` ${prefixString}pd [playlist]\`\n` +
                  `Shuffle a playlist -> \` ${prefixString}pshuffle [playlist]\``
              )
              .send(message.channel)
              .then();
          } else if (reactionCollector.id === user.id || (!isPersonalSheet(sheetName) && isAdmin(user.id))) {
            // if it is not a personal sheet then it is a global sheet (which is in testing)
            if (reaction.emoji.name === reactions.ARROW_R) {
              pageIndex += 1;
              sentMsg.edit({ embeds: [(await generateKeysEmbed(false)).build()] });
              await reaction.users.remove(user.id);
            } else if (reaction.emoji.name === reactions.ARROW_L) {
              pageIndex -= 1;
              sentMsg.edit({ embeds: [(await generateKeysEmbed(false)).build()] });
              await reaction.users.remove(user.id);
            } else if (reaction.emoji.name === reactions.GEAR) {
              // allow for adding / removal of a playlist / queue
              await reaction.users.remove(user.id);
              const wasChanged = await addRemoveWizard(
                <TextChannel>message.channel,
                user,
                server,
                await getXdb2(server, sheetName, false),
                pageIndex,
                sheetName
              );
              if (wasChanged) sentMsg.edit({ embeds: [(await generateKeysEmbed(true)).build()] });
            }
          }
        });
        keysButtonCollector.once('end', () => {
          sentMsg.reactions.removeAll();
        });
      });
  }
}

/**
 * determines if the user would like to add or remove a playlist or key (depending on the argument 'type')
 * @param {*} channel the channel to send the message to.
 * @param {*} user the user who is adding or removing a playlist or key.
 * @param {*} server The server object.
 * @param {*} xdb The xdb object.
 * @param {*} pageIndex The index of the page to add or remove from.
 * @param {*} sheetName The name of the sheet to add or remove from.
 * @returns {boolean} True if the playlist or key was changed, false otherwise.
 */
async function addRemoveWizard(
  channel: TextChannel,
  user: User,
  server: LocalServer,
  xdb: any,
  pageIndex: number,
  sheetName: string
) {
  if (!user) return false;
  let type;
  let addFunction;
  let removeFunction;
  let selection;
  let renameFunction;
  if (pageIndex) {
    type = 'key';
    // if 0 then it is the playlist selection page
    const playlistName = xdb.playlistArray[pageIndex - 1];
    addFunction = async () => addKeyWizard(channel, user, server, xdb, playlistName, sheetName);
    removeFunction = async () => removeKeyWizard(channel, user, server, xdb, sheetName);
    renameFunction = async (oldName: string, newName: string) =>
      renameKey(channel, server, sheetName, oldName, newName);
    selection = `\`you are on the ${type} selection page (${playlistName.toUpperCase()}):\`\n`;
  } else {
    type = 'playlist';
    addFunction = async () => addPlaylistWizard(channel, user, server, xdb, sheetName);
    removeFunction = async () => removePlaylistWizard(channel, user, server, xdb, sheetName);
    renameFunction = async (oldName: string, newName: string) =>
      renamePlaylist(channel, server, sheetName, oldName, newName);
    selection = `*\`you are on the ${type} selection page:\`*\n`;
  }
  // the question to ask the user
  const q = `${selection}*Would you like to __add__, __delete__, or __rename__ a **${type}**? [or type 'q' to quit]*`;
  const sentMsg = await channel.send(q);
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  } else if (res.toLowerCase() === 'add') {
    await addFunction();
  } else if (res.toLowerCase() === 'delete') {
    await removeFunction();
  } else if (res.toLowerCase() === 'rename') {
    await renameWizard(channel, user, server, xdb, type, renameFunction);
  } else {
    channel.send('*cancelled*');
    return false;
  }
  return true;
}

/**
 * Asks a user to add a key to the keys list.
 * @param {*} channel the channel to send the message to.
 * @param {*} user the user who is adding a key.
 * @param {*} server The server object.
 * @param {*} xdb The xdb object.
 * @param {*} sheetName The name of the sheet to add to.
 * @returns {boolean} True if the key was added, false otherwise.
 */
async function addPlaylistWizard(channel: TextChannel, user: User, server: LocalServer, xdb: any, sheetName: string) {
  const sentMsg = await channel.send("*Type the __name__ of the **playlist** to add: [or type 'q' to quit]*");
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  }
  const existingPlaylist = xdb.playlists.get(res.toUpperCase());
  if (existingPlaylist) {
    channel.send('*playlist already exists*');
    return false;
  }
  xdb.playlists.set(res.toUpperCase(), new Map());
  xdb.playlistArray.push(res);
  await serializeAndUpdate(server, sheetName, res, xdb);
  channel.send('*added playlist to the sheet*');
  return true;
}

/**
 * Asks a user to remove a key from the keys list.
 * @param {*} channel the channel to send the message to.
 * @param {*} user the user who is removing a key.
 * @param {*} server The server object.
 * @param {*} xdb The xdb object.
 * @param {*} playlistName The name of the playlist to remove from.
 * @param {*} sheetName The name of the sheet to remove from.
 * @returns {boolean} True if the key was removed, false otherwise.
 */
async function addKeyWizard(
  channel: TextChannel,
  user: User,
  server: LocalServer,
  xdb: any,
  playlistName: string,
  sheetName: string
) {
  const existingPlaylist = xdb.playlists.get(playlistName.toUpperCase());
  if (!existingPlaylist) return false;
  const sentMsg = await channel.send("*Type the __name__ of the **key** to add: [or type 'q' to quit]*");
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  }
  const keyObj = xdb.globalKeys.get(res.toUpperCase());
  if (keyObj) {
    channel.send(`*key already exists in **${keyObj.playlistName}***`);
    return false;
  }
  const sentMsgLink = await channel.send("*Enter a __url__ to save [or type 'q' to quit]*");
  let resLink = await getMessageResponse(server, channel, user, sentMsgLink);
  if (!resLink) return false;
  if (resLink.toLowerCase() === 'q') {
    channel.send('*cancelled*');
    return -1;
  }
  resLink = universalLinkFormatter(resLink);
  if (linkValidator(resLink)) {
    existingPlaylist.set(res.toUpperCase(), { name: res, link: resLink, playlistName });
    await serializeAndUpdate(server, sheetName, playlistName, xdb);
    channel.send(`*added key to your **${playlistName}** playlist*`);
    return true;
  } else {
    channel.send('*invalid link provided*');
  }
}

/**
 * Asks a user to rename a key from the keys list.
 * @param channel the channel to send the message to.
 * @param user the user who is renaming a key.
 * @param server The server object.
 * @param xdb The xdb object.
 * @param type The type of key to rename.
 * @param renameFunction The function to call to rename the key.
 * @returns {boolean} True if the key was renamed, false otherwise.
 */
async function renameWizard(
  channel: TextChannel,
  user: User,
  server: LocalServer,
  xdb: any,
  type: string,
  renameFunction: any
) {
  const sentMsg = await channel.send(`*Type the __name__ of the **${type}** to rename: [or type 'q' to quit]*`);
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  }
  const sentMsgLink = await channel.send(`*Type the __new-name__ of the **${type}**: [or type 'q' to quit]*`);
  const resLink = await getMessageResponse(server, channel, user, sentMsgLink);
  if (!resLink) return;
  if (resLink.toLowerCase() === 'q') {
    channel.send('*cancelled*');
    return false;
  }
  renameFunction(res, resLink);
  return true;
}

/**
 * Asks a user to remove a key from the keys list.
 * @param channel the channel to send the message to.
 * @param user the user who is renaming a key.
 * @param server The server object.
 * @param xdb The xdb object.
 * @param sheetName The name of the sheet to remove from.
 * @returns {boolean} True if the key was remove, false otherwise.
 */
async function removeKeyWizard(channel: TextChannel, user: User, server: LocalServer, xdb: any, sheetName: string) {
  const sentMsg = await channel.send("*Type the __name__ of the **key** to delete: [or type 'q' to quit]*");
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  }
  const keyObj = xdb.globalKeys.get(res.toUpperCase());
  if (!keyObj) {
    channel.send('*key does not exists*');
    return false;
  }
  const pl = xdb.playlists.get(keyObj.playlistName.toUpperCase());
  if (pl) pl.delete(res.toUpperCase());
  await serializeAndUpdate(server, sheetName, keyObj.playlistName, xdb);
  channel.send(`*deleted key from your **${keyObj.playlistName}** playlist*`);
  return true;
}

/**
 * Asks a user to remove a playlist from the playlists list.
 * @param channel the channel to send the message to.
 * @param user the user who is removing a playlist.
 * @param server The server object.
 * @param xdb {playlists: Map, playlistArray: Array} The xdb object.
 * @param sheetName The name of the sheet to remove from.
 * @returns {boolean} True if the playlist was removed, false otherwise.
 */
async function removePlaylistWizard(
  channel: TextChannel,
  user: User,
  server: LocalServer,
  xdb: any,
  sheetName: string
): Promise<boolean> {
  const sentMsg = await channel.send("*Type the __name__ of the **playlist** to delete: [or type 'q' to quit]*");
  const res = await getMessageResponse(server, channel, user, sentMsg);
  if (!res) return false;
  if (res.toLowerCase() === 'q') {
    try {
      sentMsg.delete();
    } catch (e) {
      channel.send('*cancelled*');
    }
    return false;
  }
  await removePlaylist(server, sheetName, res, xdb, channel);
  return true;
}

/**
 * Asks a user to rename a playlist from the playlists list.
 * @param server The server object.
 * @param channel the channel to send the message to.
 * @param user the user who is renaming a playlist.
 * @param sentMsg The message to edit.
 * @returns {string | undefined} The message response or undefined.
 */
async function getMessageResponse(
  server: LocalServer,
  channel: TextChannel,
  user: User,
  sentMsg: Message
): Promise<string | undefined> {
  const filter = (m: Message) => {
    return user.id === m.author.id && sentMsg.deletable;
  };
  let res;
  try {
    server.activeUserQuestion.get(user.id)?.delete();
    server.activeUserQuestion.set(user.id, sentMsg);
    const messages = await sentMsg.channel.awaitMessages({ filter, time: 60000, max: 1, errors: ['time'] });
    res = messages.first()?.content.trim();
  } catch (e) {
    server.activeUserQuestion.get(user.id)?.delete();
  }
  server.activeUserQuestion.delete(user.id);
  return res;
}

export { runKeysCommand };
