'use babel';

import {
    PlayerName,
    launchPlayer,
    transferSpotifyDevice,
    play,
    getSpotifyDevices,
    playSpotifyPlaylist,
} from 'cody-music';
import {
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID,
} from '../Constants';
import { MusicDataManager } from './MusicDataManager';

const utilMgr = require('../UtilManager');

const deviceMgr = {};

deviceMgr.launchTrackPlayer = async (playerName, callback = null) => {
    const {
        webPlayer,
        desktop,
        activeDevice,
        activeComputerDevice,
        activeWebPlayerDevice,
    } = deviceMgr.getDeviceSet();

    console.log('active device: ', activeDevice);

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
        deviceMgr.checkDeviceLaunch(playerName, 7, callback);
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
        if ((!devices || devices.length == 0) && tries > 0) {
            tries--;
            deviceMgr.checkDeviceLaunch(playerName, tries, callback);
        } else {
            // it should only have either the desktop or web device available
            // since this is part of the check device launch path
            const deviceId = deviceMgr.getDeviceId();

            const {
                webPlayer,
                desktop,
                activeDevice,
                activeComputerDevice,
                activeWebPlayerDevice,
            } = deviceMgr.getDeviceSet();

            if (!activeComputerDevice && !activeWebPlayerDevice) {
                // transfer to the device
                await transferSpotifyDevice(deviceId, false);
            }

            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:refreshDeviceInfo'
            );

            if (callback) {
                setTimeout(async () => {
                    callback();
                }, 1000);
            }
        }
    }, 1500);
};

/**
 * Play a track from either:
 * Recommendations
 * Liked Songs
 * Or a named playlist
 **/
deviceMgr.playTrack = () => {
    // this will fetch the selected playlist ID and track ID
    const playlistId = localStorage.getItem('_selectedPlaylistId');
    const trackId = localStorage.getItem('_selectedPlaylistTrackId');

    if (
        playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID ||
        playlistId === SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
    ) {
        // play the liked song or recommendation song
        const isLikedSong = playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
        deviceMgr.playRecommendationsOrLikedSongsByPlaylist(
            trackId,
            isLikedSong
        );
    } else {
        // play the track using the playlist id
        deviceMgr.playPlaylistTrack(playlistId, trackId);
    }
};

deviceMgr.playPlaylistTrack = async (playlistId, trackId) => {
    const deviceId = deviceMgr.getDeviceId();
    await playSpotifyPlaylist(playlistId, trackId, deviceId);
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

    // console.log('options: ', options);

    const result = await play(PlayerName.SpotifyWeb, options);

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

deviceMgr.populateSpotifyDevices = async () => {
    if (!deviceMgr.getDeviceId()) {
        const devices = await getSpotifyDevices();
        MusicDataManager.getInstance().currentDevices = devices;
    }
};

module.exports = deviceMgr;
