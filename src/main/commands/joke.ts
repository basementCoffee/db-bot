import { load } from 'cheerio';
import fetch from 'isomorphic-unfetch';

/**
 * Gets a random joke from the internet.
 * @returns {Promise<string>} The joke.
 */
function getJoke(): Promise<string> {
  return new Promise((resolve) => {
    fetch('https://icanhazdadjoke.com/').then((response: any) => {
      response.text().then((htmlText: string) => {
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
