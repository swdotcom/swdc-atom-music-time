'use babel';

import { MusicDataManager } from './music/MusicDataManager';
import {
    isResponseOk,
    softwareGet,
    softwarePut,
    softwareDelete,
} from './HttpClient';
import { setConfig, CodyConfig } from 'cody-music';

const fileUtil = require('./FileUtil');

const codyMusicMgr = {};

let dataMgr = null;

codyMusicMgr.initializeCodyConfig = async () => {
    if (!dataMgr) {
        dataMgr = MusicDataManager.getInstance();
    }

    if (!dataMgr.spotifyClientId) {
        // get the client id and secret
        const jwt = fileUtil.getItem('jwt');

        const resp = await softwareGet('/auth/spotify/clientInfo', jwt);
        if (isResponseOk(resp)) {
            // get the clientId and clientSecret
            dataMgr.spotifyClientId = resp.data.clientId;
            dataMgr.spotifyClientSecret = resp.data.clientSecret;
        }
    }

    const accessToken = fileUtil.getItem('spotify_access_token');
    const refreshToken = fileUtil.getItem('spotify_refresh_token');

    codyMusicMgr.updateCodyConfig(accessToken, refreshToken);
};

codyMusicMgr.clearSpotifyAccess = () => {
    codyMusicMgr.updateCodyConfig(null, null);
};

codyMusicMgr.updateCodyConfig = async (accessToken, refreshToken) => {
    if (!dataMgr) {
        await codyMusicMgr.initializeCodyConfig();
    }

    // update requiresSpotifyReAuth
    const existingAccessToken = fileUtil.getItem("spotify_access_token");
    if (!accessToken && existingAccessToken) {
        // update requiresSpotifyReAuth
        fileUtil.setItem("requiresSpotifyReAuth", true);
    }

    fileUtil.setItem('spotify_access_token', accessToken);
    fileUtil.setItem('spotify_refresh_token', refreshToken);

    const codyConfig = new CodyConfig();
    codyConfig.enableItunesDesktop = false;
    codyConfig.enableItunesDesktopSongTracking = fileUtil.isMac();
    codyConfig.enableSpotifyDesktop = fileUtil.isMac();
    codyConfig.spotifyClientId = dataMgr.spotifyClientId;
    codyConfig.spotifyAccessToken = accessToken;
    codyConfig.spotifyRefreshToken = refreshToken;
    codyConfig.spotifyClientSecret = dataMgr.spotifyClientSecret;
    setConfig(codyConfig);
};

module.exports = codyMusicMgr;
