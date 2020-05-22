'use babel';

import { accessExpired, getUserProfile } from 'cody-music';
import KpmMusicControlManager from './KpmMusicControlManager';
import StructureView from './structure-view';
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    api_endpoint,
    DISCONNECT_SLACK_MENU_LABEL,
    CONNECT_SLACK_MENU_LABEL,
    WEB_SLACK_COMMAND_KEY,
    CONNECT_SPOTIFY_MENU_LABEL,
    DISCONNECT_SPOTIFY_MENU_LABEL,
    CONNECT_SPOTIFY_COMMAND_KEY,
    MUSIC_DASHBOARD_LABEL,
    PERSONAL_TOP_SONGS_NAME,
    SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID,
    CLOSE_BOX,
    LIKE_ICON,
    LIKE_ICON_OUTLINE,
} from '../Constants';
import {
    isResponseOk,
    softwarePut,
    softwareGet
} from '../HttpClient';
import $ from 'jquery';

const fileUtil = require("../FileUtil");
const utilMgr = require("../UtilManager");
const codyMusicMgr = require('../CodyMusicManager');
const slackClient = require("./SlackClient");

const spotifyClient = {};

let spotifyUser = null;

spotifyClient.getSpotifyUser = () => {
  return spotifyUser;
}

spotifyClient.setSpotifyUser = (user) => {
  spotifyUser = user;
}

/**
 * Used to execute any spotify function with arguments (if provided)
 **/
spotifyClient.runSpotifyCommand = async (fnc, args = null) => {
    let result = null;
    if (args && args.length) {
        result = await fnc(...args);
    } else {
        result = await fnc();
    }
    if (isTooManyRequestsError(result)) {
        return { status: 429 };
    }
    return result;
};

function isTooManyRequestsError(result) {
    return getResponseStatus(result) === 429 ? true : false;
}

spotifyClient.checkIfAccessExpired = async (result) => {
    if (getResponseStatus(result) === 401) {
        // check to see if they still have their access token
        const spotifyAccessToken = fileUtil.getItem("spotify_access_token");
        if (spotifyAccessToken && accessExpired()) {
            // remove their current spotify info and initiate the auth flow
            spotifyClient.disconnectSpotify(false);
        }
    }
}

function getResponseStatus(resp) {
    if (resp && resp.status) {
        return resp.status;
    } else if (resp && resp.data && resp.data.status) {
        return resp.data.status;
    } else if (
        resp &&
        resp.error &&
        resp.error.response &&
        resp.error.response.status
    ) {
        return resp.error.response.status;
    }
    return 200;
}

spotifyClient.disconnectSpotify = async (confirm = true) => {
    const structureViewObj = StructureView.getInstance();
    structureViewObj.showLoader(false, true);
    await spotifyClient.disconnectOauth('Spotify', confirm);
    structureViewObj.toggleDeviceStatus(true);
    structureViewObj.toggleRefreshTreeview(true);
    structureViewObj.toggleRecommendTreeview(true);
    structureViewObj.toggleWebAnalytics(true);
    structureViewObj.toggleSortDev(true);
    structureViewObj.toggleLikeButton(true);
    structureViewObj.toggleOpenDashboard(true);
    $('loaderdiv');
    $('.divider').hide();
}

spotifyClient.disconnectOauth = async (type, confirmDisconnect = true) => {
    const structureViewObj = StructureView.getInstance();

    let confirm = true;

    if (confirmDisconnect) {
        confirm = window.confirm(
            `Are you sure you want to disconnect ${type}?`
        );
    }

    if (confirm) {
        const type_lc = type.toLowerCase();
        let result = await softwarePut(
            `/auth/${type_lc}/disconnect`,
            {},
            fileUtil.getItem('jwt')
        );

        if (isResponseOk(result)) {
            // oauth is not null, initialize spotify
            if (type_lc === 'slack') {
                await slackClient.updateSlackAccessInfo(null);
                utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
                utilMgr.addMusicMenuItem(
                    CONNECT_SLACK_MENU_LABEL,
                    WEB_SLACK_COMMAND_KEY
                );
                utilMgr.clearNotification();
            } else if (type_lc === 'spotify') {
                structureViewObj.hideLoader();
                await spotifyClient.updateSpotifyAccessInfo(null);

                const connectLabel = fileUtil.requiresSpotifyReAuthentication()
                  ? "Reconnect Spotify" : "Connect Spotify";

                $('#spotify-status').text('Spotify Premium required');
                $('#spotify-disconnect').hide();
                $('#spotify-connect').text(connectLabel);
                $('#spotify-connect').show();
                $('#spotify-status').hide();
                $('#spotify-refresh-playlist').hide();
                $('#account-status-href').hide();

                atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'Music-Time:clearTreeView'
                );
                atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'Music-Time:clearFooterStatus'
                );

                utilMgr.removeMusicMenuItem(DISCONNECT_SPOTIFY_MENU_LABEL);
                utilMgr.addMusicMenuItem(
                    CONNECT_SPOTIFY_MENU_LABEL,
                    CONNECT_SPOTIFY_COMMAND_KEY
                );
                utilMgr.removeMusicMenuItem(MUSIC_DASHBOARD_LABEL);
                utilMgr.removeMusicMenuItem(CONNECT_SLACK_MENU_LABEL);
                utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
                utilMgr.clearNotification();
            }
        }
    } else {
        return false;
    }
};

spotifyClient.updateSpotifyAccessInfo = async (spotifyOauth) => {
    if (spotifyOauth) {
        // update the CodyMusic credentials
        codyMusicMgr.updateCodyConfig(
            spotifyOauth.access_token,
            spotifyOauth.refresh_token
        );

        fileUtil.setItem("requiresSpotifyReAuth", null);

        if (!spotifyUser || !spotifyUser.uri) {
            await spotifyClient.populateSpotifyUserProfile();
        }
    } else {
        spotifyClient.clearSpotifyAccessInfo();
    }
};

spotifyClient.getMusicTimeUserStatus = async () => {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = fileUtil.getItem('jwt');
    const spotify_refresh_token = fileUtil.getItem('spotify_refresh_token');

    const api = '/users/plugin/state';
    const additionalHeaders = spotify_refresh_token
        ? { spotify_refresh_token }
        : null;
    const resp = await softwareGet(api, jwt, additionalHeaders);
    if (isResponseOk(resp) && resp.data) {
        // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
        const state = resp.data.state ? resp.data.state : 'UNKNOWN';
        if (state === 'OK') {
            /**
             * stateData only contains:
             * {email, jwt, state}
             */
            const stateData = resp.data;
            const sessionEmail = fileUtil.getItem('name');
            if (sessionEmail !== stateData.email) {
                fileUtil.setItem('name', stateData.email);
            }
            // check the jwt
            if (stateData.jwt && stateData.jwt !== jwt) {
                // update it
                fileUtil.setItem('jwt', stateData.jwt);
            }

            // get the user from the payload
            const user = resp.data.user;
            let foundSpotifyAuth = false;

            if (user.auths && user.auths.length > 0) {
                for (let i = 0; i < user.auths.length; i++) {
                    const auth = user.auths[i];

                    // update the spotify access info if the auth matches
                    if (auth.type === 'spotify' && auth.access_token) {
                        foundSpotifyAuth = true;
                        // update spotify access info
                        await spotifyClient.updateSpotifyAccessInfo(auth);
                        break;
                    }
                }
            }

            return { loggedOn: foundSpotifyAuth, state };
        }
        // return the state that is returned
        return { loggedOn: false, state };
    }
    return { loggedOn: false, state: 'UNKNOWN' };
};

spotifyClient.populateSpotifyUserProfile = async () => {
    const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
    if (!requiresSpotifyAccess && (!spotifyUser || !spotifyUser.uri)) {
        // get the user
        spotifyUser = await getUserProfile();
        await spotifyClient.checkIfAccessExpired(spotifyUser);
    }
    return spotifyUser;
};

spotifyClient.clearSpotifyAccessInfo = () => {
    // clear spotify access
    codyMusicMgr.clearSpotifyAccess();
    spotifyUser = null;
};

spotifyClient.refetchSpotifyConnectStatusLazily = async (tryCountUntilFound = 20) => {
    const structureViewObj = StructureView.getInstance();
    structureViewObj.showLoader();
    setTimeout(() => {
        spotifyClient.spotifyConnectStatusHandler(tryCountUntilFound);
    }, 10000);
};

spotifyClient.spotifyConnectStatusHandler = async (tryCountUntilFound) => {
    const oauthResult = await spotifyClient.getMusicTimeUserStatus();

    if (!oauthResult.loggedOn) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            setTimeout(() => {
                spotifyClient.refetchSpotifyConnectStatusLazily(tryCountUntilFound);
            }, 1000);
        } else {
            // make sure the tree view stops showing the refreshing
            const structureViewObj = StructureView.getInstance();
            structureViewObj.refreshTreeView();
        }
    } else if (tryCountUntilFound > 0 && oauthResult.loggedOn) {
        tryCountUntilFound = 0;

        utilMgr.updateLoginPreference(true);

        utilMgr.notify(
            'Music Time',
            `Successfully connected to Spotify. Loading playlists...`
        );

        // populate the liked songs and send them as the seed data
        await utilMgr.seedLikedSongsInitiate();

        await spotifyClient.initializeSpotify();

        setTimeout(() => {
            utilMgr.clearNotification();
        }, 2000);
    }
};

spotifyClient.initializeSpotify = async () => {
    localStorage.setItem('_selectedPlaylistId', '');
    // initialize cody music
    await codyMusicMgr.initializeCodyConfig();

    const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
    if (requiresSpotifyAccess) {
        // get the music time user status
        await spotifyClient.getMusicTimeUserStatus();
    } else {
        // check to see if re-auth is required
        // this should only be done after we've updated the cody config
        const requiresReAuth = await spotifyClient.requiresReAuthentication();
        if (requiresReAuth) {
            // remove their current spotify info and initiate the auth flow
            await spotifyClient.disconnectSpotify(false);

            const email = fileUtil.getItem("name");
            const reconnectButtonLabel = "Reconnect";
            const confirm = window.confirm(
                msg
            );

            if (confirm) {
                // now launch re-auth
                await KpmMusicControlManager.getInstance().connectSpotify();
            }
        } else {
            const structureViewObj = StructureView.getInstance();
            structureViewObj.preInitialize();
            // initialize the user and devices
            await spotifyClient.populateSpotifyUserProfile();

            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:refresh-treeview'
            );

            setTimeout(() => {
                utilMgr.updateLoginPreference(true);
            }, 4000);
        }
    }
}

spotifyClient.requiresReAuthentication = async () => {
    const checkedSpotifyAccess = fileUtil.getItem("atom_checkedSpotifyAccess");
    const hasAccessToken = fileUtil.getItem("spotify_access_token");
    if (!checkedSpotifyAccess && hasAccessToken) {
        fileUtil.setItem("atom_checkedSpotifyAccess", true);
        fileUtil.setItem("requiresSpotifyReAuth", true);
        spotifyClient.clearSpotifyAccessInfo();
        return await accessExpired();
    }
    return false;
}

module.exports = spotifyClient;
