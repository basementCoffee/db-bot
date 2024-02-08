import { Message } from 'discord.js';
import { bot } from '../../utils/lib/constants';
import processStats from '../../utils/lib/ProcessStats';
const { exec } = require('child_process');

/**
 * Manages a custom or PM2 update command. Does not work with the heroku process.
 * Provided arguments must start with a keyword. If the first argument is 'custom' then processes a custom command.
 * If it is 'all' then restarts both PM2 processes. Providing an invalid first argument would void the update.
 * An empty argument array represents a standard update.
 * @param message {Message} Optional - The message that triggered the bot.
 * @param args {Array<string>?} Optional - arguments for the command.
 */
export function devUpdateCommand(message?: Message, args: Array<string> = []) {
  let response = 'updating process...';
  if (args[0]?.toLowerCase() === 'force') {
    if (bot.voice.adapters.size > 0) {
      message?.channel.send(
        '***people are using the bot:*** *to force an update type `force` immediately after the command*'
      );
      return;
    }
    args.splice(0, 1);
  }
  if (!args[0]) {
    args[0] = 'default';
  } else {
    response += ` (${args[0]})`;
  }
  switch (args[0]) {
    case 'default':
      processStats.setProcessInactive();
      exec('git stash && git pull');
      setTimeout(() => {
        exec('npm run pm2');
      }, 5000);
      break;
    case 'update':
    case 'upgrade':
      processStats.setProcessInactive();
      exec(`git stash && git pull && npm ${args[0]}`);
      setTimeout(() => {
        exec('npm run pm2');
      }, 5000);
      break;
    case 'all':
      processStats.setProcessInactive();
      exec('pm2 update pm2');
      break;
    case 'custom':
      if (args[1]) {
        exec(args.slice(1).join(' '));
      } else {
        response = "*must provide script after 'custom'*";
      }
      break;
    default:
      response = '*incorrect argument provided*';
  }
  message?.channel.send(response);
  console.log(response);
}
