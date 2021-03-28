'use babel';

import $ from 'jquery';
import { execCmd } from "../managers/ExecManager";
import {
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    PAUSE_CONTROL_ICON,
    SOFTWARE_TOP_40_PLAYLIST_ID,
    TIME_RELOAD,
    REFRESH_ICON,
    SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID,
} from '../Constants';
import {
    isResponseOk,
    softwareGet,
    softwarePost,
    softwareDelete,
    softwarePut,
} from '../client/HttpClient';
import { requiresSpotifyAccess } from "../managers/IntegrationManager";
import {
    getSpotifyPlaylist,
    PlaylistItem,
    PlayerType,
    PlayerName,
    getPlaylists,
    TrackStatus,
    Track,
    getTrack,
    getPlaylistTracks,
    CodyResponseType,
    PlaylistTrackInfo,
    createPlaylist,
    addTracksToPlaylist,
    replacePlaylistTracks,
    getRecommendationsForTracks,
} from 'cody-music';
import { MusicDataManager } from './MusicDataManager';
import { getSpotifyUser, populateSpotifyUserProfile } from "../managers/SpotifyManager";

const treeViewManager = require("./TreeViewManager");
const utilMgr = require('../managers/UtilManager');
const commonUtil = require("../utils/CommonUtil");
const fileUtil = require('../utils/FileUtil');
const moment = require('moment-timezone');
const deviceMgr = require('./DeviceManager');
const fileIt = require("file-it");
const fs = require('fs');

let lastDayOfMonth = -1;
let numerics = [
    "add",
    "paste",
    "delete",
    "netkeys",
    "linesAdded",
    "linesRemoved",
    "open",
    "close",
    "keystrokes",
];

//
// KpmMusicManager - handles software session management
//

$(document).ready(function(e) {
    $(document).on('click', '.play-playlist', function(event) {
        event.stopPropagation();

        // if ($(event.target).is('.play-playlist')) {
        //     console.log(event);
        // }
        var _self = this;
        localStorage.setItem('_selectedPlaylistId', $(_self).attr('node-id'));
        localStorage.setItem('_selectedPlaylistTrackId', '');
        localStorage.setItem('isPlaylist', '1');
        if ($(_self).attr('node-id') != '') {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:play-playlist-song'
            );
        }
    });

    $(document).on('click', 'li.play-list', function(e) {
        var _self = this;
        localStorage.setItem('_selectedPlaylistId', $(_self).attr('node-id'));
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:toggle-playlist'
        );
    });

    $(document).on('click', '.playlist-nested-item', function(e) {
        e.stopPropagation();
        var _self = this;
        let _selectedPlaylistTrackId = $(_self).attr('node-id');
        localStorage.setItem(
            '_selectedPlaylistTrackId',
            _selectedPlaylistTrackId
        );
        if (_selectedPlaylistTrackId == '') {
            return false;
        }
        localStorage.setItem('isPlaylist', '0');
        // set the selected playlist id from the parent node id
        localStorage.setItem(
            '_selectedPlaylistId',
            $(_self).attr('parent-node-id')
        );

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:play-playlist-song'
        );
    });
    $(document).on('click', '.playlist-recommend-item', function(e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem(
            '_selectedPlaylistTrackId',
            $(_self).attr('node-id')
        );
        localStorage.setItem('isPlaylist', '0');
        localStorage.setItem(
            '_selectedPlaylistId',
            SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
        );

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:play-recommend-song'
        );
    });
});

$(document).on('click', '#refresh-treeview', async function(e) {
    e.stopPropagation();
    $('#refresh-treeview').attr('src', TIME_RELOAD);
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:refresh-treeview'
    );
});

$(document).on('click', '#song-search', async function(e) {
    e.stopPropagation();
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:song-search'
    );
});

export default class KpmMusicManager {
    constructor() {
        this.structureViewObj = treeViewManager.getStructureView();
        this.dataMgr = MusicDataManager.getInstance();
        this.dataMgr.savedPlaylists = [];
        this.lastSongSessionStart = 0;
        this._refreshingPlaylist = false;
        this._playlistMap = {};
        this._itunesPlaylists = [];
        this._musictimePlaylists = [];
        this._softwareTopSongs = [];
        this.userTopSongs = [];
        this._playlistTrackMap = {};
        this._selectedPlaylist = [];
        this._initialized = false;
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

        this.endCheckTimeout = null;
        this.endCheckThresholdMillis = 1000 * 19; // 19 seconds
        this.lastSongCheck = 0;

        if (!this.dataMgr) {
            this.dataMgr = MusicDataManager.getInstance();
        }
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new KpmMusicManager();
        }
        return this.instance;
    }

    get currentPlaylists() {
        if (this.dataMgr.spotifyPlaylists && this.dataMgr.spotifyPlaylists.length) {
            this.dataMgr.spotifyPlaylists.forEach(item => {
                if (item.type === 'playlist') {
                    this._playlistMap[item.id] = item;
                }
            });
        }
        return this.dataMgr.spotifyPlaylists;
    }

    async togglePlaylist() {
        this._selectedPlaylistId = localStorage.getItem('_selectedPlaylistId');

        let isCollapsed = $(
            '[node-id=' + this._selectedPlaylistId + ']'
        ).hasClass('collapsed');
        if (isCollapsed) {
            await this.showPlaylistItems(this._selectedPlaylistId);
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
            let selectedPlaylistId = this._selectedPlaylistId;
            this.dataMgr.spotifyPlaylists.map(playlist => {
                if (selectedPlaylistId == playlist.id) {
                    playlist.isSelected = false;
                }
                return playlist;
            });
        }
        return;
    }

    async playPlaylistSong() {
        const deviceId = await deviceMgr.getDeviceId();

        // check to see if there's a running device, if not start
        // the launch sequence
        if (!deviceId) {
            return deviceMgr.launchConfirm(this.playIt);
        }

        this.playIt();
    }

    async playIt() {
        await deviceMgr.playTrack();

        $('#play-image-' + this._selectedPlaylistId).attr(
            'src',
            PAUSE_CONTROL_ICON
        );
    }

    async isMacMusicPlayerActive(player) {
        const command = `pgrep -x ${player}`;
        const result = execCmd(command);
        if (result) {
            return true;
        }
        return false;
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

    hasSpotifyUser() {
        const spotifyUser = getSpotifyUser();
        let hasSpotifyUser =
            spotifyUser && spotifyUser.product ? true : false;
        this.dataMgr.hasSpotifyUser = hasSpotifyUser;
        return hasSpotifyUser;
    }

    isSpotifyPremium() {
        const spotifyUser = getSpotifyUser();
        this.dataMgr.isSpotifyPremium = spotifyUser && spotifyUser.product === 'premium'
            ? true
            : false;
        return this.dataMgr.isSpotifyPremium;
    }

    updateTrackPlaylistId(track) {
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
        if (selectedPlaylist) {
            track['playlistId'] = selectedPlaylist.id;
        }
    }

    isValidTrack(playingTrack) {
        if (playingTrack && playingTrack.id) {
            return true;
        }
        return false;
    }

    async fetchTrack() {
        const utcLocalTimes = utilMgr.getUtcAndLocal();

        const diff = utcLocalTimes.utc - this.lastSongCheck;
        if (diff > 0 && diff < 1) {
            // it's getting called too quickly, bail out
            return;
        }
        const isMac = commonUtil.isMac();
        const requiresAccess = requiresSpotifyAccess();
        if (requiresAccess) {
            // either no device ID, requires spotify connection,
            // or it's a windows device that is not online
            return;
        }

        const deviceId = deviceMgr.getDeviceId();

        // check if we've set the existing device id but don't have a device
        if ((!this.existingTrack || !this.existingTrack.id) && !deviceId) {
            // no existing track and no device, skip checking
            return;
        }

        let playingTrack = null;
        try {

            if (isMac) {
                // try the desktop
                playingTrack = await getTrack(PlayerName.SpotifyDesktop);
                if (!playingTrack || !playingTrack.name) {
                    // we didn't get the name, get it from the web player
                    playingTrack = await getTrack(PlayerName.SpotifyWeb);
                }
            } else {
                playingTrack = await getTrack(PlayerName.SpotifyWeb);
            }

            // this one is always set
            this.lastSongCheck = utcLocalTimes.utc;

            if (
                !playingTrack ||
                (playingTrack && playingTrack.httpStatus >= 400)
            ) {
                // currently unable to fetch the track
                return;
            }

            const isValidTrack = this.isValidTrack(playingTrack);

            if (isValidTrack) {
                if (playingTrack.uri) {
                    playingTrack.uri = utilMgr.createUriFromTrackId(
                        playingTrack.id
                    );
                }
                playingTrack.id = utilMgr.createSpotifyIdFromUri(
                    playingTrack.id
                );
            }

            const isNewTrack =
                this.existingTrack.id !== playingTrack.id ? true : false;
            const sendSongSession =
                isNewTrack && this.existingTrack.id ? true : false;
            const trackStateChanged =
                this.existingTrack.state !== playingTrack.state ? true : false;

            // has the existing track ended or have we started a new track?
            if (sendSongSession) {
                // just set it to playing
                this.existingTrack.state = TrackStatus.Playing;

                // clear the track.
                this.existingTrack = null;

                if (playingTrack) {
                    this.existingTrack = new Track();
                }
            }

            if (
                !this.existingTrack ||
                this.existingTrack.id !== playingTrack.id
            ) {
                // update the entire object if the id's don't match
                this.existingTrack = { ...playingTrack };
            }

            if (this.existingTrack.state !== playingTrack.state) {
                // update the state if the state doesn't match
                this.existingTrack.state = playingTrack.state;
            }

            // set the start for the playing track
            if (
                this.existingTrack &&
                this.existingTrack.id &&
                !this.existingTrack['start']
            ) {
                this.existingTrack['start'] = utcLocalTimes.utc;
                this.existingTrack['local_start'] = utcLocalTimes.local;
                this.existingTrack['end'] = 0;
            }

            // make sure we set the current progress and duratio
            if (isValidTrack) {
                this.existingTrack.duration = playingTrack.duration || 0;
                this.existingTrack.duration_ms = playingTrack.duration_ms || 0;
                this.existingTrack.progress_ms = playingTrack.progress_ms || 0;
            }

            this.dataMgr.runningTrack = this.existingTrack;

            if (isNewTrack) {
                // update the playlistId
                this.updateTrackPlaylistId(playingTrack);
            }

            if (trackStateChanged && this.existingTrack && !this.existingTrack.id) {
                // update the device info in case the device has changed
                await deviceMgr.populateSpotifyDevices(true);
            }

            this.structureViewObj.updateDevice();

            utilMgr.showStatus();
        } catch (e) {
            const errMsg = e.message || e;
            utilMgr.logIt(`Unexpected track state processing error: ${errMsg}`);
        }

        utilMgr.updateStatus();
    }

    updateTrackPlaylistId(playingTrack) {
        if (this._selectedPlaylistId) {
            playingTrack['playlistId'] = this._selectedPlaylistId;
        }
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

    async refreshPlaylists(needsRefresh = false, isRecommendTree = false) {
        if (this._refreshingPlaylist) {
            return;
        }
        this._refreshingPlaylist = true;
        this._selectedPlaylistId = null;
        this._runningTrack = this.dataMgr.runningTrack;

        await this.showSpotifyPlaylists(needsRefresh, isRecommendTree);
        await this.syncControls(this._runningTrack);
        this._refreshingPlaylist = false;
    }

    async showSpotifyPlaylists(needsRefresh = false, isRecommendTree) {
        let _self = this;
        const requiresAccess = requiresSpotifyAccess();

        this._selectedPlaylistId =
            this._selectedPlaylistId ||
            localStorage.getItem('_selectedPlaylistId');
        // if no playlists are found for spotify, then fetch
        let foundPlaylist = this.dataMgr.spotifyPlaylists
            ? this.dataMgr.spotifyPlaylists.find(element => {
                return element.type === 'playlist';
            })
            : null;
        if (!requiresAccess && (!foundPlaylist || needsRefresh)) {
            await this.refreshPlaylistForPlayer(this.getPlayerNameForPlayback());
        }

        const hasSpotifyPlaylists =
            this.dataMgr.spotifyPlaylists && this.dataMgr.spotifyPlaylists.length
                ? true
                : false;
        const hasLikedSongs =
            this.dataMgr.spotifyLikedSongs &&
                this.dataMgr.spotifyLikedSongs.length
                ? true
                : false;

        // update liked songs
        if (!requiresAccess && (needsRefresh || !hasSpotifyPlaylists)) {
            await utilMgr.populateLikedSongs();
        }

        if (this._selectedPlaylistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
            this._selectedPlaylist = this.dataMgr.spotifyLikedSongs;
        } else if (this._selectedPlaylistId) {
            this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                this._selectedPlaylistId
            );
        }

        if (!requiresAccess) {
            if (this.dataMgr.recommendationTracks && this.dataMgr.recommendationTracks.length) {
                this.updateRecommendationPlaylistData();
            } else {
                // build the recommendations
                await this.updateRecommendations();
            }

            this._playlistMap[
                SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
            ] = this.dataMgr.recommendationPlaylist;

            this.dataMgr.spotifyPlaylists.map(function(item) {
                if (item.id === _self._selectedPlaylistId) {
                    item.child = _self._selectedPlaylist;
                    item['isSelected'] = true;
                }
                return item;
            });

            // show the devices listening folder if they've already connected oauth;
            let premiumAccountRequired =
                !commonUtil.isMac() && !this.isSpotifyPremium()
                    ? true
                    : false;

            this.structureViewObj.initialize(
                this._selectedPlaylistTrackId
            );
        } else {
            // requires spotify access, show init view
            this.structureViewObj.showDisconnectedTree();
        }
    }

    async updateSort(sortAlpha) {
        if (!requiresSpotifyAccess()) {
            this.sortAlphabetically = sortAlpha;
            await this.refreshPlaylists(true);
            utilMgr.clearNotification();
        }
    }

    async updateSavedPlaylists(playlist_id, playlistTypeId, name) {
        // playlistTypeId 1 = personal custom top 40
        const payload = {
            playlist_id,
            playlistTypeId,
            name,
        };
        let jwt = fileUtil.getItem('jwt');
        let createResult = await softwarePost(
            '/music/playlist/generated',
            payload,
            jwt
        );

        return createResult;
    }

    //
    // Fetch the playlist names for a specific player
    //
    async refreshPlaylistForPlayer(playerName) {
        let spotifyUser = getSpotifyUser();
        const needsSpotifyAccess = requiresSpotifyAccess();
        if (!needsSpotifyAccess && (!spotifyUser || !spotifyUser.uri)) {
            populateSpotifyUserProfile();
        }
        let items = [];

        // populate the dataMgr with spotify user info
        const hasSpotifyUser = this.hasSpotifyUser();
        const isSpotifyPremium = this.isSpotifyPremium();

        let playlists = [];
        let type = 'spotify';
        if (playerName === PlayerName.ItunesDesktop) {
            type = 'itunes';
        }
        // there's nothing to get if it's windows and they don't have
        // a premium spotify account
        let premiumAccountRequired =
            !commonUtil.isMac() && !this.isSpotifyPremium() ? true : false;

        // If access, perform common tasks any spotify user can perform
        if (!needsSpotifyAccess) {
            // fire off the populate spotify devices
            await deviceMgr.populateSpotifyDevices();
        }

        if (!needsSpotifyAccess) {
            playlists = await getPlaylists(PlayerName.SpotifyWeb, {
                all: true,
            });
        }

        if (
            !this.dataMgr.savedPlaylists ||
            this.dataMgr.savedPlaylists.length === 0
        ) {
            // fetch and reconcile the saved playlists against the spotify list
            await this.dataMgr.fetchSavedPlaylists();
        }

        // reconcile in case the fetched playlists doesn't contain
        // one we've generated, or the name has changed
        if (this.dataMgr.savedPlaylists.length && playlists.length) {
            await this.dataMgr.reconcilePlaylists();
        }

        // sort
        if (this.sortAlphabetically) {
            this.sortPlaylists(playlists);
        }

        // go through each playlist and find out it's state
        if (playlists && playlists.length) {
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
                playlist.tag = 'user-playlist';
            }
        }

        // filter out the music time playlists into it's own list if we have any
        this.retrieveMusicTimePlaylist(playlists);

        // add the no music time connection button if we're not online

        // add the action items specific to spotify
        if (!needsSpotifyAccess) {
            // playlists.push(this.getSpotifyLikedPlaylistFolder());
            this._playlistMap[
                SPOTIFY_LIKED_SONGS_PLAYLIST_ID
            ] = this.getSpotifyLikedPlaylistFolder();
        }
        // line break between actions and software playlist section
        items.push(this.getLineBreakButton());

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

        this._playlistMap[softwareTop40.id] = softwareTop40;

        localStorage.setItem(
            '_playlistMap',
            JSON.stringify(this._playlistMap)
        );

        items.push(likedSongItem);

        if (playlists.length > 0) {
            items.push(this.getLineBreakButton());
        }

        playlists.forEach(item => {
            if (item.name != 'Software Top 40') {
                items.push(item);
            }
        });
        this.userPlaylist = playlists;

        // line break between actions and software playlist section
        items.push(this.getSectionBreakButton());

        this.dataMgr.spotifyPlaylists = items;

        // build tracks for recommendations
        if (!this.dataMgr.trackIdsForRecommendations
            || this.dataMgr.trackIdsForRecommendations.length === 0) {
            await utilMgr.buildTracksForRecommendations(this.dataMgr.spotifyPlaylists);
            await this.updateRecommendations('Familiar', 5);
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
            spotifyPlaylists = spotifyPlaylists.map(async function(item) {
                if (!item.child || item.child.length == 0) {
                    item.child = await _self.getPlaylistItemTracksForPlaylistId(
                        item.id
                    );
                }
            });
        }
        return spotifyPlaylists;
    }

    hasTracks(trackAttr) {
        return trackAttr && trackAttr.length ? true : false;
    }

    async showPlaylistItems(playlist_id) {
        let _self = this;
        this._selectedPlaylistId = playlist_id;

        if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
            if (!this.hasTracks(this.dataMgr.spotifyLikedSongs)) {
                await utilMgr.populateLikedSongs();
                if (!this.hasTracks(this.dataMgr.spotifyLikedSongs)) {
                    return setTimeout(async () => {
                        await utilMgr.populateLikedSongs();
                        _self.populateTracksInTree(playlist_id);
                    }, 3000);
                }
            }
            this._selectedPlaylist = this.getPlaylistItemTracksFromTracks(
                this.dataMgr.spotifyLikedSongs
            );
        } else if (playlist_id === SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID) {
            this.updateRecommendationPlaylistData();
            return this.structureViewObj.refreshTreeView();
        } else {
            this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                playlist_id
            );
            if (!this.hasTracks(this._selectedPlaylist)) {
                return setTimeout(async () => {
                    this._selectedPlaylist = await this.getPlaylistItemTracksForPlaylistId(
                        playlist_id
                    );
                    _self.populateTracksInTree(playlist_id);
                }, 3000);
            }
        }
        this.populateTracksInTree(playlist_id);
    }

    async populateTracksInTree(playlist_id) {
        let foundPlaylist = this.dataMgr.spotifyPlaylists
            ? this.dataMgr.spotifyPlaylists.find(element => {
                return element.type === 'playlist';
            })
            : null;
        if (!foundPlaylist) {
            await this.refreshPlaylistForPlayer(PlayerName.SpotifyWeb);
        }

        let _self = this;
        this.dataMgr.spotifyPlaylists.map(function(item) {
            if (item.id == playlist_id) {
                item.child = _self._selectedPlaylist;
            }
        });

        const devicesFound = await deviceMgr.getActiveSpotifyDevicesButton();

        this.structureViewObj.initialize(
            this._selectedPlaylistTrackId
        );
    }

    async syncControls(track, statusOverride) {
        this._runningTrack = track;
        // update the playlist
        const selectedPlaylist = this._playlistMap[this._selectedPlaylistId];
        if (selectedPlaylist) {
            await this.clearPlaylistTracksForId(selectedPlaylist.id);
            await this.refreshPlaylistState();
        }

        let pauseIt = trackStatus === TrackStatus.Playing;
        let playIt = trackStatus === TrackStatus.Paused;

        if (statusOverride) {
            if (statusOverride === TrackStatus.Playing) {
                playIt = false;
                pauseIt = true;
            } else {
                playIt = true;
                pauseIt = false;
            }
        }

        const trackStatus = track ? track.state : TrackStatus.NotAssigned;
    }

    //
    // Fetch the tracks for a given playlist ID
    //
    async getPlaylistItemTracksForPlaylistId(playlist_id) {
        let playlistItemTracks = this._playlistTrackMap[playlist_id];

        if (!playlistItemTracks || playlistItemTracks.length === 0) {
            // fetch from spotify web
            if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                let tracks = this.dataMgr.spotifyLikedSongs;
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

        return playlistItems.length > 0
            ? playlistItems
            : this.createPlaylistItemForEmptyPlaylist();
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
        return playlistItems.length > 0
            ? playlistItems
            : this.createPlaylistItemForEmptyPlaylist();
    }

    createPlaylistItemForEmptyPlaylist() {
        let playlistItems = [];
        let playlistItem = new PlaylistItem();

        playlistItem.type = 'playlist';
        playlistItem.name = 'Your tracks will appear here';

        playlistItem.itemType = 'empty';
        playlistItems.push(playlistItem);

        return playlistItems;
    }
    createPlaylistItemFromTrack(track, position) {
        let playlistItem = new PlaylistItem();
        if (!this._runningTrack) {
            this._runningTrack = track;
        }
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

        if (track && this._runningTrack && track.id === this._runningTrack.id) {
            playlistItem.state = this._runningTrack.state;
            this._selectedTrackItem = playlistItem;
        } else {
            playlistItem.state = TrackStatus.NotAssigned;
        }
        return playlistItem;
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
            (this.dataMgr.savedPlaylists &&
                this.dataMgr.savedPlaylists.length > 0) ||
            playlists.length > 0
        ) {
            for (let i = 0; i < this.dataMgr.savedPlaylists.length; i++) {
                let savedPlaylist = this.dataMgr.savedPlaylists[i];
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

    //
    // Fetch the playlist overall state
    //
    async getPlaylistState(playlist_id) {
        let playlistState = TrackStatus.NotAssigned;
        this._runningTrack = this.dataMgr.runningTrack;
        if (playlist_id) {
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
        }

        return playlistState;
    }
    clearPlaylistTracksForId(playlist_id) {
        this._playlistTrackMap[playlist_id] = null;
    }

    getSpotifyLikedPlaylistFolder() {
        const item = new PlaylistItem();
        item.type = 'playlist';
        item.id = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
        item.tracks = new PlaylistTrackInfo();
        // set set a number so it shows up
        item.tracks.total = 1;
        item.playerType = PlayerType.WebSpotify;
        item.tag = 'liked';
        item.itemType = 'playlist';
        item.name = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
        return item;
    }

    getRecommendationPlaylistFolder() {
        const item = new PlaylistItem();
        item.type = 'playlist';
        item.id = SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID;
        item.tracks = new PlaylistTrackInfo();
        // set set a number so it shows up
        item.tracks.total = 1;
        item.playerType = PlayerType.WebSpotify;
        item.tag = 'paw';
        item.itemType = 'playlist';
        item.name = this.dataMgr.recommendationLabel;
        return item;
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
    getSectionBreakButton() {
        return this.buildActionItem(
            'title',
            'sectionDivider',
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

    async populateSpotifyPlaylists() {
        // reconcile playlists
        this.dataMgr.reconcilePlaylists();

        // clear out the raw and orig playlists
        this.dataMgr.origRawPlaylistOrder = [];
        this.dataMgr.rawPlaylists = [];

        // fire off the populate spotify devices
        await deviceMgr.populateSpotifyDevices();

        // fetch music time app saved playlists
        await this.dataMgr.fetchSavedPlaylists();
        // fetch the playlists from spotify
        const rawPlaylists = await getPlaylists(PlayerName.SpotifyWeb, {
            all: true,
        });

        // set the list of playlistIds based on this current order
        this.dataMgr.origRawPlaylistOrder = [...rawPlaylists];
        this.dataMgr.rawPlaylists = rawPlaylists;

        // populate generated playlists
        await this.dataMgr.populateGeneratedPlaylists();
    }

    clearSpotify() {
        this.dataMgr.spotifyPlaylists = [];
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
                await this.populateSpotifyPlaylists();
                await this.refreshPlaylists(true);
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
            fileUtil.getItem('jwt')
        );

        if (isResponseOk(response) && response.data.length > 0) {
            this.userTopSongs = response.data;
        } else {
            // clear the favorites
            this.userTopSongs = [];
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
        let jwt = fileUtil.getItem('jwt');
        let createResult = await softwarePost(
            '/music/playlist/generated',
            payload,
            jwt
        );

        return createResult;
    }

    buildAggregateData(songSessionSource, initialValue) {
        let totalKeystrokes = 0;
        if (songSessionSource && Object.keys(songSessionSource).length) {
            // go through the source object
            // initialValue.source = element.source;
            const keys = Object.keys(songSessionSource);
            if (keys && keys.length > 0) {
                keys.forEach((key) => {
                    let sourceObj = songSessionSource[key];
                    const sourceObjKeys = Object.keys(sourceObj);
                    if (sourceObjKeys && sourceObjKeys.length > 0) {
                        sourceObjKeys.forEach((sourceObjKey) => {
                            const val = sourceObj[sourceObjKey];
                            if (numerics.includes(sourceObjKey)) {
                                // aggregate
                                initialValue[sourceObjKey] += val;
                            }
                        });
                    }

                    // set the sourceObj.keystrokes
                    sourceObj.keystrokes =
                        sourceObj.paste + sourceObj.add + sourceObj.delete;
                    // sum the keystrokes
                    totalKeystrokes += sourceObj.keystrokes;

                    if (!initialValue.syntax && sourceObj.syntax) {
                        initialValue.syntax = sourceObj.syntax;
                    }

                    if (!sourceObj.timezone) {
                        sourceObj[
                            "timezone"
                        ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    }
                    if (!sourceObj.offset) {
                        sourceObj["offset"] = utilMgr.getOffsetSeconds() / 60;
                    }
                    if (!sourceObj.pluginId) {
                        sourceObj["pluginId"] = utilMgr.getPluginId();
                    }
                    if (!sourceObj.os) {
                        sourceObj["os"] = utilMgr.getOs();
                    }
                    if (!sourceObj.version) {
                        sourceObj["version"] = utilMgr.getVersion();
                    }
                });
            }
        }

        initialValue.keystrokes = totalKeystrokes;
        return initialValue;
    }

    async refreshPlaylistState() {
        if (this.dataMgr.spotifyPlaylists.length > 0) {
            // build the spotify playlist
            this.dataMgr.spotifyPlaylists.forEach(async playlist => {
                let playlistItemTracks = this._playlistTrackMap[playlist.id];

                if (playlistItemTracks && playlistItemTracks.length > 0) {
                    let playlistState = await this.getPlaylistState(
                        playlist.id
                    );
                    playlist.state = playlistState;
                }
            });
        }

        if (commonUtil.isMac()) {
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
            `/dashboard?plugin=${plugin}&linux=${commonUtil.isLinux()}&html=${isHtml}`,
            fileUtil.getItem('jwt')
        );

        // get the content
        let content =
            musicSummary && musicSummary.data ? musicSummary.data : NO_DATA;

        fileIt.writeContentFileSync(fileName, content);
    }

    clearSavedPlaylists() {
        this.dataMgr.savedPlaylists = [];
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists(playlists) {
        for (let i = 0; i < this.dataMgr.savedPlaylists.length; i++) {
            const savedPlaylist = this.dataMgr.savedPlaylists[i];

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
                    fileUtil.getItem('jwt')
                );
            } else if (foundItem.name !== savedPlaylist.name) {
                // update the name on software
                const payload = {
                    name: foundItem.name,
                };
                await softwarePut(
                    `/music/playlist/generated/${savedPlaylist.id}`,
                    payload,
                    fileUtil.getItem('jwt')
                );
            }
        }

        setTimeout(() => {
            $('#refresh-treeview').attr('src', REFRESH_ICON);
            $('#refresh-recommendation').attr('src', REFRESH_ICON);
        }, 3000);
    }

    getPlayerNameForPlayback() {
        // if you're offline you may still have spotify desktop player abilities.
        // check if the current player is spotify and we don't have web access.
        // if no web access, then use the desktop player
        if (!this.isSpotifyPremium() && commonUtil.isMac()) {
            return PlayerName.SpotifyDesktop;
        }
        return PlayerName.SpotifyWeb;
    }

    async refreshRecommendations() {
        if (requiresSpotifyAccess()) {
            // update the recommended tracks to empty
            this.dataMgr.recommendationTracks = [];
            this.updateRecommendationPlaylistData();
        } else if (
            this.dataMgr.currentRecMeta &&
            this.dataMgr.currentRecMeta.label
        ) {
            // use the current recommendation metadata and bump the offset
            await this.updateRecommendations(
                this.dataMgr.currentRecMeta.label,
                this.dataMgr.currentRecMeta.likedSongSeedLimit,
                this.dataMgr.currentRecMeta.seed_genres,
                this.dataMgr.currentRecMeta.features,
                this.dataMgr.currentRecMeta.offset + 1
            );
        } else {
            // default to the similar liked songs recommendations
            await this.updateRecommendations('Familiar', 5);
        }
    }

    async updateSearchedSongsRecommendations() {
        this.dataMgr.currentRecMeta.label = this.dataMgr.recommendationLabel;
        // refresh the rec tree
        this.refreshPlaylists(false, true);
    }

    async updateRecommendations(
        label,
        likedSongSeedLimit = 5,
        seed_genres = [],
        features = {},
        offset = 0
    ) {

        if (!label && !this.dataMgr.recommendationLabel) {
            // set it to Familiar
            label = 'Familiar';
        } else if (!label) {
            label = this.dataMgr.recommendationLabel;
        }

        this.dataMgr.currentRecMeta = {
            label,
            likedSongSeedLimit,
            seed_genres,
            features,
            offset
        };

        const trackIds = await this.getTrackIdsForRecommendations(
            likedSongSeedLimit,
            offset
        );

        await this.fetchAndPopulateRecommendations(
          trackIds,
          label,
          this.dataMgr.currentRecMeta.seed_genres,
          this.dataMgr.currentRecMeta.features);
    }

    async fetchAndPopulateRecommendations(trackIds, label, seed_genres = [], features = {}) {
      // fetch the recommendations from spotify
      const tracks = await this.getRecommendedTracks(
              trackIds,
              seed_genres,
              features);

      // get the tracks that have already been recommended
      let existingTrackIds = this.dataMgr.prevRecTrackMap[label]
          ? this.dataMgr.prevRecTrackMap[label]
          : [];
      let finalTracks = [];
      if (existingTrackIds.length) {
          // filter out the ones that are already used
          tracks.forEach((track) => {
              if (!existingTrackIds.find(id => id === track.id)) {
                  finalTracks.push(track);
              }
          });
          if (finalTracks.length < 10) {
              // use the 1st 10 from recommendations and clear out the existing track ids
              finalTracks = [];
              finalTracks.push(...tracks);
              // clear out the old
              existingTrackIds = [];
          }
      } else {
          // no tracks found in the existing list
          finalTracks.push(...tracks);
      }

      // trim down to 10
      finalTracks = finalTracks.splice(0, 10);

      // add these to the previously recommended tracks
      const finalTrackIds = finalTracks.map(t => t.id);
      existingTrackIds.push(...finalTrackIds);

      // update the cache map based on this recommendation type
      this.dataMgr.prevRecTrackMap[label] = existingTrackIds;

      if (finalTracks.length > 0) {
          // sort them alpabeticaly
          utilMgr.sortTracks(finalTracks);
      }

      // set the manager's recommendation tracks
      this.dataMgr.recommendationTracks = finalTracks;
      this.dataMgr.recommendationLabel = label;

      this.updateRecommendationPlaylistData();
    }

    updateRecommendationPlaylistData() {
        let recommendTrackItem = this.getRecommendationPlaylistFolder();
        if (!recommendTrackItem) {
            recommendTrackItem = [];
        }
        recommendTrackItem.childs = this.dataMgr.recommendationTracks;

        this.dataMgr.recommendationPlaylist = recommendTrackItem;

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:update-recommend-treeview'
        );
    }

    async getRecommendedTracks(trackIds, seed_genres, features) {
        try {
            return getRecommendationsForTracks(
                trackIds,
                100,
                '' /*market*/,
                20,
                100,
                seed_genres,
                [],
                features
            );
        } catch (e) {
            //
        }

        return [];
    }
    async getTrackIdsForRecommendations(likedSongSeedLimit = 5, offset = 0) {
        let trackIds = [];
        let trackRecs = this.dataMgr.trackIdsForRecommendations || [];

        if (trackRecs.length === 0) {
            // call the music util to populate the rec track ids
            await utilMgr.buildTracksForRecommendations(this.dataMgr.spotifyPlaylists);
            trackRecs = this.dataMgr.trackIdsForRecommendations || [];
        }

        if (trackRecs.length > 0) {
            for (let i = 0; i < likedSongSeedLimit; i++) {
                if (trackRecs.length > offset) {
                    trackIds.push(trackRecs[offset]);
                } else {
                    // start the offset back to the begining
                    offset = 0;
                    trackIds.push(trackRecs[offset]);
                }
                offset++;
            }
        }
        return trackIds;
    }
}
