'use babel';

import {
    PlayerName,
    launchPlayer,
    play,
    getSpotifyDevices,
    playSpotifyPlaylist,
    playTrackInContext,
} from 'cody-music';
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID,
} from '../Constants';
import { MusicDataManager } from './MusicDataManager';
import KpmMusicManager from './KpmMusicManager';
import StructureView from './structure-view';

const commonUtil = require("../utils/CommonUtil");
const utilMgr = require('../managers/UtilManager');
const fileUtil = require("../utils/FileUtil");
const spotifyClient = require("./SpotifyClient");

const deviceMgr = {};

deviceMgr.launchTrackPlayer = async (playerName, callback = null) => {
    const {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
    } = deviceMgr.getDeviceSet();

    // if the player name is null, definitely check if there's an active or available device
    if (!playerName) {
        if (!activeDevice) {
            if (webPlayer) {
                playerName = PlayerName.SpotifyWeb;
            }
        } else if (activeDevice && activeWebPlayerDevice) {
            // it's an active web player device
            playerName = PlayerName.SpotifyWeb;
        }
    }
    if (!playerName) {
        playerName = PlayerName.SpotifyDesktop;
    }

    // spotify device launch error would look like this...
    // error:"Command failed: open -a spotify\nUnable to find application named 'spotify'\n"
    let result = await launchPlayer(playerName, { quietly: false });

    // test if there was an error, fallback to the web player
    if (
        playerName === PlayerName.SpotifyDesktop &&
        result &&
        result.error &&
        result.error.includes('failed')
    ) {
        utilMgr.notifyButton('Music Time', 'Desktop player is not installed.');
        // start the process of launching the web player
        playerName = PlayerName.SpotifyWeb;
        await launchPlayer(playerName, { quietly: false });
    }

    setTimeout(() => {
        deviceMgr.checkDeviceLaunch(playerName, 5, callback);
    }, 1500);
};

deviceMgr.launchConfirm = async callback => {
    const deviceId = await deviceMgr.getDeviceId();
    if (deviceId) {
        // play it
        if (callback) {
            return callback();
        }
    }

    const isPrem = MusicDataManager.getInstance().isSpotifyPremium;

    // ask to show the desktop if they're a premium user
    if (isPrem) {
        utilMgr.notifyButton(
            'Music Time',
            `Music Time requires a running Spotify player. Choose a player to launch.`,
            [
                {
                    className: 'btn btn-info',
                    text: 'Web Player',
                    onDidClick: async function() {
                        deviceMgr.launchTrackPlayer(
                            PlayerName.SpotifyWeb,
                            callback
                        );
                        utilMgr.clearNotification();
                    },
                },
                {
                    className: 'btn btn-info',
                    text: 'Desktop Player',
                    onDidClick: async function() {
                        deviceMgr.launchTrackPlayer(
                            PlayerName.SpotifyDesktop,
                            callback
                        );
                        utilMgr.clearNotification();
                    },
                },
            ]
        );
    } else {
        // it's a windows or non-premium user, launch spotify
        deviceMgr.launchTrackPlayer(PlayerName.SpotifyDesktop, callback);
    }
};

deviceMgr.checkDeviceLaunch = async (
    playerName,
    tries = 5,
    callback = null
) => {
    setTimeout(async () => {
        await deviceMgr.populateSpotifyDevices();
        const devices = MusicDataManager.getInstance().currentDevices;

        const hasDevices = devices && devices.length ? true : false;
        if (!hasDevices && tries > 0) {
            tries--;
            deviceMgr.checkDeviceLaunch(playerName, tries, callback);
        } else {
            // it should only have either the desktop or web device available
            // since this is part of the check device launch path
            if (!hasDevices) {
                utilMgr.notify(
                    'Music Time',
                    'Unable to establish a device connection. Please check that you are logged into your Spotify account.'
                );
            } else {

                atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'Music-Time:refreshDeviceInfo'
                );

                if (callback) {
                    setTimeout(async () => {
                        callback();
                    }, 1200);
                }
            }
        }
    }, 2000);
};

/**
 * Play a track from either:
 * Recommendations
 * Liked Songs
 * Or a named playlist
 **/
deviceMgr.playTrack = async () => {
    // this will fetch the selected playlist ID and track ID
    const playlistId = localStorage.getItem('_selectedPlaylistId');
    const trackId = localStorage.getItem('_selectedPlaylistTrackId');

    let result = null;
    if (
        playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID ||
        playlistId === SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
    ) {
        // play the liked song or recommendation song
        const isLikedSong = playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
        result = await deviceMgr.playRecommendationsOrLikedSongsByPlaylist(
            trackId,
            isLikedSong
        );
    } else {
        // play the track using the playlist id
        result = await deviceMgr.playPlaylistTrack(playlistId, trackId);
    }

    setTimeout(() => {
        KpmMusicManager.getInstance().fetchTrack();
    }, 1000);

};

deviceMgr.playPlaylistTrack = async (playlistId, trackId) => {
    const dataMgr = MusicDataManager.getInstance();
    const deviceId = deviceMgr.getDeviceId();

    const playerName = dataMgr.isSpotifyPremium || !commonUtil.isMac()
        ? PlayerName.SpotifyWeb
        : PlayerName.SpotifyDesktop;

    let result;
    if (playerName === PlayerName.SpotifyDesktop) {
        const trackUri = utilMgr.createUriFromTrackId(trackId);
        const playlistUri = utilMgr.createUriFromPlaylistId(playlistId);
        const params = [trackUri, playlistUri];
        result = await playTrackInContext(playerName, params);
    } else {
        result = await playSpotifyPlaylist(playlistId, trackId, deviceId);
        await spotifyClient.checkIfAccessExpired(result);

        commonUtil.handlePlaybackError(result);
    }

    return result;
};

deviceMgr.playRecommendationsOrLikedSongsByPlaylist = async (
    trackId,
    isLikedSong
) => {
    const dataMgr = MusicDataManager.getInstance();
    const device_id = deviceMgr.getDeviceId();

    let offset = 0;
    let track_ids = [];
    if (!isLikedSong) {
        // RECOMMENDATION track request
        // get the offset of this track
        offset = dataMgr.recommendationTracks.findIndex(t => trackId === t.id);
        // play the list of recommendation tracks
        track_ids = dataMgr.recommendationTracks.map(t => t.id);

        // make it a list of 50, so get the rest from trackIdsForRecommendations
        const otherTrackIds = dataMgr.trackIdsForRecommendations.filter(
            t => !track_ids.includes(t)
        );
        const spliceLimit = 50 - track_ids.length;
        const addtionalTrackIds = otherTrackIds.splice(0, spliceLimit);
        track_ids.push(...addtionalTrackIds);
    } else {
        offset = dataMgr.spotifyLikedSongs.findIndex(t => trackId === t.id);
        // play the list of recommendation tracks
        track_ids = dataMgr.spotifyLikedSongs.map(t => t.id);
        // trim it down to 50
        track_ids = track_ids.splice(0, 50);
    }

    const options = {
        device_id,
        track_ids,
        offset,
    };

    const playerName = dataMgr.isSpotifyPremium || !commonUtil.isMac()
        ? PlayerName.SpotifyWeb
        : PlayerName.SpotifyDesktop;

    let result;
    if (playerName === PlayerName.SpotifyDesktop) {
        const trackUri = utilMgr.createUriFromTrackId(trackId);
        const params = [trackUri];
        result = await playTrackInContext(playerName, params);
    } else {
        result = await play(playerName, options);
        await spotifyClient.checkIfAccessExpired(result);
        commonUtil.handlePlaybackError(result);
    }
    return result;
};

deviceMgr.getDeviceId = () => {
    const {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
    } = deviceMgr.getDeviceSet();

    const deviceId = activeDevice
        ? activeDevice.id
        : desktop
            ? desktop.id
            : webPlayer
                ? webPlayer.id
                : '';
    return deviceId;
};

deviceMgr.getDeviceSet = () => {
    const devices = MusicDataManager.getInstance().currentDevices || [];
    const webPlayer = devices.find(d =>
        d.name.toLowerCase().includes('web player')
    );

    const desktop = devices.find(
        d =>
            d.type.toLowerCase() === 'computer' &&
            !d.name.toLowerCase().includes('web player')
    );

    const activeDevice = devices.find(d => d.is_active);

    const activeComputerDevice = devices.find(
        d => d.is_active && d.type.toLowerCase() === 'computer'
    );

    const activeWebPlayerDevice = devices.find(
        d =>
            d.is_active &&
            d.type.toLowerCase() === 'computer' &&
            d.name.toLowerCase().includes('web player')
    );

    return {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
    };
};

deviceMgr.populateSpotifyDevices = async (forceRefresh) => {
    const requiresAccess = fileUtil.requiresSpotifyAccess();
    if (!requiresAccess && (!deviceMgr.getDeviceId() || forceRefresh)) {
        const devices = await getSpotifyDevices();
        MusicDataManager.getInstance().currentDevices = devices;
        const structureViewObj = StructureView.getInstance();
        structureViewObj.updateDevice();
    }
};

deviceMgr.reconcileDevices = async () => {
    // if no devices and they have access, call populateSpotifyDevices
    const requiresAccess = fileUtil.requiresSpotifyAccess();
    if (requiresAccess) {
        // skip, they're not currently connected
        return;
    }
    const deviceId = deviceMgr.getDeviceId();
    if (!deviceId) {
        await deviceMgr.populateSpotifyDevices();
    } else {
        // deviceId is available, check if the track is playing
        const dataMgr = MusicDataManager.getInstance();
        if (!dataMgr.runningTrack || !dataMgr.runningTrack.id) {
            // no track currently playing, check if the device is still available
            await deviceMgr.populateSpotifyDevices();
        }
    }
}

deviceMgr.getActiveSpotifyDevicesButton = async () => {
    const dataMgr = MusicDataManager.getInstance();
    const devices = dataMgr.currentDevices;
    if (!devices) {
        return false;
    }

    const {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
    } = deviceMgr.getDeviceSet();

    let msg = '';
    let tooltip = 'Listening on a Spotify device';
    if (activeDevice) {
        if (
            activeDevice.type.toLowerCase() === 'computer' &&
            activeDevice.name.toLowerCase().includes('web player') &&
            !dataMgr.isSpotifyPremium
        ) {
            msg = 'Connect to a Spotify device';
            tooltip = 'Click to launch the web or desktop player';
        } else {
            // found an active device
            msg = `Listening on ${activeDevice.name}`;
        }
    } else if (webPlayer) {
        // show that the web player is an active device
        msg = `Listening on ${webPlayer.name}`;
    } else if (desktop) {
        // show that the desktop player is an active device
        msg = `Listening on ${desktop.name}`;
    } else if (devices.length && dataMgr.isSpotifyPremium) {
        // no active device but found devices
        const names = devices.map(d => d.name);
        msg = `Spotify devices available`;
        tooltip = `Multiple devices available: ${names.join(', ')}`;
    } else if (devices.length === 0 || !dataMgr.isSpotifyPremium) {
        // no active device and no devices
        msg = 'Connect to a Spotify device';
        tooltip = 'Click to launch the web or desktop player';
    }

    return {
        title: msg,
        tooltip: tooltip,
        deviceCount: devices.length,
    };
};

module.exports = deviceMgr;
