import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';
import { botInVC } from '../../../utils/utils';
import { formatDuration } from '../../../utils/formatUtils';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;

  // assume that there is something playing
  if (botInVC(message)) {
    if (server.audio.isVoiceChannelMember(message.member!)) {
      const MIN_SYNC_SECONDS = 7;
      const MAX_SYNC_SECONDS = 60;
      let seconds = MIN_SYNC_SECONDS;
      if (event.args[0]) {
        seconds = parseInt(event.args[0]);
        if (!seconds || seconds < MIN_SYNC_SECONDS) seconds = MIN_SYNC_SECONDS;
        else if (seconds > MAX_SYNC_SECONDS) seconds = MAX_SYNC_SECONDS;
      }
      const playArgs = [message, message.member, server, true, false, true];
      commandHandlerCommon.pauseStream(...(playArgs as [any, any, any, any, any, any]));
      const streamTime = server.audio.resource?.playbackDuration;
      if (!streamTime) return message.channel.send('*could not find a valid stream time*');
      // the seconds shown to the user (added 1 to get user ahead of actual stream)
      const streamTimeSeconds = ((streamTime / 1000) % 60) + 1;
      // the formatted duration (with seconds supposed to be replaced)
      const duration = formatDuration(streamTime);
      const vals = duration.split(' ');
      // if the stream is close to next second (7 represents the tenth's place)
      const isClose = +streamTimeSeconds.toString().split('.')[1][0] > 7;
      if (!vals.slice(-1)[0].includes('s')) vals.push(`${Math.floor(streamTimeSeconds)}s`);
      else vals[vals.length - 1] = `${Math.floor(streamTimeSeconds)}s`;
      const syncMsg = await message.channel.send(
        `timestamp is **${vals.join(' ')}**` + `\naudio will resume when I say 'now' (~${seconds} seconds)`
      );
      // convert seconds to ms and add another second
      const syncTimeMS = seconds * 1000 + 1000;
      setTimeout(async () => {
        if (!server.audio.status) {
          const newMsgStr = `timestamp is **${vals.join(' ')}**` + '\n***---now---***';
          if (isClose) await syncMsg.edit(newMsgStr);
          else syncMsg.edit(newMsgStr);
          commandHandlerCommon.resumeStream(...(playArgs as [any, any, any, any, any, any]));
          setTimeout(() => {
            if (syncMsg.deletable) syncMsg.delete();
          }, 5000);
        }
      }, syncTimeMS);
    } else {
      message.channel.send('no active link is playing');
    }
  }
};
