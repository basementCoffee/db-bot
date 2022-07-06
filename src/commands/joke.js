const request = require('request');
const cheerio = require('cheerio');

/**
 * Gets a random joke from the internet.
 * @returns {Promise<string>} The joke.
 */
function getJoke() {
  return new Promise((resolve, reject) => {
    request('https://icanhazdadjoke.com/', (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        // parse html
        const $ = cheerio.load(body);
        let val = $('p').text();
        val = val.substring(0, val.indexOf('icanhazdadjoke.com'));
        resolve(val);
      }
    });
  });
}

module.exports = {getJoke};
