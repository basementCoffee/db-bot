const SpotifyWebApi = require('spotify-web-api-node');
const { logError } = require('../utils');


class SpotifyApi {
  // Date.now of when the token will expire
  expiryDateMS;
  // spotify-web-api-node object
  _spotifyApiNode;

  constructor() {
    // Set up the Spotify Web API client with your client ID and secret
    this._spotifyApiNode = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_SECRET_CLIENT_ID,
    });
    this.expiryDateMS = 0;
    this.#authenticate().catch((e) => {
      const errMsg = `[ERROR][id: ${process.pid.toString()}] Missing spotify token credentials.\n${e.stack}`;
      logError(errMsg);
    });
  }

  /**
   * Authenticates spotify-web-api-node.
   * @returns {Promise<boolean>} Whether the request was successful.
   */
  async #authenticate() {
    try {
      const data = await this._spotifyApiNode.clientCredentialsGrant();
      this._spotifyApiNode.setAccessToken(data.body.access_token);
      // 3600ms is the usual expiry time
      this.expiryDateMS = (Date.now() + (data.body.expires_in || 3600)) - 5000;
      return true;
    }
    catch (e) {
      return false;
    }
  }

  /**
   * Returns an authenticated spotifyApiNode.
   * @returns {Promise<SpotifyWebApi>} The SpotifyWebApi object.
   */
  async getSpotifyApiNode() {
    if (Date.now() > this.expiryDateMS) {
      await this.#authenticate();
    }
    return this._spotifyApiNode;
  }
}

module.exports = new SpotifyApi();
