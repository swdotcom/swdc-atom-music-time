'use babel';

import * as spotify from 'spotify-node-applescript';
import * as itunes from 'itunes-node-applescript';


import KeystrokeManager from '../KeystrokeManager';
const utilMgr = require('../UtilManager');
const offlineMgr = require('../OfflineManager');
const moment = require('moment-timezone');
let lastDayOfMonth = -1;
import $ from 'jquery';
import StructureView from './structure-view';
import {
    PERSONAL_TOP_SONGS_NAME,
    SOFTWARE_TOP_SONGS_NAME,
    PERSONAL_TOP_SONGS_PLID,
    SOFTWARE_TOP_SONGS_PLID,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    LOGIN_LABEL,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    PAUSE_CONTROL_ICON,
    SOFTWARE_TOP_40_PLAYLIST_ID,
    TIME_RELOAD,
    REFRESH_ICON,
    PLAYLISTS_PROVIDER
} from '../Constants';
import {
    isResponseOk,
    softwareGet,
    softwarePost,
    softwareDelete,
    softwarePut,
} from '../HttpClient';
import KpmMusicStoreManager from './KpmMusicStoreManager';
import KpmMusicControlManager from './KpmMusicControlManager';
import {
    getSpotifyPlaylist,
    PlaylistItem,
    getSpotifyDevices,
    PlayerType,
    PlayerName,
    getPlaylists,
    TrackStatus,
    Track,
    getPlaylistTracks,
    CodyResponseType,
    getSpotifyLikedSongs,
    PlaylistTrackInfo,
    getRunningTrack,
    createPlaylist,
    addTracksToPlaylist,
    replacePlaylistTracks,
    CodyConfig,
    setConfig,
    getUserProfile,
    launchPlayer,
    playItunesTrackNumberInPlaylist,
    launchAndPlaySpotifyTrack,
    playSpotifyMacDesktopTrack,
    getGenre,
    getSpotifyTrackById,
} from 'cody-music';

// import KeystrokeManager from '../KeystrokeManager';

const WINDOWS_SPOTIFY_TRACK_FIND =
    'tasklist /fi "imagename eq Spotify.exe" /fo list /v | find " - "';

let trackInfo = {};
let checkSpotifyStateTimeout = null;
const userstatusMgr = require('../UserStatusManager');
const fs = require('fs');
//
// KpmMusicManager - handles software session management
//

$(document).ready(function (e) {
    $(document).on('click', '.play-playlist', function (event) {
        event.stopPropagation();

        if ($(event.target).is('.play-playlist')) {
            console.log(event);
        }
        var _self = this;
        localStorage.setItem('_selectedPlaylistId', $(_self).attr('node-id'));
        localStorage.setItem('_selectedPlaylistTrackId', '');
        localStorage.setItem('isPlaylist', '1');

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:play-playlist-song'
        );
    });

    $(document).on('click', 'li.play-list', function (e) {
        var _self = this;
        localStorage.setItem('_selectedPlaylistId', $(_self).attr('node-id'));
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:toggle-playlist'
        );
    });

    $(document).on('click', '.playlist-nested-item', function (e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem(
            '_selectedPlaylistTrackId',
            $(_self).attr('node-id')
        );
        localStorage.setItem('isPlaylist', '0');
        //localStorage.setItem('_selectedPlaylistId', '');

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:play-playlist-song'
        );
    });
});

$(document).on('click', '#refresh-treeview', async function (e) {
    e.stopPropagation();
    $('#refresh-treeview').attr('src', TIME_RELOAD);
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:refresh-treeview'
    );
});

export default class KpmMusicManager {
    constructor(serializedState) {
        // this.keystrokeObj = new KeystrokeManager();
        // localStorage.setItem('_selectedPlaylistId', '');
        this.structureViewObj = new StructureView();
        this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
        this._savedPlaylists = [];
        this._playlistMap = {};
        this._itunesPlaylists = [];
        this._spotifyPlaylists = [];
        this._musictimePlaylists = [];
        this._softwareTopSongs = [];
        this._userTopSongs = [];
        this._playlistTrackMap = {};
        // this._runningTrack = null;
        // default to starting with spotify
        this._currentPlayerName = PlayerName.SpotifyWeb;
        // this._selectedTrackItem = null;
        this._selectedPlaylist = [];
        // this._selectedPlaylistId = null;
        // this._selectedPlaylistTrackId = null;
        // this._spotifyUser = null;
        this._buildingPlaylists = false;
        // this._serverTrack = null;
        this._initialized = false;
        this._buildingCustomPlaylist = false;
        var _this = this;
        this.existingTrack = {};
        this.isGenerateUsersWeeklyTopSongs = false;
        this._sortAlphabetically = false;

        this.gatheringSong = false;
        this.trackProgressInfo = {
            endInRange: false,
            duration_ms: 0,
            progress_ms: 0,
            id: null,
            lastUpdateUtc: 0,
            playlistId: null,
        };

        if (!this.keystrokeMgr) {
            let defaultName = utilMgr.getDefaultProjectName();
            this.keystrokeMgr = new KeystrokeManager(
                defaultName,
                defaultName
            );
        }

    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new KpmMusicManager();
        }

        return this.instance;
    }

    async togglePLaylist() {
        this._selectedPlaylistId = localStorage.getItem('_selectedPlaylistId');
        let isCollapsed = $(
            '[node-id=' + this._selectedPlaylistId + ']'
        ).hasClass('collapsed');
        if (isCollapsed) {
            // await this.refreshPlaylists();
            const serverIsOnline = utilMgr.serverIsAvailable();
            // this._runningTrack = await getRunningTrack();
            await this.showPlaylistItems(
                this._selectedPlaylistId,
                serverIsOnline
            );
            $('[node-id=' + this._selectedPlaylistId + ']').removeClass(
                'collapsed'
            );
            $('[node-id=' + this._selectedPlaylistId + ']').addClass(
                'play-list-angle-down'
            );
            $('[node-id=' + this._selectedPlaylistId + ']').removeClass(
                'play-list-angle-right'
            );
        } else {
            $('[node-id=' + this._selectedPlaylistId + ']').addClass(
                'collapsed'
            );
            $('[node-id=' + this._selectedPlaylistId + ']').removeClass(
                'play-list-angle-down'
            );
            $('[node-id=' + this._selectedPlaylistId + ']').addClass(
                'play-list-angle-right'
            );
            localStorage.setItem('_selectedPlaylistId', '');
        }
        return;
    }

    async playPlaylistSong() {
        let _self = this;

        let isPlaylist = localStorage.getItem('isPlaylist')
            ? parseInt(localStorage.getItem('isPlaylist'))
            : 0;
        this._selectedPlaylistTrackId = localStorage.getItem(
            '_selectedPlaylistTrackId'
        );
        this._selectedPlaylistId = localStorage.getItem('_selectedPlaylistId');

        this._runningTrack = await getRunningTrack();
        let playlistItem = [];
        if (this._selectedPlaylistTrackId && !isPlaylist) {
            if (!this._selectedPlaylist || this._selectedPlaylist.length == 0) {
                this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                    this._selectedPlaylistId
                );
            }
            playlistItem = this._selectedPlaylist.filter(element => {
                return element.id === _self._selectedPlaylistTrackId;
            });

            playlistItem = playlistItem.length > 0 ? playlistItem[0] : {};
            let isExpand = playlistItem.type == 'playlist' ? true : false;
            await this.playSelectedItem(playlistItem, isExpand);
            this.gatherMusicInfo();
        } else if (this._selectedPlaylistId && isPlaylist) {
            this._playlistMap = localStorage.getItem('_playlistMap')
                ? JSON.parse(localStorage.getItem('_playlistMap'))
                : {};
            playlistItem = await this.getPlaylistById(this._selectedPlaylistId);
            let isExpand = playlistItem.type == 'playlist' ? true : false;

            await this.playSelectedItem(playlistItem, isExpand);
            await this.togglePLaylist();
            $('#play-image-' + this._selectedPlaylistId).attr(
                'src',
                PAUSE_CONTROL_ICON
            );
        }
    }

    async isMacMusicPlayerActive(player) {
        const command = `pgrep -x ${player}`;
        const result = await utilMgr.getCommandResult(command, 1);
        if (result) {
            return true;
        }
        return false;
    }

    async getItunesTrackState() {
        let command = `osascript -e \'tell application "iTunes" to get player state\'`;
        let result = await utilMgr.wrapExecPromise(command, null);
        return result;
    }

    async getSpotifyTrackState() {
        let command = `osascript -e \'tell application "Spotify" to get player state\'`;
        let result = await utilMgr.wrapExecPromise(command, null);
        return result;
    }

    get spotifyUser() {
        return this._spotifyUser;
    }

    set spotifyUser(user) {
        this._spotifyUser = user;
    }
    get sortAlphabetically() {
        return this._sortAlphabetically;
    }

    set sortAlphabetically(sortAlpha) {
        this._sortAlphabetically = sortAlpha;
    }

    isEndInRange(playingTrack) {
        if (!playingTrack || !playingTrack.id) {
            return false;
        }
        const buffer = playingTrack.duration_ms * 0.07;
        return playingTrack.progress_ms >= playingTrack.duration_ms - buffer;
    }

    getChangeStatus(playingTrack, utcLocalTimes) {
        const existingTrackId = this.existingTrack.id || null;
        const playingTrackId = playingTrack.id || null;
        const isValidExistingTrack = existingTrackId ? true : false;
        const isValidTrack = playingTrackId ? true : false;

        // get the flag to determine if it's a new track or not
        const isNewTrack = existingTrackId !== playingTrackId ? true : false;

        const endInRange = this.isEndInRange(playingTrack);

        const playlistId = this._selectedPlaylist
            ? this._selectedPlaylist.id
            : null;
        const isLikedSong =
            playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME ? true : false;

        let lastUpdateUtc =
            isValidTrack && playingTrack.state === TrackStatus.Playing
                ? utcLocalTimes.utc
                : this.trackProgressInfo.lastUpdateUtc;

        const onRepeatStartingOver = utilMgr.isOnRepeatStartingOver(
            playingTrack,
            this.trackProgressInfo
        );

        // get the flag to determine if the track is done or not
        const trackIsDone = utilMgr.trackIsDone(playingTrack);
        const isLongPaused = utilMgr.trackIsLongPaused(
            playingTrack,
            this.trackProgressInfo
        );

        // get the flag to determine if we should send the song session
        const sendSongSession =
            isValidExistingTrack &&
                (isNewTrack || onRepeatStartingOver || trackIsDone || isLongPaused)
                ? true
                : false;

        if (isLongPaused) {
            if (sendSongSession) {
                // update the end time to what the lastUpdateUtc + 5 seconds was
                const offset_sec = utilMgr.timeOffsetSeconds();
                this.existingTrack['end'] = lastUpdateUtc + 5;
                const local = lastUpdateUtc - offset_sec;
                this.existingTrack['local_end'] = local + 5;
            }
            // update the lastUpdateTimeUtc
            lastUpdateUtc = utcLocalTimes.utc;
        }

        // get the flag to determine if we should play the next liked song automatically
        const initiateNextLikedSong =
            this.trackProgressInfo.endInRange &&
                sendSongSession &&
                isLikedSong &&
                !onRepeatStartingOver
                ? true
                : false;

        this.trackProgressInfo = {
            endInRange,
            lastUpdateUtc,
            state: playingTrack.state || null,
            duration_ms: playingTrack.duration_ms || 0,
            progress_ms: playingTrack.progress_ms || 0,
            id: playingTrack.id || null,
            playlistId,
        };

        return {
            isNewTrack,
            sendSongSession,
            initiateNextLikedSong,
        };
    }

    updateTrackPlaylistId(track) {
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
        if (selectedPlaylist) {
            track['playlistId'] = selectedPlaylist.id;
        }
    }

    isValidPlayingOrPausedTrack(playingTrack) {
        if (
            playingTrack &&
            playingTrack.id &&
            (playingTrack.state === TrackStatus.Playing ||
                playingTrack.state === TrackStatus.Paused)
        ) {
            return true;
        }
        return false;
    }

    isValidTrack(playingTrack) {
        if (playingTrack && playingTrack.id) {
            return true;
        }
        return false;
    }

    async gatherMusicInfo() {
        if (this.gatheringSong) {
            return;
        }

        this.gatheringSong = true;
        try {
            const utcLocalTimes = utilMgr.getUtcAndLocal();
            let playingTrack = await getRunningTrack();
            if (!playingTrack) {
                playingTrack = new Track();
            }

            const isValidRunningOrPausedTrack = this.isValidPlayingOrPausedTrack(
                playingTrack
            );
            const isValidTrack = this.isValidTrack(playingTrack);

            // convert the playing track id to an id
            if (isValidTrack) {
                if (!playingTrack.uri) {
                    playingTrack.uri = utilMgr.createUriFromTrackId(
                        playingTrack.id
                    );
                }
                playingTrack.id = utilMgr.createSpotifyIdFromUri(
                    playingTrack.id
                );
            }

            // get the change status info:
            // {isNewTrack, sendSongSession, initiateNextLikedSong}
            const changeStatus = this.getChangeStatus(
                playingTrack,
                utcLocalTimes
            );

            if (changeStatus.isNewTrack) {
                // update the playlistId
                this.updateTrackPlaylistId(playingTrack);
            }

            // has the existing track ended or have we started a new track?
            if (changeStatus.sendSongSession) {
                // just set it to playing
                this.existingTrack.state = TrackStatus.Playing;
                if (this.existingTrack['end'] === 0) {
                    this.existingTrack['end'] = utcLocalTimes.utc;
                    this.existingTrack['local_end'] = utcLocalTimes.local;
                }

                // copy the existing track to "songSession"
                const songSession = {
                    ...this.existingTrack,
                };

                // gather coding and send the track
                this.gatherCodingDataAndSendSongSession(songSession);

                // clear the track.
                this.existingTrack = null;

                if (playingTrack) {
                    this.existingTrack = new Track();
                }

                // reset the track progress info
                this.resetTrackProgressInfo();
            }

            if (this.existingTrack.id !== playingTrack.id) {
                // update the entire object if the id's don't match
                this.existingTrack = { ...playingTrack };
            }

            if (this.existingTrack.state !== playingTrack.state) {
                // update the state if the state doesn't match
                this.existingTrack.state = playingTrack.state;
            }
            // set the start for the playing track
            if (isValidRunningOrPausedTrack && !this.existingTrack['start']) {
                this.existingTrack['start'] = utcLocalTimes.utc;
                this.existingTrack['local_start'] = utcLocalTimes.local;
                this.existingTrack['end'] = 0;
            }

            if (
                !this.KpmMusicStoreManagerObj.hasSpotifyPlaybackAccess() &&
                utilMgr.isMac()
            ) {
                this._currentPlayerName = PlayerName.SpotifyDesktop;
            } else {
                this._currentPlayerName = PlayerName.SpotifyWeb;
            }

            this.spotifyUser = await getUserProfile();

            let msg = '🎧';
            utilMgr.showStatus(msg, null, playingTrack);
        } catch (e) {
            const errMsg = e.message || e;
            utilMgr.logIt(`Unexpected track state processing error: ${errMsg}`);
        }

        this.gatheringSong = false;
    }

    resetTrackProgressInfo() {
        this.trackProgressInfo = {
            endInRange: false,
            duration_ms: 0,
            progress_ms: 0,
            id: null,
            lastUpdateUtc: 0,
            state: null,
            playlistId: null,
        };
    }

    async gatherCodingDataAndSendSongSession(songSession) {
        // if this track doesn't have album json data null it out
        if (songSession.album) {
            // check if it's a valid json
            if (!utilMgr.isValidJson(songSession.album)) {
                // null these out. the backend will populate these
                songSession.album = null;
                songSession.artists = null;
                songSession.features = null;
            }
        }

        // make sure duration_ms is set. it may not be defined
        // if it's coming from one of the players
        if (!songSession.duration_ms && songSession.duration) {
            songSession.duration_ms = songSession.duration;
        }

        // utilMgr.logIt(`storing kpm metrics for music time`);
        // this.keystrokeMgr.sendKeystrokeData();

        // Make sure the current keystrokes payload completes. This will save
        // the code time data for music and code time (only if code time is not installed)
        // await KpmController.getInstance().sendKeystrokeDataIntervalHandler();

        // get the reows from the music data file
        const payloads = await offlineMgr.getDataRows(
            utilMgr.getMusicDataFile()
        );

        const isValidSession = songSession.end - songSession.start > 5;

        if (!isValidSession) {
            // the song did not play long enough to constitute as a valid session
            return;
        }

        let genre = songSession.genre;
        let genreP = null;
        let fullTrackP = null;

        // fetch the full track or genre
        if (songSession.type === 'spotify') {
            // just fetch the entire track
            fullTrackP = getSpotifyTrackById(
                songSession.id,
                true /*includeFullArtist*/,
                true /*includeAudioFeatures*/,
                true /*includeGenre*/
            );
        } else if (!genre) {
            // fetch the genre
            const artistName = this.getArtist(songSession);
            const songName = songSession.name;
            const artistId =
                songSession.artists && songSession.artists.length
                    ? songSession.artists[0].id
                    : '';
            genreP = getGenre(artistName, songName, artistId);
        }

        // add any file payloads we found
        const filePayloads = [];
        if (payloads && payloads.length) {
            payloads.forEach(payload => {
                Object.keys(payload.source).forEach(sourceKey => {
                    let data = {};
                    data[sourceKey] = payload.source[sourceKey];
                    // only add the file payload if the song session's end is after the song session start
                    if (
                        data[sourceKey] &&
                        data[sourceKey].end > songSession.start
                    ) {
                        filePayloads.push(data);
                    }
                });
            });
        }
        const initialValue = {
            add: 0,
            paste: 0,
            delete: 0,
            netkeys: 0,
            linesAdded: 0,
            linesRemoved: 0,
            open: 0,
            close: 0,
            keystrokes: 0,
            syntax: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offset: utilMgr.getOffsetSecends() / 60,
            pluginId: utilMgr.getPluginId(),
            os: utilMgr.getOs(),
            version: utilMgr.getVersion(),
            source: filePayloads,
            repoFileCount: 0,
            repoContributorCount: 0,
        };

        // build the file aggregate data, but only keep the coding data
        // that match up to the song session range
        const songData = this.buildAggregateData(
            payloads,
            initialValue,
            songSession.start
        );

        // await for either promise, whichever one is available
        if (genreP) {
            genre = await genreP;
            songSession['genre'] = genre;
        } else if (fullTrackP) {
            // update the tracks with the result
            const fullTrack = await fullTrackP;
            songSession['album'] = fullTrack.album;
            songSession['features'] = fullTrack.features;
            songSession['artists'] = fullTrack.artists;
            if (!genre) {
                songSession['genre'] = fullTrack.genre;
            }
        }

        // set a convenience "spotifyTrackId" attribute based on the URI
        if (songSession.type === 'spotify' && songSession.uri) {
            songSession['spotifyTrackId'] = songSession.uri;
            // make sure the trackId is the URI if it's a spotify track
            songSession['trackId'] = songSession.uri;
        }

        songSession = {
            ...songSession,
            ...songData,
        };

        // send the music data, if we're online
        this.sendMusicData(songSession);
    }

    getArtist(track) {
        if (!track) {
            return null;
        }
        if (track.artist) {
            return track.artist;
        }
        if (track.artists && track.artists.length > 0) {
            const trackArtist = track.artists[0];
            return trackArtist.name;
        }
        return null;
    }

    async getTrackInfo() {
        let trackInfo = {};

        try {
            let spotifyRunning = await isSpotifyRunning();
            let itunesRunning = await this.isItunesRunning();

            if (spotifyRunning) {
                trackInfo = await getRunningTrack();
                let spotifyStopped =
                    !trackInfo ||
                        (trackInfo && trackInfo['state'] !== 'playing')
                        ? true
                        : false;
                if ((!trackInfo || spotifyStopped) && itunesRunning) {
                    // get that track data.
                    trackInfo = await this.getItunesTrackPromise();
                }
            } else if (itunesRunning) {
                trackInfo = await this.getItunesTrackPromise();
            }
        } catch (e) {
            console.log('error checking track info: ', e.message);
        }

        return trackInfo || {};
    }

    async isSpotifyRunning() {
        if (utilMgr.isWindows()) {
            return new Promise((resolve, reject) => {
                utilMgr
                    .wrapExecPromise(WINDOWS_SPOTIFY_TRACK_FIND, null)
                    .then(result => {
                        if (result && result.toLowerCase().includes('title')) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
            });
        } else {
            let isActive = await this.isMacMusicPlayerActive('Spotify');
            if (!isActive) {
                return false;
            }
            return new Promise((resolve, reject) => {
                spotify.isRunning((err, isRunning) => {
                    if (err) {
                        resolve(false);
                    } else {
                        resolve(isRunning);
                    }
                });
            });
        }
    }

    /**
 * returns i.e.
 * track = {
        artist: 'Bob Dylan',
        album: 'Highway 61 Revisited',
        disc_number: 1,
        duration: 370,
        played count: 0,
        track_number: 1,
        starred: false,
        popularity: 71,
        id: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc',
        name: 'Like A Rolling Stone',
        album_artist: 'Bob Dylan',
        artwork_url: 'http://images.spotify.com/image/e3d720410b4a0770c1fc84bc8eb0f0b76758a358',
        spotify_url: 'spotify:track:3AhXZa8sUQht0UEdBJgpGc' }
    }
 */
    async getSpotifyTrackPromise() {
        if (utilMgr.isWindows()) {
            let windowTitleStr = 'Window Title:';
            // get the artist - song name from the command result, then get the rest of the info from spotify
            let songInfo = await utilMgr.wrapExecPromise(
                WINDOWS_SPOTIFY_TRACK_FIND,
                null
            );
            if (!songInfo || !songInfo.includes(windowTitleStr)) {
                // it must have paused, or an ad, or it was closed
                return null;
            }
            // fetch it from spotify
            // result will be something like: "Window Title: Dexys Midnight Runners - Come On Eileen"
            songInfo = songInfo.substring(windowTitleStr.length);
            let artistSong = songInfo.split('-');
            let artist = artistSong[0].trim();
            let song = artistSong[1].trim();
            let resp = await utilMgr.softwareGet(
                `/music/track?artist=${artist}&name=${song}`,
                utilMgr.getItem('jwt')
            );
            let trackInfo = null;
            if (utilMgr.isResponseOk(resp) && resp.data && resp.data.id) {
                trackInfo = resp.data;
                // set the other attributes like start and type
                trackInfo['type'] = 'spotify';
                trackInfo['state'] = 'playing';
                trackInfo['start'] = 0;
                trackInfo['end'] = 0;
                trackInfo['genre'] = '';
            }
            return trackInfo;
        } else {
            let state = await this.getSpotifyTrackState();
            return new Promise((resolve, reject) => {
                spotify.getTrack((err, track) => {
                    if (err || !track) {
                        resolve(null);
                    } else {
                        // convert the duration to seconds
                        let duration = Math.round(track.duration / 1000);
                        let trackInfo = {
                            id: track.id,
                            name: track.name,
                            artist: track.artist,
                            genre: '', // spotify doesn't provide genre from their app.
                            start: 0,
                            end: 0,
                            state,
                            duration,
                            type: 'spotify',
                        };
                        resolve(trackInfo);
                    }
                });
            });
        }
    }

    async isItunesRunning() {
        if (utilMgr.isWindows()) {
            return false;
        }
        let isActive = await this.isMacMusicPlayerActive('iTunes');
        if (!isActive) {
            return false;
        }
        return new Promise((resolve, reject) => {
            itunes.isRunning((err, isRunning) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(isRunning);
                }
            });
        });
    }

    /**
 * returns an array of data, i.e.
 * 0:"Dance"
    1:"Martin Garrix"
    2:"High on Life (feat. Bonn) - Single"
    3:4938 <- is this the track ID?
    4:375
    5:"High on Life (feat. Bonn)"
    6:"3:50"
 */
    async getItunesTrackPromise() {
        let state = await this.getItunesTrackState();
        return new Promise((resolve, reject) => {
            itunes.track((err, track) => {
                if (err || !track) {
                    resolve(null);
                } else {
                    let trackInfo = {
                        id: '',
                        name: '',
                        artist: '',
                        genre: '', // spotify doesn't provide genre from their app.
                        start: 0,
                        end: 0,
                        state,
                        duration: 0,
                        type: 'itunes',
                    };
                    if (track.length > 0) {
                        trackInfo['genre'] = track[0];
                    }
                    if (track.length >= 1) {
                        trackInfo['artist'] = track[1];
                    }
                    if (track.length >= 3) {
                        trackInfo['id'] = `itunes:track:${track[3]}`;
                    }
                    if (track.length >= 5) {
                        trackInfo['name'] = track[5];
                    }
                    if (track.length >= 6) {
                        // get the duration "4:41"
                        let durationParts = track[6].split(':');
                        if (durationParts && durationParts.length === 2) {
                            let durationInMin =
                                parseInt(durationParts[0], 10) * 60 +
                                parseInt(durationParts[1]);
                            trackInfo['duration'] = durationInMin;
                        }
                    }
                    resolve(trackInfo);
                }
            });
        });
    }

    async sendMusicData(trackData) {
        const serverIsOnline = await utilMgr.serverIsAvailable();

        if (trackData.available_markets) {
            delete trackData.available_markets;
        }
        if (trackData.images) {
            delete trackData.images;
        }
        if (trackData.external_urls) {
            delete trackData.external_urls;
        }
        if (trackData.href) {
            delete trackData.href;
        }

        if (serverIsOnline) {
            utilMgr.logIt(
                `Sending Track: ${trackData.name}:${
                trackData.artist
                }, Keystrokes: ${trackData.keystrokes}, Start: ${moment
                    .unix(trackData.start)
                    .format()}, End: ${moment.unix(trackData.end).format()}`
            );
            // utilMgr.logIt(trackData);
            console.log(`${JSON.stringify(trackData)}`);

            // add the "local_start", "start", and "end"
            // POST the kpm to the PluginManager
            utilMgr.sendSessionPayload(trackData);
        } else {
            // store it
            utilMgr.storeMusicSessionPayload(trackData);
        }
    }

    async tryRefreshAgain() {
        await this.refreshPlaylists();
    }
    async getRunningTrack() {
        return await getRunningTrack();
    }

    async refreshPlaylists(needsRefresh = false) {
        if (this._buildingPlaylists) {
            // try again in a second
            setTimeout(() => {
                this.tryRefreshAgain();
            }, 1000);
        }
        this._buildingPlaylists = true;

        let serverIsOnline = await utilMgr.serverIsAvailable();
        this._runningTrack = await getRunningTrack();
        localStorage.setItem('_runningTrack', JSON.stringify(this._runningTrack));

        if (
            !this._initialized &&
            this._runningTrack.playerType === PlayerType.MacItunesDesktop
        ) {
            this._currentPlayerName = PlayerName.ItunesDesktop;
        }
        this._initialized = true;

        if (this._currentPlayerName === PlayerName.ItunesDesktop) {
            await this.showItunesPlaylists(serverIsOnline);
        } else {
            await this.showSpotifyPlaylists(serverIsOnline, needsRefresh);
        }
        this.syncControls(this._runningTrack);

        this._buildingPlaylists = false;
    }

    async showItunesPlaylists(serverIsOnline) {
        let foundPlaylist = this._itunesPlaylists.find(element => {
            return element.type === 'playlist';
        });
        // if no playlists are found for itunes, then fetch
        if (!foundPlaylist) {
            await this.refreshPlaylistForPlayer(
                PlayerName.ItunesDesktop,
                serverIsOnline
            );
        }
    }

    async refreshClearPlaylists() {
        await this.refreshPlaylists(true);
        this.clearSpotify();
        utilMgr.notify(
            'Music Time',
            `Successfully refreshed ${PERSONAL_TOP_SONGS_NAME}.`
        );
    }

    async showSpotifyPlaylists(serverIsOnline, needsRefresh = false) {
        let _self = this;
        this._selectedPlaylistId =
            this._selectedPlaylistId ||
            localStorage.getItem('_selectedPlaylistId');
        // if no playlists are found for spotify, then fetch
        let foundPlaylist = this._spotifyPlaylists
            ? this._spotifyPlaylists.find(element => {
                return element.type === 'playlist';
            })
            : null;
        if (!foundPlaylist || needsRefresh) {
            await this.refreshPlaylistForPlayer(
                this._currentPlayerName,
                serverIsOnline
            );
        }
        if (
            this._spotifyPlaylists.length > 0 &&
            !this.KpmMusicStoreManagerObj.requiresSpotifyAccess()
        ) {
            if (this._selectedPlaylist.length == 0) {
                this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                    this._selectedPlaylistId
                );
            }
            const tracks = await getSpotifyLikedSongs();
            this._spotifyPlaylists.map(function (item) {
                if (
                    _self._selectedPlaylistId ===
                    SPOTIFY_LIKED_SONGS_PLAYLIST_ID
                ) {
                    // localStorage.setItem('likedTracks' ,JSON.stringify(tracks));
                    _self._selectedPlaylist = _self.getPlaylistItemTracksFromTracks(
                        tracks
                    );
                }

                if (item.id === _self._selectedPlaylistId) {
                    item.child = _self._selectedPlaylist;
                    item['isSelected'] = true;
                } else {
                    item['isSelected'] = false;
                }
            });

            let filteredSpotifyPlaylists = this._spotifyPlaylists.filter(
                element => {
                    return (
                        (element.type && element.type === 'playlist') ||
                        element.type == 'divider'
                    );
                }
            );

            // show the devices listening folder if they've already connected oauth
            const devicesFound = await this.getActiveSpotifyDevicesTitleAndTooltip();

            const customPlaylist = this.getMusicTimePlaylistByTypeId(
                PERSONAL_TOP_SONGS_PLID
            );
            let generatePLaylistButton = {};
            generatePLaylistButton['label'] = !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TITLE
                : REFRESH_CUSTOM_PLAYLIST_TITLE;
            generatePLaylistButton['tooltip'] == !customPlaylist
                ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
                : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;
            this.structureViewObj.initialize(
                filteredSpotifyPlaylists,
                this._selectedPlaylistTrackId,
                devicesFound,
                generatePLaylistButton
            );
        }
    }

    updateSort(sortAlpha) {
        if (!this.KpmMusicStoreManagerObj.requiresSpotifyAccess()) {
            this.sortAlphabetically = sortAlpha;
            // commands.executeCommand("musictime.refreshPlaylist");
            this.refreshPlaylists(true);
            utilMgr.notify('Music Time', 'Sorting playlist, please wait.');
        }
    }
    //
    // Fetch the playlist names for a specific player
    //
    async refreshPlaylistForPlayer(playerName, serverIsOnline) {
        this.KpmMusicStoreManagerObj.spotifyUser = await getUserProfile();
        let items = [];

        // let needsSpotifyAccess = this.KpmMusicStoreManagerObj.requiresSpotifyAccess();
        const needsSpotifyAccess = this.KpmMusicStoreManagerObj.requiresSpotifyAccess();
        const hasSpotifyUser = this.KpmMusicStoreManagerObj.hasSpotifyUser();
        const isSpotifyPremium = this.KpmMusicStoreManagerObj.isSpotifyPremium();

        let playlists = [];
        let type = 'spotify';
        if (playerName === PlayerName.ItunesDesktop) {
            type = 'itunes';
        }
        // there's nothing to get if it's windows and they don't have
        // a premium spotify account
        let premiumAccountRequired =
            !utilMgr.isMac() &&
                !this.KpmMusicStoreManagerObj.hasSpotifyPlaybackAccess()
                ? true
                : false;

        let allowSpotifyPlaylistFetch = true;
        if (needsSpotifyAccess || premiumAccountRequired) {
            allowSpotifyPlaylistFetch = false;
        }

        const isNonPremiumConnectedSpotify =
            allowSpotifyPlaylistFetch && !isSpotifyPremium;

        if (allowSpotifyPlaylistFetch) {
            playlists = await getPlaylists(playerName, { all: true });
        }

        if (this._savedPlaylists && this._savedPlaylists.length === 0) {
            // fetch and reconcile the saved playlists against the spotify list
            await this.fetchSavedPlaylists(serverIsOnline);
        }

        // reconcile in case the fetched playlists don't contain
        // one we've generated, or the name has changed
        if (
            serverIsOnline &&
            playerName === PlayerName.SpotifyWeb &&
            this._savedPlaylists.length > 0 &&
            playlists.length > 0
        ) {
            await this.reconcilePlaylists(playlists);
        }

        // sort
        if (this.sortAlphabetically) {
            this.sortPlaylists(playlists);
        }

        // go through each playlist and find out it's state
        if (playlists && playlists.length > 0) {
            for (let i = 0; i < playlists.length; i++) {
                let playlist = playlists[i];
                this._playlistMap[playlist.id] = playlist;
                let playlistItemTracks = this._playlistTrackMap[playlist.id];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
                playlist.itemType = 'playlist';
                playlist.tag = type;
            }
        }

        // filter out the music time playlists into it's own list if we have any
        this.retrieveMusicTimePlaylist(playlists);

        // add the buttons to the playlist
        await this.addSoftwareLoginButtonIfRequired(serverIsOnline, items);

        // add the no music time connection button if we're not online
        if (!serverIsOnline) {
            items.push(this.getNoMusicTimeConnectionButton());
        }

        if (premiumAccountRequired) {
            // show the spotify premium account required button
            items.push(this.getSlackPremiumAccountRequiredButton());
        }

        // add the connect to spotify if they still need to connect
        if (needsSpotifyAccess) {
            items.push(this.getConnectToSpotifyButton());
        }

        // show the spotify connect premium button if they're connected and a non-premium account
        if (isNonPremiumConnectedSpotify) {
            // show the spotify premium account required button
            items.push(this.getSpotifyPremiumAccountRequiredButton());
        }

        if (utilMgr.getItem('slack_access_token')) {
            // show the disconnect slack button
            items.push(this.getSlackDisconnectButton());
        }

        if (playerName === PlayerName.ItunesDesktop) {
            // add the action items specific to itunes
            items.push(this.getItunesConnectedButton());
            items.push(this.getSwitchToSpotifyButton());

            if (playlists.length > 0) {
                items.push(this.getLineBreakButton());
            }

            playlists.forEach(item => {
                items.push(item);
            });

            this._itunesPlaylists = items;
        } else {
            if (utilMgr.getItem('spotify_access_token')) {
                // show the disconnect spotify button
                items.push(this.getSpotifyDisconnectButton());
            }

            // add the action items specific to spotify
            if (allowSpotifyPlaylistFetch) {
                // playlists.push(this.getSpotifyLikedPlaylistFolder());
                this._playlistMap[
                    SPOTIFY_LIKED_SONGS_PLAYLIST_ID
                ] = this.getSpotifyLikedPlaylistFolder();
                items.push(this.getSpotifyConnectedButton());
            }

            if (utilMgr.isMac()) {
                items.push(this.getSwitchToItunesButton());
            }

            // line break between actions and software playlist section
            items.push(this.getLineBreakButton());

            // get the custom playlist button
            if (serverIsOnline && allowSpotifyPlaylistFetch) {
                const customPlaylistButton = this.getCustomPlaylistButton();
                if (customPlaylistButton) {
                    items.push(customPlaylistButton);
                }
            }

            // get the Software Top 40 Playlist
            const softwareTop40 = await getSpotifyPlaylist(
                SOFTWARE_TOP_40_PLAYLIST_ID
            );
            if (softwareTop40 && softwareTop40.id) {
                softwareTop40.itemType = 'playlist';
                softwareTop40.tag = 'paw';
                // add it to music time playlist
                items.push(softwareTop40);
            }
            const likedSongItem = this.getSpotifyLikedPlaylistFolder();
            let likedTracks = await getSpotifyLikedSongs();

            this._playlistMap[softwareTop40.id] = softwareTop40;

            localStorage.setItem(
                '_playlistMap',
                JSON.stringify(this._playlistMap)
            );
            // add the music time playlists that were found
            if (
                this._musictimePlaylists &&
                this._musictimePlaylists.length > 0
            ) {
                for (let i = 0; i < this._musictimePlaylists.length; i++) {
                    const musicTimePlaylist = this._musictimePlaylists[i];
                    // musicTimePlaylist.tag = 'paw'
                    //items.push(musicTimePlaylist);
                    if (
                        musicTimePlaylist.playlistTypeId ===
                        PERSONAL_TOP_SONGS_PLID
                    ) {
                        items.push(musicTimePlaylist);
                    }
                }
            }
            if (likedTracks.length > 0) {
                items.push(likedSongItem);
            }
            if (playlists.length > 0) {
                items.push(this.getLineBreakButton());
            }

            playlists.forEach(item => {
                items.push(item);
            });

            this._spotifyPlaylists = items;
        }
    }

    sortPlaylists(playlists) {
        if (playlists && playlists.length > 0) {
            playlists.sort((a, b) => {
                const nameA = a.name.toLowerCase(),
                    nameB = b.name.toLowerCase();
                if (nameA < nameB)
                    //sort string ascending
                    return -1;
                if (nameA > nameB) return 1;
                return 0; //default return value (no sorting)
            });
        }
    }

    sortPlaylists(playlists) {
        if (playlists && playlists.length > 0) {
            playlists.sort((a, b) => {
                const nameA = a.name.toLowerCase(),
                    nameB = b.name.toLowerCase();
                if (nameA < nameB)
                    //sort string ascending
                    return -1;
                if (nameA > nameB) return 1;
                return 0; //default return value (no sorting)
            });
        }
    }

    mapPLaylistItems(spotifyPlaylists) {
        let _self = this;
        if (spotifyPlaylists && spotifyPlaylists.length > 0) {
            spotifyPlaylists = spotifyPlaylists.map(async function (item) {
                if (!item.child || item.child.length == 0) {
                    item.child = await _self.getPlaylistItemTracksForPlaylistId(
                        item.id
                    );
                }
            });
        }
        return spotifyPlaylists;
    }

    async showPlaylistItems(playlist_id, serverIsOnline) {
        this._selectedPlaylistId = playlist_id;
        if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
            let tracks = await getSpotifyLikedSongs();
            // localStorage.setItem('likedTracks' ,JSON.stringify(tracks));
            this._selectedPlaylist = this.getPlaylistItemTracksFromTracks(
                tracks
            );
        } else {
            this._selectedPlaylist = this._playlistMap[playlist_id];
            this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                playlist_id
            );
        }

        let foundPlaylist = this._spotifyPlaylists
            ? this._spotifyPlaylists.find(element => {
                return element.type === 'playlist';
            })
            : null;
        if (!foundPlaylist) {
            await this.refreshPlaylistForPlayer(
                PlayerName.SpotifyWeb,
                serverIsOnline
            );
        }

        let _self = this;
        this._spotifyPlaylists.map(function (item) {
            if (item.id === playlist_id) {
                item.child = _self._selectedPlaylist;
            }
        });

        let filteredSpotifyPlaylists = this._spotifyPlaylists.filter(
            element => {
                return (
                    (element.type && element.type === 'playlist') ||
                    element.type == 'divider'
                );
            }
        );

        filteredSpotifyPlaylists = filteredSpotifyPlaylists.map(element => {
            element['isSelected'] =
                this._selectedPlaylistId == element.id ? true : false;

            if (element.child && element.child.length > 0) {
                let playingSong = element.child.find(childElement => {
                    return childElement.state == 'playing';
                });
                if (playingSong) {
                    element['isPlaying'] = true;
                } else {
                    element['isPlaying'] = false;
                }
            }

            return element;
        });

        const devicesFound = await this.getActiveSpotifyDevicesTitleAndTooltip();
        const customPlaylist = this.getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );
        let generatePLaylistButton = {};
        generatePLaylistButton['label'] = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TITLE
            : REFRESH_CUSTOM_PLAYLIST_TITLE;
        generatePLaylistButton['tooltip'] == !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
            : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

        this.structureViewObj.initialize(
            filteredSpotifyPlaylists,
            this._selectedPlaylistTrackId,
            devicesFound,
            generatePLaylistButton
        );
    }

    async syncControls(track) {
        this._runningTrack = track;
        // update the playlist
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];;
        if (selectedPlaylist) {
            await this.clearPlaylistTracksForId(selectedPlaylist.id);
            // this will get the updated state of the track
            // const playerlist = await this.getPlaylistItemTracksForPlaylistId(
            //     selectedPlaylist.id
            // );
            await this.refreshPlaylistState();
        }

        if (this._hideSongTimeout) {
            clearTimeout(this._hideSongTimeout);
        }

        const trackStatus = track ? track.state : TrackStatus.NotAssigned;
    }

    //
    // Fetch the tracks for a given playlist ID
    //
    async getPlaylistItemTracksForPlaylistId(playlist_id) {
        let playlistItemTracks = this._playlistTrackMap[playlist_id];

        if (!playlistItemTracks || playlistItemTracks.length === 0) {
            if (this._currentPlayerName === PlayerName.ItunesDesktop) {
                // get the itunes tracks based on this playlist id name
                const codyResp = await getPlaylistTracks(
                    PlayerName.ItunesDesktop,
                    playlist_id
                );
                playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
                    codyResp
                );
            } else {
                // fetch from spotify web
                if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                    let tracks = await getSpotifyLikedSongs();
                    playlistItemTracks = this.getPlaylistItemTracksFromTracks(
                        tracks
                    );
                } else {
                    // get the playlist tracks from the spotify api
                    const codyResp = await getPlaylistTracks(
                        PlayerName.SpotifyWeb,
                        playlist_id
                    );
                    playlistItemTracks = this.getPlaylistItemTracksFromCodyResponse(
                        codyResp
                    );
                }
            }

            // update the map
            this._playlistTrackMap[playlist_id] = playlistItemTracks;
        }

        if (playlistItemTracks && playlistItemTracks.length > 0) {
            for (let i = 0; i < playlistItemTracks.length; i++) {
                playlistItemTracks[i]['playlist_id'] = playlist_id;
            }
        }

        return playlistItemTracks;
    }

    getPlaylistItemTracksFromCodyResponse(codyResponse) {
        let playlistItems = [];
        if (codyResponse && codyResponse.state === CodyResponseType.Success) {
            let paginationItem = codyResponse.data;

            if (paginationItem && paginationItem.items) {
                playlistItems = paginationItem.items.map((track, idx) => {
                    const position = idx + 1;
                    let playlistItem = this.createPlaylistItemFromTrack(
                        track,
                        position
                    );

                    return playlistItem;
                });
            }
        }

        return playlistItems;
    }

    //
    // Build the playlist items from the list of tracks
    //
    getPlaylistItemTracksFromTracks(tracks) {
        let playlistItems = [];
        if (tracks && tracks.length > 0) {
            for (let i = 0; i < tracks.length; i++) {
                let track = tracks[i];
                const position = i + 1;
                let playlistItem = this.createPlaylistItemFromTrack(
                    track,
                    position
                );
                playlistItems.push(playlistItem);
            }
        }
        return playlistItems;
    }

    createPlaylistItemFromTrack(track, position) {
        let playlistItem = new PlaylistItem();
        this._runningTrack = localStorage.getItem('_runningTrack') ? JSON.parse(localStorage.getItem('_runningTrack')) : this._runningTrack;
        playlistItem.type = 'track';
        playlistItem.name = track.name;
        playlistItem.id = track.id;
        playlistItem.popularity = track.popularity;
        playlistItem.played_count = track.played_count;
        playlistItem.position = position;
        playlistItem.artist = track.artist;
        playlistItem.playerType = track.playerType;
        playlistItem.itemType = 'track';
        delete playlistItem.tracks;

        if (track.id === this._runningTrack.id) {
            playlistItem.state = this._runningTrack.state;
            this._selectedTrackItem = playlistItem;
        } else {
            playlistItem.state = TrackStatus.NotAssigned;
        }
        return playlistItem;
    }

    async fetchSavedPlaylists(serverIsOnline) {
        let playlists = [];
        if (serverIsOnline) {
            const response = await softwareGet(
                '/music/playlist/generated',
                utilMgr.getItem('jwt')
            );

            if (isResponseOk(response)) {
                // only return the non-deleted playlists
                for (let i = 0; i < response.data.length; i++) {
                    const savedPlaylist = response.data[i];
                    if (savedPlaylist && savedPlaylist['deleted'] !== 1) {
                        savedPlaylist.id = savedPlaylist.playlist_id;
                        savedPlaylist.playlistTypeId =
                            savedPlaylist.playlistTypeId;
                        delete savedPlaylist.playlist_id;
                        playlists.push(savedPlaylist);
                    }
                }
            }
        }
        this._savedPlaylists = Array.from(playlists);
    }
    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    retrieveMusicTimePlaylist(playlists) {
        this._musictimePlaylists = [];
        if (
            (this._savedPlaylists && this._savedPlaylists.length > 0) ||
            playlists.length > 0
        ) {
            for (let i = 0; i < this._savedPlaylists.length; i++) {
                let savedPlaylist = this._savedPlaylists[i];
                let savedPlaylistTypeId = savedPlaylist.playlistTypeId;

                for (let x = playlists.length - 1; x >= 0; x--) {
                    let playlist = playlists[x];
                    if (playlist.id === savedPlaylist.id) {
                        playlist.playlistTypeId = savedPlaylistTypeId;
                        playlist.tag = 'paw';
                        playlists.splice(x, 1);
                        this._musictimePlaylists.push(playlist);
                        break;
                    }
                }
            }
        } else {
            this._musictimePlaylists = [];
        }
    }

    /**
     * Returns whether we've created the global playlist or not.
     */
    globalPlaylistIdExists() {
        if (this._savedPlaylists && this._savedPlaylists.length > 0) {
            for (let i = 0; i < this._savedPlaylists.length; i++) {
                let savedPlaylist = this._savedPlaylists[i];
                let savedPlaylistTypeId = savedPlaylist.playlistTypeId;
                if (savedPlaylistTypeId === PERSONAL_TOP_SONGS_PLID) {
                    return true;
                }
            }
        }
        return false;
    }

    //
    // Fetch the playlist overall state
    //
    async getPlaylistState(playlist_id) {
        let playlistState = TrackStatus.NotAssigned;
        this._runningTrack = localStorage.getItem('_runningTrack') ? JSON.parse(localStorage.getItem('_runningTrack')) : this._runningTrack;
        const playlistTrackItems = await this.getPlaylistItemTracksForPlaylistId(
            playlist_id
        );

        if (playlistTrackItems && playlistTrackItems.length > 0) {
            for (let i = 0; i < playlistTrackItems.length; i++) {
                const playlistItem = playlistTrackItems[i];
                if (playlistItem.id === this._runningTrack.id) {
                    return this._runningTrack.state;
                } else {
                    // update theis track status to not assigned to ensure it's also updated
                    playlistItem.state = TrackStatus.NotAssigned;
                }
            }
        }

        return playlistState;
    }

    async getActiveSpotifyDevicesTitleAndTooltip() {
        const devices = await getSpotifyDevices();
        let inactiva_devices_names = [];
        if (devices && devices.length > 0) {
            for (let i = 0; i < devices.length; i++) {
                const device = devices[i];
                if (device.is_active) {
                    // done, found an active device
                    return {
                        title: `Listening on ${device.name}`,
                        tooltip: 'Spotify devices available',
                        loggedIn: true,
                        device_id: device.id,
                    };
                } else {
                    if (!inactiva_devices_names.includes(device.name)) {
                        inactiva_devices_names.push(device.name);
                    }
                }
            }
        }

        if (inactiva_devices_names.length > 0) {
            return {
                title: `Available on ${inactiva_devices_names.join(', ')}`,
                tooltip: 'Spotify devices found but are not currently active',
                loggedIn: true,
            };
        }

        return {
            title: 'No Devices Found',
            tooltip:
                'No Spotify devices found, you may need to login to your player',
            loggedIn: false,
        };
    }

    clearPlaylistTracksForId(playlist_id) {
        this._playlistTrackMap[playlist_id] = null;
    }

    async addSoftwareLoginButtonIfRequired(serverIsOnline, items) {
        let loggedInCacheState = userstatusMgr.getLoggedInCacheState();
        let userStatus = {
            loggedIn: loggedInCacheState,
        };
        if (loggedInCacheState === null) {
            // update it since it's null
            // {loggedIn: true|false}
            userStatus = await userstatusMgr.getUserStatus(serverIsOnline);
        }

        // if (!userStatus.loggedIn) {
        //   items.push(this.getSoftwareLoginButton());
        // }
    }

    async addSoftwareLoginButtonIfRequired(serverIsOnline, items) {
        let loggedInCacheState = userstatusMgr.getLoggedInCacheState();
        let userStatus = {
            loggedIn: loggedInCacheState,
        };
        if (loggedInCacheState === null) {
            // update it since it's null
            // {loggedIn: true|false}
            userStatus = await userstatusMgr.getUserStatus(serverIsOnline);
        }

        if (!userStatus.loggedIn) {
            items.push(this.getSoftwareLoginButton());
        }
    }

    getSpotifyLikedPlaylistFolder() {
        const item = new PlaylistItem();
        item.type = 'playlist';
        item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
        item.tracks = new PlaylistTrackInfo();
        // set set a number so it shows up
        item.tracks.total = 1;
        item.playerType = PlayerType.WebSpotify;
        item.tag = 'spotify';
        item.itemType = 'playlist';
        item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
        return item;
    }

    getNoMusicTimeConnectionButton() {
        return this.buildActionItem(
            'offline',
            'offline',
            null,
            PlayerType.NotAssigned,
            'Music Time Offline',
            'Unable to connect to Music Time'
        );
    }

    getNoSpotifyConnectionButton() {
        return this.buildActionItem(
            'offline',
            'offline',
            null,
            PlayerType.NotAssigned,
            'Go Online To Load Playlists',
            'Unable to connect to Spotify'
        );
    }

    getSpotifyPremiumAccountRequiredButton() {
        return this.buildActionItem(
            'spotifypremium',
            'action',
            'musictime.spotifyPremiumRequired',
            PlayerType.NotAssigned,
            'Spotify Premium Required',
            'Connect to your premium Spotify account to use the play, pause, next, and previous controls'
        );
    }

    createSpotifyDevicesButton(title, tooltip, loggedIn) {
        const button = this.buildActionItem(
            'title',
            'spotify',
            null,
            PlayerType.WebSpotify,
            title,
            tooltip
        );
        button.tag = loggedIn ? 'active' : 'disabled';
        return button;
    }

    getSpotifyConnectedButton() {
        return this.buildActionItem(
            'spotifyconnected',
            'connected',
            null,
            PlayerType.WebSpotify,
            'Spotify Connected',
            "You've connected Spotify"
        );
    }

    getSpotifyDisconnectButton() {
        return this.buildActionItem(
            'spotifydisconnect',
            'action',
            'musictime.disconnectSpotify',
            PlayerType.NotAssigned,
            'Disconnect Spotify',
            'Disconnect your Spotify oauth integration'
        );
    }

    getSlackDisconnectButton() {
        return this.buildActionItem(
            'slackdisconnect',
            'action',
            'musictime.disconnectSlack',
            PlayerType.NotAssigned,
            'Disconnect Slack',
            'Disconnect your Slack oauth integration'
        );
    }

    getSlackPremiumAccountRequiredButton() {
        return this.buildActionItem(
            'spotifypremium',
            'action',
            'musictime.spotifyPremiumRequired',
            PlayerType.NotAssigned,
            'Spotify Premium Required',
            'Connect to your premium Spotify account to use the play, pause, next, and previous controls'
        );
    }

    getItunesConnectedButton() {
        return this.buildActionItem(
            'itunesconnected',
            'connected',
            null,
            PlayerType.MacItunesDesktop,
            'iTunes Connected',
            "You've connected iTunes"
        );
    }

    getConnectToSpotifyButton() {
        return this.buildActionItem(
            'connectspotify',
            'spotify',
            'musictime.connectSpotify',
            PlayerType.WebSpotify,
            'Connect Spotify',
            'Connect Spotify to view your playlists'
        );
    }

    getSoftwareLoginButton() {
        return this.buildActionItem(
            'login',
            'login',
            null,
            PlayerType.NotAssigned,
            LOGIN_LABEL,
            'To see your music data in Music Time, please log in to your account',
            null,
            utilMgr.launchLogin
        );
    }

    getSwitchToSpotifyButton() {
        return this.buildActionItem(
            'title',
            'spotify',
            'musictime.launchSpotify',
            PlayerType.WebSpotify,
            'Switch to Spotify'
        );
    }

    getSwitchToItunesButton() {
        return this.buildActionItem(
            'title',
            'itunes',
            'musictime.launchItunes',
            PlayerType.MacItunesDesktop,
            'Switch to iTunes'
        );
    }

    getLineBreakButton() {
        return this.buildActionItem(
            'title',
            'divider',
            null,
            PlayerType.NotAssigned,
            '',
            ''
        );
    }

    buildActionItem(
        id,
        type,
        command,
        playerType,
        name,
        tooltip = '',
        itemType = '',
        callback = null
    ) {
        let item = new PlaylistItem();
        item.tracks = new PlaylistTrackInfo();
        item.type = type;
        item.id = id;
        item.command = command;
        item['cb'] = callback;
        item.playerType = playerType;
        item.name = name;
        item.tooltip = tooltip;
        item.itemType = itemType;

        return item;
    }

    async createOrRefreshGlobalTopSongsPlaylist() {
        const serverIsOnline = utilMgr.serverIsAvailable();

        if (!serverIsOnline) {
            window.showInformationMessage(
                'Our service is temporarily unavailable, please try again later.'
            );
            return;
        }

        if (this.KpmMusicStoreManagerObj.requiresSpotifyAccess()) {
            // don't create or refresh, no spotify access provided
            return;
        }

        // get the global top songs
        await this.syncUsersWeeklyTopSongs();

        let globalPlaylist = this.getMusicTimePlaylistByTypeId(
            SOFTWARE_TOP_SONGS_PLID
        );

        let playlistId = null;
        if (!globalPlaylist) {
            // 1st create the empty playlist
            const playlistResult = await createPlaylist(
                SOFTWARE_TOP_SONGS_NAME,
                true
            );

            if (playlistResult.state === CodyResponseType.Failed) {
                window.showErrorMessage(
                    `There was an unexpected error adding tracks to the playlist. ${playlistResult.message}`,
                    ...['OK']
                );
                return;
            }

            playlistId = playlistResult.data.id;

            if (playlistId) {
                await this.updateSavedPlaylists(
                    playlistId,
                    2,
                    SOFTWARE_TOP_SONGS_NAME
                ).catch(err => {
                    utilMgr.logIt(
                        'Error updating music time global playlist ID'
                    );
                });
            }
        } else {
            // global playlist exists, get the id to refresh
            playlistId = globalPlaylist.id;
        }

        if (this._softwareTopSongs && this._softwareTopSongs.length > 0) {
            let tracksToAdd = this._softwareTopSongs.map(item => {
                return item.trackId;
            });
            if (tracksToAdd && tracksToAdd.length > 0) {
                if (!globalPlaylist) {
                    // no global playlist, add the tracks for the 1st time
                    await this.addTracks(
                        playlistId,
                        SOFTWARE_TOP_SONGS_NAME,
                        tracksToAdd
                    );
                } else {
                    // it exists, refresh it with new tracks
                    await replacePlaylistTracks(playlistId, tracksToAdd).catch(
                        err => {
                            utilMgr.logIt(
                                `Error replacing tracks, error: ${err.message}`
                            );
                        }
                    );
                }
            }
        }

        // setTimeout(() => {
        //   this.clearSpotify();
        //   commands.executeCommand("musictime.refreshPlaylist");
        // }, 500);

        await this.fetchSavedPlaylists(serverIsOnline);
    }

    async generateUsersWeeklyTopSongs() {
        if (this._buildingCustomPlaylist) {
            return;
        }
        const serverIsOnline = await utilMgr.serverIsAvailable();

        if (!serverIsOnline) {
            utilMgr.notify(
                'Music Time',
                'Our service is temporarily unavailable, please try again later.'
            );
            return;
        }

        if (this.KpmMusicStoreManagerObj.requiresSpotifyAccess()) {
            // don't create or refresh, no spotify access provided
            return;
        }

        this._buildingCustomPlaylist = true;

        let customPlaylist = this.getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        const infoMsg = !customPlaylist
            ? `Creating and populating the ${PERSONAL_TOP_SONGS_NAME} playlist, please wait.`
            : `Refreshing the ${PERSONAL_TOP_SONGS_NAME} playlist, please wait.`;

        utilMgr.notify('Music Time', infoMsg);

        let playlistId = null;
        if (!customPlaylist) {
            const playlistResult = await createPlaylist(
                PERSONAL_TOP_SONGS_NAME,
                true
            );

            const errMsg = utilMgr.getCodyErrorMessage(playlistResult);
            if (errMsg) {
                utilMgr.notify(
                    'Music Time',
                    `There was an unexpected error adding tracks to the playlist. ${errMsg} Refresh the playlist and try again if you feel the problem has been resolved.`
                );
                this._buildingCustomPlaylist = false;
                return;
            }

            playlistId = playlistResult.data.id;

            await this.updateSavedPlaylists(
                playlistId,
                PERSONAL_TOP_SONGS_PLID,
                PERSONAL_TOP_SONGS_NAME
            ).catch(err => {
                utilMgr.logIt(
                    'Error updating music time with generated playlist ID'
                );
            });
        } else {
            // get the spotify playlist id from the app's existing playlist info
            playlistId = customPlaylist.id;
        }

        // get the spotify track ids and create the playlist
        if (playlistId) {
            // sync the user's weekly top songs
            await this.syncUsersWeeklyTopSongs();

            // add the tracks
            // list of [{trackId, artist, name}...]
            if (this._userTopSongs && this._userTopSongs.length > 0) {
                let tracksToAdd = this._userTopSongs.map(item => {
                    if (item.uri) {
                        return item.uri;
                    } else if (item.trackId) {
                        return item.trackId;
                    }
                    return item.id;
                });

                if (!customPlaylist) {
                    await this.addTracks(
                        playlistId,
                        PERSONAL_TOP_SONGS_NAME,
                        tracksToAdd
                    );
                } else {
                    await replacePlaylistTracks(playlistId, tracksToAdd).catch(
                        err => {
                            // logIt(
                            //     `Error replacing tracks, error: ${err.message}`
                            // );
                        }
                    );
                    utilMgr.notify(
                        'Music Time',
                        `Successfully refreshed ${PERSONAL_TOP_SONGS_NAME}.`
                    );
                }
            } else {
                utilMgr.notify(
                    'Music Time',
                    `Successfully created ${PERSONAL_TOP_SONGS_NAME}, but we're unable to add any songs at the moment.`
                );
            }
        }

        await this.fetchSavedPlaylists(serverIsOnline);

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:refreshPlaylist'
        );

        // update building custom playlist to false
        this._buildingCustomPlaylist = false;
    }
    clearSpotify() {
        this._spotifyPlaylists = [];
        this._playlistMap = {};
        this._playlistTrackMap = {};
    }

    async addTracks(playlist_id, name, tracksToAdd) {
        if (playlist_id) {
            // create the playlist_id in software
            const addTracksResult = await addTracksToPlaylist(
                playlist_id,
                tracksToAdd
            );

            if (addTracksResult.state === CodyResponseType.Success) {
                utilMgr.notify(
                    'Music Time',
                    `Successfully created ${name} and added tracks.`
                );
            } else {
                utilMgr.notify(
                    'Music Time',
                    `There was an unexpected error adding tracks to the playlist. ${addTracksResult.message}`
                );
            }
        }
    }

    async syncUsersWeeklyTopSongs() {
        const response = await softwareGet(
            '/music/recommendations?limit=40',
            utilMgr.getItem('jwt')
        );

        if (isResponseOk(response) && response.data.length > 0) {
            this._userTopSongs = response.data;
        } else {
            // clear the favorites
            this._userTopSongs = [];
        }
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    getMusicTimePlaylistByTypeId(playlistTypeId) {
        if (this._musictimePlaylists.length > 0) {
            for (let i = 0; i < this._musictimePlaylists.length; i++) {
                const playlist = this._musictimePlaylists[i];
                const typeId = playlist.playlistTypeId;
                if (typeId === playlistTypeId) {
                    return playlist;
                }
            }
        }
        return null;
    }

    async updateSavedPlaylists(playlist_id, playlistTypeId, name) {
        // i.e. playlistTypeId 1 = TOP_PRODUCIVITY_TRACKS
        // playlistTypeId 2 = SOFTWARE_TOP_SONGS_NAME
        const payload = {
            playlist_id,
            playlistTypeId,
            name,
        };
        let jwt = utilMgr.getItem('jwt');
        let createResult = await softwarePost(
            '/music/playlist/generated',
            payload,
            jwt
        );

        return createResult;
    }

    // get the custom playlist button by checkinf if the custom playlist
    // exists or not. if it doesn't exist then it will show the create label,
    // otherwise, it will show the refresh label
    getCustomPlaylistButton() {
        // update the existing playlist that matches the personal playlist with a paw if found
        const customPlaylist = this.getMusicTimePlaylistByTypeId(
            PERSONAL_TOP_SONGS_PLID
        );

        const personalPlaylistLabel = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TITLE
            : REFRESH_CUSTOM_PLAYLIST_TITLE;
        const personalPlaylistTooltip = !customPlaylist
            ? GENERATE_CUSTOM_PLAYLIST_TOOLTIP
            : REFRESH_CUSTOM_PLAYLIST_TOOLTIP;

        if (
            this._currentPlayerName !== PlayerName.ItunesDesktop &&
            !this.KpmMusicStoreManagerObj.requiresSpotifyAccess()
        ) {
            // add the connect spotify link
            let listItem = new PlaylistItem();
            listItem.tracks = new PlaylistTrackInfo();
            listItem.type = 'action';
            listItem.tag = 'action';
            listItem.id = 'codingfavorites';
            listItem.command = 'musictime.generateWeeklyPlaylist';
            listItem.playerType = PlayerType.WebSpotify;
            listItem.name = personalPlaylistLabel;
            listItem.tooltip = personalPlaylistTooltip;
            return listItem;
        }
        return null;
    }

    getMusicCodingData() {
        const file = utilMgr.getMusicSessionDataStoreFile();
        const initialValue = {
            add: 0,
            paste: 0,
            delete: 0,
            netkeys: 0,
            linesAdded: 0,
            linesRemoved: 0,
            open: 0,
            close: 0,
            keystrokes: 0,
            syntax: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offset: utilMgr.getOffsetSecends() / 60,
            pluginId: utilMgr.getPluginId(),
            os: utilMgr.getOs(),
            version: utilMgr.getVersion(),
            source: {},
        };
        try {
            if (fs.existsSync(file)) {
                const content = fs.readFileSync(file).toString();
                // we're online so just delete the datastore file
                utilMgr.deleteFile(file);
                if (content) {
                    const payloads = content
                        .split(/\r?\n/)
                        .map(item => {
                            let obj = null;
                            if (item) {
                                try {
                                    obj = JSON.parse(item);
                                } catch (e) {
                                    //
                                }
                            }
                            if (obj) {
                                return obj;
                            }
                        })
                        .filter(item => item);

                    // build the aggregated payload
                    const musicCodingData = this.buildAggregateData(
                        payloads,
                        initialValue
                    );
                    return musicCodingData;
                }
            } else {
                console.log('No keystroke data to send with the song session');
            }
        } catch (e) {
            console.log(`Unable to aggregate music session data: ${e.message}`);
        }
        return initialValue;
    }

    buildAggregateData(payloads, initialValue) {
        const numerics = [
            'add',
            'paste',
            'delete',
            'netkeys',
            'linesAdded',
            'linesRemoved',
            'open',
            'close',
            'keystrokes',
        ];
        if (payloads && payloads.length > 0) {
            payloads.forEach(element => {
                initialValue.keystrokes += element.keystrokes;
                if (element.source) {
                    // go through the source object
                    initialValue.source = element.source;
                    const keys = Object.keys(element.source);
                    if (keys && keys.length > 0) {
                        keys.forEach(key => {
                            let sourceObj = element.source[key];
                            const sourceObjKeys = Object.keys(sourceObj);
                            if (sourceObjKeys && sourceObjKeys.length > 0) {
                                sourceObjKeys.forEach(sourceObjKey => {
                                    const val = sourceObj[sourceObjKey];
                                    if (numerics.includes(sourceObjKey)) {
                                        // aggregate
                                        initialValue[sourceObjKey] += val;
                                    }
                                });
                            }

                            if (!initialValue.syntax && sourceObj.syntax) {
                                initialValue.syntax = sourceObj.syntax;
                            }

                            if (!sourceObj.timezone) {
                                sourceObj[
                                    'timezone'
                                ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
                            }
                            if (!sourceObj.offset) {
                                sourceObj['offset'] =
                                    utilMgr.getOffsetSecends() / 60;
                            }
                            if (!sourceObj.pluginId) {
                                sourceObj['pluginId'] = utilMgr.getPluginId();
                            }
                            if (!sourceObj.os) {
                                sourceObj['os'] = utilMgr.getOs();
                            }
                            if (!sourceObj.version) {
                                sourceObj['version'] = utilMgr.getVersion();
                            }
                        });
                    }
                }
            });
        }
        return initialValue;
    }

    async refreshPlaylistState() {
        if (this._spotifyPlaylists.length > 0) {
            // build the spotify playlist
            this._spotifyPlaylists.forEach(async playlist => {
                let playlistItemTracks = this._playlistTrackMap[playlist.id];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
            });
        }

        if (utilMgr.isMac()) {
            // build the itunes playlist
            if (this._itunesPlaylists.length > 0) {
                this._itunesPlaylists.forEach(async playlist => {
                    let playlistItemTracks = this._playlistTrackMap[
                        playlist.id
                    ];

                    if (playlistItemTracks && playlistItemTracks.length > 0) {
                        let playlistState = await this.getPlaylistState(
                            playlist.id
                        );
                        playlist.state = playlistState;
                    }
                });
            }
        }
    }

    getPlaylistById(playlist_id) {
        return this._playlistMap[playlist_id];
    }

    async isComputerDeviceRunning(devices) {
        // let isRunning = await isSpotifyRunning();

        const computerDevices =
            devices && devices.length > 0
                ? devices.filter(
                    (d) => d.type.toLowerCase() === "computer"
                )
                : [];
        const isRunning =
            computerDevices && computerDevices.length > 0 ? true : false;
        return isRunning;
    }

    async launchConfirm(devices, playlistItem) {
        const isRunning = await this.isComputerDeviceRunning(devices);
        let playerName = this.getPlayerNameForPlayback();
        let isLaunching = false;
        let proceed = true;
        const isWin = utilMgr.isWindows();
        const isPrem = await this.KpmMusicStoreManagerObj.isSpotifyPremium();

        // ask to show the desktop if they're a premium user
        let launchResult = null;
        let launchingDesktop = false;
        if (!isWin && !isRunning && isPrem) {
            proceed = false;
            let self = this;
            utilMgr.notifyButton(
                'Music Time',
                `Music Time requires a running Spotify player. Choose a player to launch.`,
                [
                    {
                        'className': 'btn btn-info',
                        'text': 'Web Player',
                        'onDidClick': async function () {
                            isLaunching = true;
                            launchingDesktop = false;
                            await launchPlayer(PlayerName.SpotifyWeb);
                            setTimeout( async () => {
                                await self.playSelectedItem(playlistItem, false);
                            }, 10000);
                            utilMgr.clearNotification();
                            
                        }
                    },
                    {
                        'className': 'btn btn-info',
                        'text': 'Desktop Player',
                        'onDidClick': async function () {
                            isLaunching = true;
                            launchingDesktop = true;
                            await launchPlayer(PlayerName.SpotifyDesktop);
                            setTimeout( async () => {
                                await self.playSelectedItem(playlistItem, false);
                            }, 30000);
                            utilMgr.clearNotification();

                        }
                    }
                ]
            )


        } else if (!isRunning) {
            if (isPrem) {
                playerName = PlayerName.SpotifyDesktop;
            }
            isLaunching = true;
            launchingDesktop = true;
            // it's a windows or non-premium user, launch spotify
            launchResult = await launchPlayer(playerName, {
                quietly: false
            });
        }

        if (launchingDesktop && launchResult && launchResult.error) {
            utilMgr.logIt(`Error launching desktop: ${launchResult.error}`);
        }

        // check to see if we've failed to launch the desktop player
        if (
            launchingDesktop &&
            launchResult &&
            launchResult.error &&
            playerName !== PlayerName.SpotifyWeb
        ) {
            // window.showInformationMessage(
            //     "Unable to launch the Spotify desktop player. Please confirm that it is installed."
            // );
            // launch the web player
            playerName = PlayerName.SpotifyWeb;
            await launchPlayer(PlayerName.SpotifyWeb);
            isLaunching = true;
        }

        const info = {
            isRunning,
            playerName,
            isLaunching,
            proceed
        };

        return info;
    }

    async playSelectedItem(playlistItem, isExpand = true) {


        const devices = await getSpotifyDevices();
        const launchConfirmInfo = await this.launchConfirm(devices,playlistItem);
        if (!launchConfirmInfo.proceed) {
            return;
        }
        this.currentProvider = PLAYLISTS_PROVIDER;
        const launchTimeout = 4000;
        const isTrackOrPlaylist =
            playlistItem.type === 'track' || playlistItem.type === 'playlist';

        let currentPlaylistId = playlistItem['playlist_id'];

        // !important! set the selected track
        this.selectedTrackItem = playlistItem;

        // make sure we have a selected playlist
        if (utilMgr.isEmptyObj(this._playlistMap)) {
            const playlist = await this.getPlaylistById(currentPlaylistId);
            this._selectedPlaylist = playlist;
        }
        if (playlistItem.playerType === PlayerType.MacItunesDesktop) {
            const pos = playlistItem.position || 1;
            await playItunesTrackNumberInPlaylist(
                this._selectedPlaylist.name,
                pos
            );
        } else if (launchConfirmInfo.playerName === PlayerName.SpotifyDesktop) {
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    this.playSpotifyDesktopPlaylistTrack();
                }, launchTimeout);
            } else {
                this.playSpotifyDesktopPlaylistTrack();
            }
        } else {
            if (launchConfirmInfo.isLaunching) {
                setTimeout(() => {
                    this.launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
                }, launchTimeout);
            } else {
                this.launchAndPlaySpotifyWebPlaylistTrack(true /*isTrack*/);
            }
        }


        // check spotify song state if the device list is empty. this will
        // alert the user they may need to log on to spotify if we're unable to
        // play a track
        if (
            !isExpand &&
            isTrackOrPlaylist &&
            playlistItem.playerType !== PlayerType.MacItunesDesktop
        ) {
            const devices = await getSpotifyDevices();
            if (!devices || devices.length === 0) {
                this.checkSpotifySongState(true /*missingDevices*/);
            }
        }
    }

    /**
     * Launch and play a spotify track via the web player.
     * @param isTrack boolean
     */
    launchAndPlaySpotifyWebPlaylistTrack = async isTrack => {
        // get the selected playlist
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
        // get the selected track
        const selectedTrack = this.selectedTrackItem;

        const isLikedSongsPlaylist =
            selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;

        if (isTrack) {
            if (isLikedSongsPlaylist) {
                // a track was selected
                await launchAndPlaySpotifyTrack(selectedTrack.id);
            } else {
                await launchAndPlaySpotifyTrack(
                    selectedTrack.id,
                    selectedPlaylist.id
                );
            }
        } else {
            if (isLikedSongsPlaylist) {
                // play the 1st track in the non-playlist liked songs folder
                await launchAndPlaySpotifyTrack(
                    selectedTrack.id,
                    selectedPlaylist.id
                );
            } else {
                // use the normal play playlist by offset 0 call
                await launchAndPlaySpotifyTrack('', selectedPlaylist.id);
            }
        }
    };
    /**
     * Helper function to play a track or playlist if we've determined to play
     * against the mac spotify desktop app.
     */
    playSpotifyDesktopPlaylistTrack = () => {
        // get the selected playlist
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
        // get the selected track
        const selectedTrack = this.selectedTrackItem;
        const isLikedSongsPlaylist =
            selectedPlaylist.name === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME
                ? true
                : false;
        if (isLikedSongsPlaylist) {
            // just play the 1st track
            playSpotifyMacDesktopTrack(selectedTrack.id);
        } else {
            // ex: ["spotify:track:0R8P9KfGJCDULmlEoBagcO", "spotify:playlist:6ZG5lRT77aJ3btmArcykra"]
            // make sure the track has spotify:track and the playlist has spotify:playlist
            playSpotifyMacDesktopTrack(selectedTrack.id, selectedPlaylist.id);
        }
    };

    async launchAndPlayTrack(track, spotifyUser) {
        const musicCtrlMgr = new KpmMusicControlManager();
        const currentPlaylist = this._selectedPlaylist;
        // check if there's any spotify devices
        const spotifyDevices = await getSpotifyDevices();
        if (!spotifyDevices || spotifyDevices.length === 0) {
            // no spotify devices found, lets launch the web player with the track

            // launch it
            await launchPlayer(PlayerName.SpotifyWeb);
            // now select it from within the playlist
            setTimeout(() => {
                musicCtrlMgr.playSpotifyTrackFromPlaylist(
                    spotifyUser,
                    currentPlaylist.id,
                    track,
                    spotifyDevices,
                    this.selectedTrackItem,
                    this._selectedPlaylist,
                    5 /* checkTrackStateAndTryAgain */
                );
            }, 1000);
        } else {
            // a device is found, play using the device
            await musicCtrlMgr.playSpotifyTrackFromPlaylist(
                spotifyUser,
                currentPlaylist.id,
                track,
                spotifyDevices,
                this.selectedTrackItem,
                this._selectedPlaylist
            );
        }
    }
    playSpotifySongById(track) {
        const musicCtrlMgr = new KpmMusicControlManager();
        let track_uri = track.id.includes('spotify:track')
            ? track.id
            : `spotify:track:${track.id}`;
        musicCtrlMgr.playSongById(PlayerName.SpotifyDesktop, track_uri);
        this.checkSpotifySongState(track_uri);
    }

    checkSpotifySongState(track_uri) {
        if (checkSpotifyStateTimeout) {
            clearTimeout(checkSpotifyStateTimeout);
        }
        checkSpotifyStateTimeout = setTimeout(async () => {
            // make sure we get that song, if not then they may not be logged in
            let playingTrack = await getRunningTrack();

            let playingTrackUri = '';
            if (playingTrack) {
                if (playingTrack['spotify_url']) {
                    playingTrackUri = playingTrack['spotify_url'];
                } else if (playingTrack.uri) {
                    playingTrackUri = playingTrack.uri;
                } else if (playingTrack.id) {
                    playingTrackUri = playingTrack.id;
                }
            }

            if (playingTrackUri !== track_uri) {
                // they're not logged in
                // window.showInformationMessage(
                //     "We're unable to play the selected Spotify track. Please make sure you are logged in to your account. You will need the Spotify desktop app if you have a non-premium Spotify account.",
                //     ...["Ok"]
                // );
            }
        }, 3000);
    }

    async playSpotifySongInPlaylist(playlist, track) {
        const musicCtrlMgr = new KpmMusicControlManager();
        let track_uri = track.id.includes('spotify:track')
            ? track.id
            : `spotify:track:${track.id}`;
        let playlist_uri = playlist.id.includes('spotify:playlist')
            ? playlist.id
            : `spotify:playlist:${playlist.id}`;
        let params = [track_uri, playlist_uri];
        await musicCtrlMgr.playSongInContext(params);
        this.checkSpotifySongState(track_uri);
    }

    async initializeSpotify() {
        const serverIsOnline = await utilMgr.serverIsAvailable();
        localStorage.setItem('_selectedPlaylistId', '');

        if (
            !utilMgr.getItem('spotify_access_token') ||
            !utilMgr.getItem('spotify_refresh_token')
        ) {
            await utilMgr.refetchSpotifyConnectStatusLazily();
        } else {
            const spotifyOauth = {
                access_token: utilMgr.getItem('spotify_access_token'),
                refresh_token: utilMgr.getItem('spotify_refresh_token'),
            };
            await this.updateSpotifyAccessInfo(spotifyOauth);

            await this.refreshPlaylists();
        }

        await userstatusMgr.getUserStatus(serverIsOnline);

        this.initialized = true;
        // await this.refreshPlaylists()
    }

    async updateSpotifyAccessInfo(spotifyOauth) {
        if (spotifyOauth) {
            // update the CodyMusic credentials
            utilMgr.setItem('spotify_access_token', spotifyOauth.access_token);
            utilMgr.setItem(
                'spotify_refresh_token',
                spotifyOauth.refresh_token
            );

            // update cody config
            await this.updateCodyConfig();

            // get the user
            this.spotifyUser = await getUserProfile();
        } else {
            this.clearSpotifyAccessInfo();
        }
    }

    async clearSpotifyAccessInfo() {
        utilMgr.setItem('spotify_access_token', null);
        utilMgr.setItem('spotify_refresh_token', null);
        this.spotifyUser = null;

        // update cody config
        this.updateCodyConfig();
    }

    /**
     * Update the cody config settings for cody-music
     */
    async updateCodyConfig() {
        const serverIsOnline = await utilMgr.serverIsAvailable();
        let clientId, clientSecret;
        // get the client id and secret
        if (serverIsOnline) {
            let jwt = utilMgr.getItem('jwt');
            if (!jwt) {
                jwt = await utilMgr.getAppJwt(serverIsOnline);
            }
            const resp = await softwareGet('/auth/spotify/clientInfo', jwt);
            if (isResponseOk(resp)) {
                // get the clientId and clientSecret
                clientId = resp.data.clientId;
                clientSecret = resp.data.clientSecret;
            }
        }

        this._spotifyClientId = clientId;
        this._spotifyClientSecret = clientSecret;

        const accessToken = utilMgr.getItem('spotify_access_token');
        const refreshToken = utilMgr.getItem('spotify_refresh_token');

        const codyConfig = new CodyConfig();
        codyConfig.enableItunesDesktop = false;
        codyConfig.enableItunesDesktopSongTracking = utilMgr.isMac();
        codyConfig.enableSpotifyDesktop = utilMgr.isMac();
        codyConfig.spotifyClientId = this._spotifyClientId;
        codyConfig.spotifyAccessToken = accessToken;
        codyConfig.spotifyRefreshToken = refreshToken;
        codyConfig.spotifyClientSecret = this._spotifyClientSecret;
        setConfig(codyConfig);
    }

    async displayMusicTimeMetricsMarkdownDashboard() {
        if (fetchingMusicTimeMetrics) {
            window.showInformationMessage(
                `Still building Music Time dashboard, please wait...`
            );
            return;
        }
        fetchingMusicTimeMetrics = true;

        window.showInformationMessage(
            `Building Music Time dashboard, please wait...`
        );

        const musicTimeFile = utilMgr.getMusicTimeMarkdownFile();
        await fetchMusicTimeMetricsMarkdownDashboard();

        const viewOptions = {
            viewColumn: ViewColumn.One,
            preserveFocus: false,
        };
        const localResourceRoots = [
            Uri.file(getSoftwareDir()),
            Uri.file(tmpdir()),
        ];
        const panel = window.createWebviewPanel(
            'music-time-preview',
            `Music Time Dashboard`,
            viewOptions,
            {
                enableFindWidget: true,
                localResourceRoots,
                enableScripts: true, // enables javascript that may be in the content
            }
        );

        const content = fs.readFileSync(musicTimeFile).toString();
        panel.webview.html = content;

        window.showInformationMessage(
            `Completed building Music Time dashboard.`
        );
        fetchingMusicTimeMetrics = false;
    }
    async fetchMusicTimeMetricsMarkdownDashboard() {
        let file = utilMgr.getMusicTimeMarkdownFile();

        const dayOfMonth = moment()
            .startOf('day')
            .date();
        if (!fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
            lastDayOfMonth = dayOfMonth;
            await fetchDashboardData(file, 'music-time', true);
        }
    }

    async fetchDashboardData(fileName, plugin, isHtml) {
        const musicSummary = await softwareGet(
            `/dashboard?plugin=${plugin}&linux=${isLinux()}&html=${isHtml}`,
            utilMgr.getItem('jwt')
        );

        // get the content
        let content =
            musicSummary && musicSummary.data ? musicSummary.data : NO_DATA;

        fs.writeFileSync(fileName, content, err => {
            if (err) {
                utilMgr.logIt(
                    `Error writing to the Software dashboard file: ${err.message}`
                );
            }
        });
    }

    async updateSlackAccessInfo(slackOauth) {
        /**
         * {access_token, refresh_token}
         */
        if (slackOauth) {
            utilMgr.setItem('slack_access_token', slackOauth.access_token);
        } else {
            utilMgr.setItem('slack_access_token', null);
        }
    }

    clearSavedPlaylists() {
        this._savedPlaylists = [];
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists(playlists) {
        for (let i = 0; i < this._savedPlaylists.length; i++) {
            const savedPlaylist = this._savedPlaylists[i];

            // find the saved playlist in the spotify playlist list
            let foundItem = playlists.find(element => {
                return element.id === savedPlaylist.id;
            });

            // the backend should protect this from deleting the global top 40
            // as we're unsure if the playlist we're about to reconcile/delete
            // is the custom playlist or global top 40
            if (!foundItem) {
                // remove it from the server
                await softwareDelete(
                    `/music/playlist/generated/${savedPlaylist.id}`,
                    utilMgr.getItem('jwt')
                );
            } else if (foundItem.name !== savedPlaylist.name) {
                // update the name on software
                const payload = {
                    name: foundItem.name,
                };
                await softwarePut(
                    `/music/playlist/generated/${savedPlaylist.id}`,
                    payload,
                    utilMgr.getItem('jwt')
                );
            }
        }

        setTimeout(() => {
            $('#refresh-treeview').attr('src', REFRESH_ICON);
        }, 3000);
    }

    getPlayerNameForPlayback() {
        // if you're offline you may still have spotify desktop player abilities.
        // check if the current player is spotify and we don't have web access.
        // if no web access, then use the desktop player
        if (
            this._currentPlayerName === PlayerName.SpotifyWeb &&
            utilMgr.isMac() &&
            !this.KpmMusicStoreManagerObj.hasSpotifyPlaybackAccess()
        ) {
            return PlayerName.SpotifyDesktop;
        }
        return this._currentPlayerName;
    }
}
