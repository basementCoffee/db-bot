const {botInVC} = require('../utils/utils');

/**
 * Mutates the provided array by moving an element at posA to posB.
 * @param message The message object.
 * @param arr The array.
 * @param posA The first position.
 * @param posB THe second position.
 * @return {void}
 */
function runMoveItemCommand (message, arr, posA, posB) {
  if (!botInVC(message)) return;
  posA = Math.floor(posA);
  posB = Math.floor(posB);
  const MIN_POS = 1;
  const MIN_ARR_SIZE = 3;
  if (!(posA && posB)) message.channel.send(
    '*two numbers expected: the position of the item to move and it\'s new position*\n`ex: move 1 5`');
  else if (arr.length < MIN_ARR_SIZE) message.channel.send('*not enough items in the queue*');
  else if (posA < MIN_POS || posB < MIN_POS) {
    message.channel.send(`positions must be greater than ${MIN_POS - 1}`);
  } else {
    if (posA > arr.length - 1) posA = arr.length - 1;
    if (posB > arr.length - 1) posB = arr.length - 1;
    const item = arr.splice(posA, 1)[0];
    arr.splice(posB, 0, item);
    message.channel.send(`*moved item to position ${posB}*`);
  }
}

module.exports = {runMoveItemCommand};