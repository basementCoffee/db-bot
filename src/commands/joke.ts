import { load } from 'cheerio';

/**
 * Gets a random joke from the internet.
 * @returns {Promise<string>} The joke.
 */
function getJoke() {
  return new Promise((resolve) => {
    fetch('https://icanhazdadjoke.com/').then((response) => {
      response.text().then((htmlText) => {
        // parse html
        const $ = load(htmlText);
        let val = $('p').text();
        val = val.substring(0, val.indexOf('icanhazdadjoke.com'));
        resolve(val);
      });
    });
  });
}

export { getJoke };
