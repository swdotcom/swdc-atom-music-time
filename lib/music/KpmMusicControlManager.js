'use babel';

const utilMgr = require('../UtilManager');
import KpmMusicManager from './KpmMusicManager';
import MusicDashboard from './Music-dashboard';
import SocialShareManager from '../social/SocialShareManager';
const moment = require('moment-timezone');
const fs = require('fs');
import {
    isResponseOk,
    softwareGet,
    softwarePut,
    softwareDelete,
    softwarePost,
} from '../HttpClient';
const clipboardy = require('clipboardy');
import $ from 'jquery';
import path from 'path';
import { showSlackChannelMenu } from '../SlackControlManager';
import {
    PlayerType,
    play,
    pause,
    previous,
    next,
    PlayerName,
    Track,
    setItunesLoved,
    getSpotifyDevices,
    playSpotifyTrack,
    playSpotifyPlaylist,
    createPlaylist,
    saveToSpotifyLiked,
    removeFromSpotifyLiked,
    addTracksToPlaylist,
    playSpotifyDevice,
} from 'cody-music';
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
import { MusicDataManager } from './MusicDataManager';
import StructureView from './structure-view';
import { setTimeout } from 'timers';

const deviceMgr = require('./DeviceManager');

let isPlaylist = false;
let lastDayOfMonth = -1;
let fetchingMusicTimeMetrics = false;

const NO_DATA = 'MUSIC TIME\n\nNo data available\n';

$(document).on('change', '#addPlaylistSelect', function() {
    let selectedAddPlaylistId = $(this).val();
    selectedAddPlaylistId
        ? localStorage.setItem('selectedAddPlaylistId', selectedAddPlaylistId)
        : localStorage.setItem('selectedAddPlaylistId', '');

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:addToPlaylist'
    );

    // closeCategory();

    // console.log(selectedGenre);
});
var newPLaylistName = '';
$(document).on('click', '#createPlaylist', function() {
    createNewPlaylist(newPLaylistName);
});

$(document).on('change', '#createPlaylistText', function() {
    newPLaylistName =
        $(this)
            .val()
            .trim() != ''
            ? $(this).val()
            : null;
});

$(document).on('change', '#selectDevice', function() {
    let deviceValue = $(this).val();
    let devices = MusicDataManager.getInstance().currentDevices || [];

    let device = devices.filter(device => {
        return device.id == deviceValue;
    })[0];

    switch (deviceValue) {
        case 'Launch Spotify desktop':
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:launchSpotifyDesktop'
            );
            break;
        case 'Launch Spotify web player':
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:launchSpotify'
            );
            break;
        default:
            transferToDevice(device);
    }
    closeCategory();
});

function closeCategory() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

function createNewPlaylist(newPlaylistName) {
    const musicControlMgr = KpmMusicControlManager.getInstance();
    // musicControlMgr.currentTrackToAdd =
    // !!! important, need to use the get instance as this
    // method may be called within a callback and "this" will be undefined !!!
    const hasPlaylistItemToAdd = musicControlMgr.currentTrackToAdd
        ? true
        : false;

    if (newPlaylistName == null) {
        return;
    }
    // if(playlistName == 'Liked Songs') {
    //     closeCategory();
    //     utilMgr.notify(
    //         'Music Time',
    //         "Please enter a playlist name to continue."
    //     );
    // }

    const playlistItems = hasPlaylistItemToAdd
        ? [musicControlMgr.currentTrackToAdd]
        : [];
    musicControlMgr.createPlaylist(newPlaylistName, playlistItems);
    closeCategory();
}

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicControlManager {
    constructor() {
        this.dataMgr = MusicDataManager.getInstance();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new KpmMusicControlManager();
        }
        return this.instance;
    }

    async next() {
        const musicMgr = KpmMusicManager.getInstance();
        const playerName = musicMgr.getPlayerNameForPlayback();
        await next(playerName);
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 500);
    }

    shareSong() {
        utilMgr.clearNotification();
        this.isPlaylist = localStorage.getItem('isSharePlaylist');
        const context = this.isPlaylist == '1' ? 'Playlist' : 'Song';
        this.title = `Check out this ${context}`;
        if (this.isPlaylist == '1') {
            this._selectedShareId = localStorage.getItem(
                '_selectedSharePlaylistId'
            );
            this._selectedShareName = localStorage.getItem(
                '_selectedSharePlaylistName'
            );
        } else {
            this._selectedShareId = localStorage.getItem(
                '_selectedSharePlaylistTrackId'
            );
            this._selectedShareName = localStorage.getItem(
                '_selectedSharePlaylistTrackName'
            );
        }
        const _self = this;
        let slackStatus = utilMgr.getItem('slack_access_token') ? true : false;
        let slackButton = slackStatus ? 'Slack' : 'Connect Slack';
        let shareButton = [
            {
                className: 'btn btn-info',
                text: 'Facebook',
                onDidClick: function() {
                    _self.shareToFacebook();
                },
            },
            {
                className: 'btn btn-info',
                text: 'WhatsApp',
                onDidClick: function() {
                    _self.shareToWhatsapp();
                },
            },
            {
                className: 'btn btn-info',
                text: 'Tumblr',
                onDidClick: function() {
                    _self.shareToTumblr();
                },
            },
            {
                className: 'btn btn-info',
                text: 'Twitter',
                onDidClick: function() {
                    _self.shareToTwitter();
                },
            },
            {
                className: 'btn btn-info',
                text: slackButton,
                onDidClick: function() {
                    if (slackStatus) {
                        _self.shareToSlack();
                    } else {
                        atom.commands.dispatch(
                            atom.views.getView(atom.workspace),
                            'Music-Time:connect-slack'
                        );
                    }
                },
            },
            {
                className: 'btn btn-info',
                text: 'Copy Song Link',
                onDidClick: function() {
                    _self.copySpotifyLink(
                        _self._selectedShareId,
                        _self.isPlaylist
                    );
                },
            },
        ];
        utilMgr.notifyButton(
            'Music Time',
            `Share '${this._selectedShareName}' ${context}`,
            shareButton
        );
    }
    shareToFacebook() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt('facebook', { url: url, hashtag: '#MusicTime' });
    }
    shareToWhatsapp() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt('whatsapp', { title: this.title, url: url });
    }

    shareToTumblr() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt('tumblr', {
            title: this.title,
            url: url,
            tags: ['MusicTime'],
        });
    }
    shareToTwitter() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt('twitter', {
            title: this.title,
            url: url,
            hashtags: ['MusicTime'],
        });
    }
    async shareToSlack() {
        utilMgr.clearNotification();
        await showSlackChannelMenu(this._selectedShareId, this.isPlaylist);
    }

    async copySpotifyLink(id, isPlaylist) {
        let link = buildSpotifyLink(id, isPlaylist);

        if (id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
            link = 'https://open.spotify.com/collection/tracks';
        }

        let messageContext = '';
        if (isPlaylist == '1') {
            messageContext = 'playlist';
        } else {
            messageContext = 'track';
        }

        try {
            clipboardy.writeSync(link);
            utilMgr.notify(
                'Music Time',
                `Spotify ${messageContext} link copied to clipboard.`
            );
        } catch (err) {
            utilMgr.logIt(`Unable to copy to clipboard, error: ${err.message}`);
        }
    }

    async previous() {
        const musicMgr = KpmMusicManager.getInstance();
        const playerName = musicMgr.getPlayerNameForPlayback();
        await previous(playerName);
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 500);
    }

    async play() {
        const musicMgr = KpmMusicManager.getInstance();
        const playerName = musicMgr.getPlayerNameForPlayback();
        await play(playerName);
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 500);
    }

    async pause() {
        const musicMgr = KpmMusicManager.getInstance();
        const playerName = musicMgr.getPlayerNameForPlayback();
        await pause(playerName);
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 500);
    }

    async setLiked(liked, overrideTrack = null) {
        const musicMgr = KpmMusicManager.getInstance();
        const track = !overrideTrack
            ? this.dataMgr.runningTrack
            : overrideTrack;

        if (!track || !track.id) {
            utilMgr.notify(
                'Music Time',
                `Our service is temporarily unavailable.\n\nPlease try again later.\n`
            );
            return;
        }

        if (track.playerType === PlayerType.MacItunesDesktop) {
            // await so that the stateCheckHandler fetches
            // the latest version of the itunes track
            await setItunesLoved(liked).catch(err => {
                logIt(`Error updating itunes loved state: ${err.message}`);
            });
        } else {
            // save the spotify track to the users liked songs playlist
            if (liked) {
                await saveToSpotifyLiked([track.id]);
            } else {
                await removeFromSpotifyLiked([track.id]);
            }
        }

        let type = 'spotify';
        if (track.playerType === PlayerType.MacItunesDesktop) {
            type = 'itunes';
        }
        const api = `/music/liked/track/${track.id}?type=${type}`;
        const resp = await softwarePut(api, { liked }, utilMgr.getItem('jwt'));
        if (!isResponseOk(resp)) {
            utilMgr.logIt(`Error updating track like state: ${resp.message}`);
        }

        // get the server track. this will sync the controls
        if (liked) {
            $('#like-status-href img').attr('src', LIKE_ICON);
        } else {
            $('#unlike-status-href img').attr('src', LIKE_ICON_OUTLINE);
        }
        await musicMgr.refreshPlaylists(true);
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 1000);
    }

    async connectSpotify() {
        let jwt = utilMgr.getItem('jwt');
        if (!jwt) {
            jwt = await utilMgr.getAppJwt(true);
            await utilMgr.setItem('jwt', jwt);
        }
        const encodedJwt = encodeURIComponent(jwt);
        const qryStr = `token=${encodedJwt}&mac=${utilMgr.isMac()}`;
        const endpoint = `${api_endpoint}/auth/spotify?${qryStr}`;

        utilMgr.launchWebUrl(endpoint);
        utilMgr.refetchSpotifyConnectStatusLazily();
    }

    async refreshDeviceInfo() {
        await deviceMgr.populateSpotifyDevices();
        const structureViewObj = StructureView.getInstance();
        structureViewObj.updateDevice();
    }

    launchSpotifyPlayer() {
        utilMgr.notify(
            'Music Time',
            `After you select and play your first song in Spotify, standard controls (play, pause, next, etc.) will appear in your status bar`
        );
        setTimeout(() => {
            utilMgr.launchWebUrl('https://open.spotify.com/');
        }, 3200);
    }

    async disconnectSpotify() {
        const structureViewObj = StructureView.getInstance();
        structureViewObj.showLoader(false, true);
        this.disconnectOauth('Spotify');
        structureViewObj.toggleDeviceStatus(true);
        structureViewObj.toggleRefreshTreeview(true);
        structureViewObj.toggleRecommendHeadview(true);
        structureViewObj.toggleRecommendTreeview(true);
        structureViewObj.toggleWebAnalytics(true);
        structureViewObj.toggleSortDev(true);
        structureViewObj.toggleLikeButton(true);
        structureViewObj.toggleOpenDashboard(true);
        $('loaderdiv');
        $('.divider').hide();
    }

    async addToPlaylistMenu() {
        let playlists = KpmMusicManager.getInstance().currentPlaylists;
        let selectedAddPlaylistId = localStorage.getItem(
            'selectedAddPlaylistId'
        );
        localStorage.setItem('selectedAddPlaylistId', '');
        let _selectedAddPlaylistTrackId = localStorage.getItem(
            '_selectedAddPlaylistTrackId'
        );
        let _selectedAddTrackParentId = localStorage.getItem(
            '_selectedAddTrackParentId'
        );
        const musicMgr = KpmMusicManager.getInstance();
        // this.currentTrackToAdd =
        //     musicMgr._playlistMap[_selectedAddTrackParentId];

        if (selectedAddPlaylistId && selectedAddPlaylistId == 'playlist') {
            closeCategory();
            setTimeout(() => {
                this.showNewPlaylistPopup();
            }, 0);
            return;
        }

        let playlistItem = {};
        if (
            _selectedAddTrackParentId ===
            SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
        ) {
            playlistItem = this.dataMgr.recommendationTracks.filter(track => {
                return track.id === _selectedAddPlaylistTrackId;
            })[0];
        } else {
            playlistItem = musicMgr._selectedPlaylist.filter(track => {
                return track.id === _selectedAddPlaylistTrackId;
            })[0];
        }
        this.currentTrackToAdd = playlistItem;
        // if playlist is selected to add song
        if (selectedAddPlaylistId) {
            const matchingPlaylists = playlists
                .filter(n => n.id === selectedAddPlaylistId)
                .map(n => n);
            if (matchingPlaylists.length) {
                const matchingPlaylist = matchingPlaylists[0];
                if (matchingPlaylist) {
                    const playlistName = matchingPlaylist.name;
                    let errMsg = null;

                    const trackUri =
                        playlistItem.uri ||
                        utilMgr.createUriFromTrackId(playlistItem.id);
                    const trackId = playlistItem.id;

                    if (matchingPlaylist.name !== 'Liked Songs') {
                        // it's a non-liked songs playlist update
                        // uri:"spotify:track:2JHCaLTVvYjyUrCck0Uvrp" or id
                        const codyResponse = await addTracksToPlaylist(
                            matchingPlaylist.id,
                            [trackUri]
                        );
                        errMsg = utilMgr.getCodyErrorMessage(codyResponse);

                        // populate the spotify playlists
                        await musicMgr.populateSpotifyPlaylists();
                    } else {
                        // it's a liked songs playlist update
                        let track = this.dataMgr._runningTrack;
                        if (track.id !== trackId) {
                            track = new Track();
                            track.id = playlistItem.id;
                            track.playerType = playlistItem.playerType;
                            track.state = playlistItem.state;
                        }
                        await this.setLiked(true, track);

                        // add to the trackIdsForRecommendations
                        this.dataMgr.trackIdsForRecommendations.push(trackId);
                    }

                    if (!errMsg) {
                        closeCategory();
                        utilMgr.notify(
                            'Music Time',
                            `Added ${playlistItem.name} to ${playlistName}`
                        );
                        // refresh the playlist and clear the current recommendation metadata
                        // this.dataMgr.removeTrackFromRecommendations(trackId);
                        if (
                            selectedAddPlaylistId !=
                            SPOTIFY_LIKED_SONGS_PLAYLIST_ID
                        ) {
                            atom.commands.dispatch(
                                atom.views.getView(atom.workspace),
                                'Music-Time:refresh-treeview'
                            );
                        }
                    } else {
                        if (errMsg) {
                            closeCategory();
                            utilMgr.notify(
                                'Music Time',
                                `Failed to add '${playlistItem.name}' to '${playlistName}'. You cannot add tracks to a playlist you don't own.`
                            );
                        }
                    }
                }
            }
            return;
        }

        // filter out the ones with itemType = playlist
        playlists = playlists
            .filter(
                n =>
                    n.itemType === 'playlist' &&
                    n.name !== 'Software Top 40' &&
                    n.name !== PERSONAL_TOP_SONGS_NAME &&
                    n.id !== _selectedAddTrackParentId
            )
            .map(n => n);

        this.sortPlaylists(playlists);

        var myDiv = document.createElement('div');
        var closeButton = document.createElement('span');
        closeButton.setAttribute(
            'style',
            'float:right;margin-bottom: 10px;cursor:pointer;'
        );
        closeButton.setAttribute('id', 'closeCateory');
        closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
        var selectList = document.createElement('select');
        selectList.setAttribute('id', 'addPlaylistSelect');
        selectList.setAttribute(
            'style',
            ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
        );

        myDiv.appendChild(closeButton);
        myDiv.appendChild(selectList);

        var defaultOoption = document.createElement('option');
        defaultOoption.value = '';
        defaultOoption.text = 'Select or create playlist';
        selectList.appendChild(defaultOoption);

        var createPlaylistOption = document.createElement('option');
        createPlaylistOption.value = 'playlist';
        createPlaylistOption.text = 'New playlist';
        selectList.appendChild(createPlaylistOption);
        playlists.forEach(playlist => {
            var option = document.createElement('option');
            option.value = playlist.id;
            option.text = playlist.name;
            selectList.appendChild(option);
        });

        atom.workspace.addModalPanel({
            item: myDiv,
            visible: true,
            priority: 4,
        });
        // const pick = await showQuickPick(menuOptions);
    }

    showNewPlaylistPopup() {
        // method may be called within a callback and "this" will be undefined !!!
        const playlistNamePlaceholder = this.currentTrackToAdd.name || '';

        var myDiv = document.createElement('div');
        var closeButton = document.createElement('span');
        closeButton.setAttribute(
            'style',
            'float:right;margin-bottom: 10px;cursor:pointer;'
        );
        closeButton.setAttribute('id', 'closeCateory');

        closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
        var createPlaylistButton = document.createElement('button');
        createPlaylistButton.setAttribute('id', 'createPlaylist');
        createPlaylistButton.setAttribute('class', 'btn btn-primary');

        createPlaylistButton.innerHTML = 'Save';

        var inputText = document.createElement('input');
        inputText.id = 'createPlaylistText';
        inputText.type = 'text';
        inputText.classList = 'native-key-bindings form-control';
        inputText.placeholder = 'New Playlist';
        inputText.value = playlistNamePlaceholder;
        inputText.setAttribute(
            'style',
            ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
        );

        myDiv.appendChild(closeButton);
        myDiv.appendChild(inputText);
        myDiv.appendChild(createPlaylistButton);

        atom.workspace.addModalPanel({
            item: myDiv,
            visible: true,
            priority: 4,
        });
    }

    async removeSong() {
        let _selectedAddPlaylistTrackId = localStorage.getItem(
            '_selectedAddPlaylistTrackId'
        );
        let _selectedAddTrackParentId = localStorage.getItem(
            '_selectedAddTrackParentId'
        );
        const musicMgr = KpmMusicManager.getInstance();
        // this.currentTrackToAdd =
        //     musicMgr._playlistMap[_selectedAddTrackParentId];

        let playlistItem = musicMgr._selectedPlaylist.filter(track => {
            return track.id === _selectedAddPlaylistTrackId;
        })[0];
        //if playlist is selected to add song
        if (playlistItem) {
            await this.setLiked(false, playlistItem);
        }

        utilMgr.notify('Music Time', 'Song removed successfully.');
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

    async disconnectSlack() {
        this.disconnectOauth('Slack');
        SocialShareManager.getInstance().closeShareTextPrompt();
    }

    async disconnectOauth(type) {
        const structureViewObj = StructureView.getInstance();
        const musicMgr = KpmMusicManager.getInstance();
        let confirm = window.confirm(
            `Are you sure you want to disconnect ${type}?`
        );

        if (confirm) {
            const type_lc = type.toLowerCase();
            let result = await softwarePut(
                `/auth/${type_lc}/disconnect`,
                {},
                utilMgr.getItem('jwt')
            );

            if (isResponseOk(result)) {
                // oauth is not null, initialize spotify
                if (type_lc === 'slack') {
                    await musicMgr.updateSlackAccessInfo(null);
                    utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
                    utilMgr.addMusicMenuItem(
                        CONNECT_SLACK_MENU_LABEL,
                        WEB_SLACK_COMMAND_KEY
                    );
                    utilMgr.clearNotification();
                } else if (type_lc === 'spotify') {
                    structureViewObj.hideLoader();
                    await musicMgr.updateSpotifyAccessInfo(null);

                    $('#spotify-status').text('Spotify Premium required');
                    $('#spotify-disconnect').hide();

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
                    // const file = utilMgr.getSoftwareSessionFile();
                    // // we're online so just delete the file
                    // utilMgr.deleteFile(file);
                    // atom.reload();
                }
            }
        } else {
            return false;
        }
    }

    async playSpotifyTrackFromPlaylist(
        spotifyUser,
        playlistId,
        playlistItem,
        spotifyDevices,
        selectedTrackItem,
        selectedPlaylist,
        checkTrackStateAndTryAgainCount = 0
    ) {
        if (playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
            playlistId = null;
        }
        const deviceId = spotifyDevices.length > 0 ? spotifyDevices[0].id : '';
        let options = {};
        if (deviceId) {
            options['device_id'] = deviceId;
        }
        const trackId = playlistItem ? playlistItem.id : '';
        if (trackId) {
            options['track_ids'] = [trackId];
        } else {
            options['offset'] = { position: 0 };
        }
        if (playlistId) {
            const playlistUri = `${spotifyUser.uri}:playlist:${playlistId}`;
            options['context_uri'] = playlistUri;
        }

        if (trackId && selectedTrackItem) {
            // check against the currently selected track
            if (trackId !== selectedTrackItem.id) {
                return;
            }
        } else if (playlistId && selectedPlaylist) {
            // check against the currently selected playlist
            if (playlistId !== selectedPlaylist.id) {
                return;
            }
        }

        /**
         * to play a track without the play list id
         * curl -X "PUT" "https://api.spotify.com/v1/me/player/play?device_id=4f38ae14f61b3a2e4ed97d537a5cb3d09cf34ea1"
         * --data "{\"uris\":[\"spotify:track:2j5hsQvApottzvTn4pFJWF\"]}"
         */

        if (!playlistId) {
            // just play by track id
            await playSpotifyTrack(playlistItem.id, deviceId);
        } else {
            // we have playlist id within the options, use that
            await playSpotifyPlaylist(playlistId, trackId, deviceId);
        }

        if (checkTrackStateAndTryAgainCount > 0) {
            const musicMgr = KpmMusicManager.getInstance();
            const track = this.dataMgr.runningTrack;
            if (playlistItem && track.id === playlistItem.id) {
                await MusicStateManager.getInstance().musicStateCheck();
            } else if (!playlistItem && track.id) {
                await MusicStateManager.getInstance().musicStateCheck();
            } else {
                checkTrackStateAndTryAgainCount--;
                spotifyDevices = await getSpotifyDevices();

                setTimeout(() => {
                    this.playSpotifyTrackFromPlaylist(
                        spotifyUser,
                        playlistId,
                        playlistItem,
                        spotifyDevices,
                        checkTrackStateAndTryAgainCount
                    );
                }, 1000);
            }
        }
        //  else {
        //     await MusicStateManager.getInstance().musicStateCheck();
        // }
        setTimeout(() => {
          musicMgr.gatherMusicInfoRequest();
        }, 1000);
    }

    async displayMusicTimeMetricsMarkdownDashboard() {
        if (fetchingMusicTimeMetrics) {
            utilMgr.notify(
                'Music Time',
                `Still building Music Time dashboard, please wait...`
            );
            return;
        }
        fetchingMusicTimeMetrics = true;

        const musicTimeFile = utilMgr.getMusicTimeMarkdownFile();
        await this.fetchMusicTimeMetricsMarkdownDashboard();

        const content = fs.readFileSync(musicTimeFile, {encoding: 'utf8'}).toString();
        const dashboardViewObj = new MusicDashboard(content);
        atom.workspace.getPanes()[0].addItem(dashboardViewObj);
        atom.workspace.getPanes()[0].activateItem(dashboardViewObj);

        // window.showInformationMessage(
        //     `Completed building Music Time dashboard.`
        // );
        fetchingMusicTimeMetrics = false;
    }

    async fetchMusicTimeMetricsMarkdownDashboard() {
        let file = utilMgr.getMusicTimeMarkdownFile();

        const dayOfMonth = moment()
            .startOf('day')
            .date();
        if (!fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
            lastDayOfMonth = dayOfMonth;
            await this.fetchDashboardData(file, true);
        }
    }

    async fetchMusicTimeMetricsDashboard() {
        let file = getMusicTimeFile();

        const dayOfMonth = moment()
            .startOf('day')
            .date();
        if (fs.existsSync(file) || lastDayOfMonth !== dayOfMonth) {
            lastDayOfMonth = dayOfMonth;
            await this.fetchDashboardData(file, false);
        }
    }

    async fetchDashboardData(fileName, isHtml) {
        const musicSummary = await softwareGet(
            `/dashboard/music?linux=${utilMgr.isLinux()}&html=${isHtml}`,
            utilMgr.getItem('jwt')
        );

        // get the content
        let content =
            musicSummary && musicSummary.data ? musicSummary.data : NO_DATA;

        fs.writeFileSync(fileName, content, err => {
            if (err) {
                logIt(
                    `Error writing to the Software dashboard file: ${err.message}`
                );
            }
        });
    }
    async createPlaylist(playlistName, playlistTrackItems) {
        // create the playlist
        const playlistResult = await createPlaylist(
            playlistName || this.currentTrackToAdd.name,
            true
        );
        newPLaylistName = '';
        let playlistId = null;
        const errMsg = utilMgr.getCodyErrorMessage(playlistResult);
        if (errMsg) {
            utilMgr.notify(
                'Music Time',
                `There was an unexpected error adding tracks to the playlist. ${errMsg} Refresh the playlist and try again if you feel the problem has been resolved.`
            );
            return;
        }
        // successfully created it
        playlistId = playlistResult.data.id;

        // create the tracks to add list
        const tracksToAdd = playlistTrackItems.map(item => {
            if (item.uri) {
                return item.uri;
            }
            return item.id;
        });
        const musicMgr = KpmMusicManager.getInstance();
        musicMgr.addTracks(playlistId, playlistName, tracksToAdd);
    }
}

export function buildSpotifyLink(id, isPlaylist) {
    let link = '';
    id = utilMgr.createSpotifyIdFromUri(id);
    if (isPlaylist == '1') {
        link = `https://open.spotify.com/playlist/${id}`;
    } else {
        link = `https://open.spotify.com/track/${id}`;
    }

    return link;
}

export async function showDeviceSelectorMenu() {
    let devices = MusicDataManager.getInstance().currentDevices || [];

    const isPrem = await KpmMusicManager.getInstance().isSpotifyPremium();

    let items = [];
    if (devices && devices.length) {
        devices.forEach(d => {
            let status = d.is_active ? 'Listening on' : 'Available on';
            if (
                utilMgr.isMac() &&
                !isPrem &&
                d.type.toLowerCase() === 'computer' &&
                !d.name.toLowerCase().includes('web player')
            ) {
                return;
            } else {
                items.push({
                    text: `${status} ${d.name}`,
                    id: d.id,
                    tooltip: `${d.volume_percent}% volume`,
                    className: 'btn btn-info',
                });
            }
        });
    }

    if (!isPrem) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:launchSpotifyDesktop'
        );
        closeCategory();
    } else {
        // get the device set
        const { webPlayer, desktop } = deviceMgr.getDeviceSet();

        // show the launch desktop option if it's not already in the list
        // or if it's an active device
        if (!desktop) {
            items.push({
                text: 'Launch Spotify desktop',
                id: 'Launch Spotify desktop',
                tooltip: 'Launch Spotify desktop',
                className: 'btn btn-info',
            });
        }
        if (!webPlayer) {
            items.push({
                text: 'Launch Spotify web player',
                id: 'Launch Spotify web player',
                tooltip: 'Launch Spotify web player',
                className: 'btn btn-info',
            });
        }

        var myDiv = document.createElement('div');
        var closeButton = document.createElement('span');
        closeButton.setAttribute(
            'style',
            'float:right;margin-bottom: 10px;cursor:pointer;'
        );
        closeButton.setAttribute('id', 'closeCateory');
        closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
        var selectList = document.createElement('select');
        selectList.setAttribute('id', 'selectDevice');
        selectList.setAttribute(
            'style',
            ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
        );

        myDiv.appendChild(closeButton);
        myDiv.appendChild(selectList);

        var defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = 'Select device';
        selectList.appendChild(defaultOption);
        items.forEach(device => {
            let label = device.text.replace(/[_-]/g, ' ');
            // capitalize the 1st character
            label = label.charAt(0).toUpperCase() + label.substring(1);
            var option = document.createElement('option');
            option.value = device.id;
            option.text = label;
            option.title = device.tooltip;
            selectList.appendChild(option);
        });

        atom.workspace.addModalPanel({
            item: myDiv,
            visible: true,
            priority: 4,
        });
    }
    return null;
}
async function transferToDevice(device) {
    utilMgr.notify('Music Time', `Connected to ${device.name}`);
    await playSpotifyDevice(device.id);
    setTimeout(() => {
        // refresh the tree, no need to refresh playlists
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:refreshDeviceInfo'
        );
    }, 3000);
}
