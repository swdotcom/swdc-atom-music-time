'use babel';
import {
    PlayerName,
    PlaylistItem,
    Track,
    PlayerDevice,
    CodyConfig,
    setConfig
} from "cody-music";
const utilMgr = require('../UtilManager');

export class MusicDataManager {
    
    constructor() {
        //
    }
    static getInstance() {
        if (!MusicDataManager.instance) {
            MusicDataManager.instance = new MusicDataManager();
        }

        return MusicDataManager.instance;
    }

    /**
     * Get the current player: spotify-web or itunes
     */
    get currentPlayerName() {
        return this._currentPlayerName;
    }

    set currentPlayerName(playerName) {
        // override any calls setting this to spotify desktop back to spotify-web
        if (playerName === PlayerName.SpotifyDesktop) {
            playerName = PlayerName.SpotifyWeb;
        }

        // check if it's change in player type
        const shouldUpdateCodyConfig =
            playerName !== this._currentPlayerName ? true : false;
        this._currentPlayerName = playerName;

        // if it's a player type change, update cody config so it
        // can disable the other player until it is selected
        if (shouldUpdateCodyConfig) {
            this.updateCodyConfig();
        }
    }

    /**
     * Update the cody config settings for cody-music
     */
    updateCodyConfig() {
        const accessToken = utilMgr.getItem("spotify_access_token");
        const refreshToken = utilMgr.getItem("spotify_refresh_token");

        const codyConfig = new CodyConfig();
        codyConfig.enableItunesDesktop = false;
        codyConfig.enableItunesDesktopSongTracking = utilMgr.isMac();
        codyConfig.enableSpotifyDesktop = utilMgr.isMac();
        codyConfig.spotifyClientId = this.spotifyClientId;
        codyConfig.spotifyAccessToken = accessToken;
        codyConfig.spotifyRefreshToken = refreshToken;
        codyConfig.spotifyClientSecret = this.spotifyClientSecret;
        setConfig(codyConfig);
    }

    removeTrackFromRecommendations(trackId) {
        let foundIdx = -1;
        for (let i = 0; i < this.recommendationTracks.length; i++) {
            if (this.recommendationTracks[i].id === trackId) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx > -1) {
            // splice it out
            this.recommendationTracks.splice(foundIdx, 1);
        }

        if (this.recommendationTracks.length < 2) {
            // refresh
            commands.executeCommand("musictime.refreshRecommendations");
        }
    }
}
