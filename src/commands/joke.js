

const request = require('request');
const cheerio = require('cheerio');


function getJoke() {
    return new Promise((resolve, reject) => {
      request('https://icanhazdadjoke.com/', (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          // parse html 
          const $ = cheerio.load(body);
          let val = $('p').text();
          console.log(val);
          val = val.substring(0, val.indexOf('icanhazdadjoke.com'));
          resolve(val);
  
        }
      });
    });
  }

    module.exports = {getJoke};