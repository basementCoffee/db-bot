const cheerio = require('cheerio');

/**
 * Gets a random joke from the internet.
 * @returns {Promise<string>} The joke.
 */
function getJoke() {
  return new Promise((resolve, reject) => {
    fetch('https://icanhazdadjoke.com/').then((response) => {
      response.text().then((htmlText) => {
        // parse html
        const $ = cheerio.load(htmlText);
        let val = $('p').text();
        val = val.substring(0, val.indexOf('icanhazdadjoke.com'));
        resolve(val);
      });
    });
  });
}

module.exports = { getJoke };
