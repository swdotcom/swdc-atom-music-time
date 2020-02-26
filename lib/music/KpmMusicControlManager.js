'use babel';

const utilMgr = require('../UtilManager');
let isPlaylist = false;
import KpmMusicManager from './KpmMusicManager';
import MusicDashboard from './Music-dashboard';
import SocialShareManager from '../social/SocialShareManager';
const moment = require('moment-timezone');
const fs = require('fs');
import { softwareGet, softwarePut, isResponseOk } from '../HttpClient';
const clipboardy = require('clipboardy');
import $ from 'jquery';
import { showSlackChannelMenu } from '../SlackControlManager';
import {
    PlayerType,
    getRunningTrack,
    play,
    pause,
    previous,
    next,
    PlayerName,
    Track,
    setItunesLoved,
    launchPlayer,
    getSpotifyDevices,
    playSpotifyTrack,
    playSpotifyPlaylist,
    quitMacPlayer,
    saveToSpotifyLiked,
    removeFromSpotifyLiked,
    addTracksToPlaylist,
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
} from '../Constants';
import KpmMusicStoreManager from './KpmMusicStoreManager';
import { MusicDataManager } from './MusicDataManager';
import StructureView from './structure-view';
import { setTimeout } from 'timers';

let lastDayOfMonth = -1;
let fetchingMusicTimeMetrics = false;
const NO_DATA = 'MUSIC TIME\n\nNo data available\n';

$(document).on('change', '#addPlaylist', function() {
    $(this).val()
        ? localStorage.setItem('selectedAddPlaylistId', $(this).val())
        : localStorage.setItem('selectedAddPlaylistId', '');
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:addToPlaylist'
    );
    closeCategory();

    // console.log(selectedGenre);
});

function closeCategory() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicControlManager {
    constructor() {
        this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
        this.KpmMusicStoreManagerObj.currentPlayerName = PlayerName.SpotifyWeb;
        this.dataMgr = MusicDataManager.getInstance();
    }

    async getPlayer() {
        const track = KpmMusicStoreManager.getInstance().runningTrack;
        if (track) {
            return track.playerType;
        }
        return null;
    }

    async next(playerName = null) {
        if (!playerName) {
            playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
        }
        const musicMgr = KpmMusicManager.getInstance();
        let device = await musicMgr.getActiveSpotifyDevicesTitleAndTooltip();

        let options = {
            device_id: device.device_id,
        };
        await next(playerName, options);

        setTimeout(async () => {
            await musicMgr.gatherMusicInfo();
        }, 1000);
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

    async previous(playerName = null) {
        if (!playerName) {
            playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
        }
        const musicMgr = KpmMusicManager.getInstance();

        let device = await musicMgr.getActiveSpotifyDevicesTitleAndTooltip();

        let options = {
            device_id: device.device_id,
        };
        await previous(playerName, options);

        setTimeout(async () => {
            await musicMgr.gatherMusicInfo();
        }, 1000);
    }

    async play(playerName = null) {
        if (!playerName) {
            playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
        }
        const musicMgr = KpmMusicManager.getInstance();

        let device = await musicMgr.getActiveSpotifyDevicesTitleAndTooltip();

        let options = {
            device_id: device.device_id,
        };
        await play(playerName, options);

        setTimeout(async () => {
            await musicMgr.gatherMusicInfo();
        }, 1000);
    }

    async pause(playerName = null) {
        // this.KpmMusicStoreManagerObj.currentPlayerName = playerName;
        if (!playerName) {
            playerName = this.KpmMusicStoreManagerObj.currentPlayerName;
        }
        const musicMgr = KpmMusicManager.getInstance();
        let device = await musicMgr.getActiveSpotifyDevicesTitleAndTooltip();

        let options = {
            device_id: device.device_id,
        };
        await pause(playerName, options).then(result => {});

        setTimeout(async () => {
            await musicMgr.gatherMusicInfo();
        }, 1000);
    }

    async setLiked(liked, overrideTrack = null) {
        const musicMgr = KpmMusicManager.getInstance();
        const serverIsOnline = await utilMgr.serverIsAvailable();
        const runningTrack = await musicMgr.getRunningTrack();

        const track = !overrideTrack ? runningTrack : overrideTrack;

        if (!serverIsOnline || !track || !track.id) {
            window.showInformationMessage(
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

        // show loading until the liked/unliked is complete
        musicMgr.syncControls(track, true /*loading*/);

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
        if (runningTrack.id === track.id) {
            await this.KpmMusicStoreManagerObj.getServerTrack(track);
        }
        await musicMgr.showPlaylistItems(
            SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
            serverIsOnline
        );
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

    async launchTrackPlayer(playerName = null) {
        const musicstoreMgr = KpmMusicStoreManager.getInstance();

        const currentlyRunningType = musicstoreMgr.currentPlayerName;
        if (playerName === PlayerName.ItunesDesktop) {
            musicstoreMgr.currentPlayerName = PlayerType.MacItunesDesktop;
        } else {
            musicstoreMgr.currentPlayerName = PlayerType.WebSpotify;
        }

        const currentTrack = new Track();
        if (!playerName) {
            getRunningTrack().then(track => {
                if (track && track.id) {
                    let options = {
                        trackId: track.id,
                    };
                    let playerType = track.playerType;
                    let devices = KpmMusicStoreManager.getInstance()
                        .spotifyPlayerDevices;

                    if (
                        playerType === PlayerType.WebSpotify &&
                        devices &&
                        devices.length === 1 &&
                        !devices[0].name.includes('Web Player')
                    ) {
                        // launch the spotify desktop only if we have
                        //
                        playerType = PlayerType.MacSpotifyDesktop;
                    }
                    if (playerType === PlayerType.NotAssigned) {
                        playerType = PlayerType.WebSpotify;
                    }

                    if (playerType === PlayerType.WebSpotify) {
                        launchPlayer(PlayerName.SpotifyWeb, options);
                    } else if (playerType === PlayerType.MacItunesDesktop) {
                        launchPlayer(PlayerName.ItunesDesktop, options);
                    } else {
                        launchPlayer(PlayerName.SpotifyDesktop, options);
                    }
                }
            });
        } else if (playerName === PlayerName.ItunesDesktop) {
            if (
                currentTrack &&
                currentTrack.playerType !== PlayerType.MacItunesDesktop
            ) {
                // end the spotify web track
                if (currentlyRunningType !== PlayerType.MacSpotifyDesktop) {
                    musicCtrlMgr.pause(PlayerName.SpotifyWeb);
                } else {
                    await quitMacPlayer(PlayerName.SpotifyDesktop);
                }
            }
            launchPlayer(PlayerName.ItunesDesktop);
        } else {
            // end the itunes track
            // musicCtrlMgr.pause(PlayerName.ItunesDesktop);
            // quit the app
            await quitMacPlayer(PlayerName.ItunesDesktop);
            const spotifyDevices = await getSpotifyDevices();
            if (!spotifyDevices || spotifyDevices.length === 0) {
                this.launchSpotifyPlayer();
            }
        }
    }

    launchSpotifyPlayer() {
        utilMgr.notify(
            'Music Time',
            `After you select and play your first song in Spotify, standard controls (play, pause, next, etc.) will appear in your status bar`
        );
        setTimeout(() => {
            launchPlayer(PlayerName.SpotifyWeb);
        }, 3200);
    }

    async disconnectSpotify() {
        const structureViewObj = new StructureView();
        this.disconnectOauth('Spotify');
        structureViewObj.toggleDeviceStatus(true);
        structureViewObj.toggleRefreshTreeview(true);
        structureViewObj.toggleRecommendHeadview(true);
        structureViewObj.toggleRecommendTreeview(true);
        structureViewObj.toggleWebAnalytics(true);
        structureViewObj.toggleSortDev(true);
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
        this.currentTrackToAdd =
            musicMgr._playlistMap[_selectedAddTrackParentId];

        //if playlist is selected to add song
        if (selectedAddPlaylistId) {
            const matchingPlaylists = playlists
                .filter(n => n.id === selectedAddPlaylistId)
                .map(n => n);
            if (matchingPlaylists.length) {
                const matchingPlaylist = matchingPlaylists[0];
                if (matchingPlaylist) {
                    const playlistName = matchingPlaylist.name;
                    let errMsg = null;
                    let playlistItem = {};
                    if (
                        _selectedAddTrackParentId ===
                        SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID
                    ) {
                        playlistItem = this.dataMgr.recommendationTracks.filter(
                            track => {
                                return track.id === _selectedAddPlaylistTrackId;
                            }
                        )[0];
                    } else {
                        playlistItem = musicMgr._selectedPlaylist.filter(
                            track => {
                                return track.id === _selectedAddPlaylistTrackId;
                            }
                        )[0];
                    }
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
                        let track = musicMgr._runningTrack;
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
                        utilMgr.notify(
                            'Music Time',
                            `Added ${playlistItem.name} to ${playlistName}`
                        );
                        // refresh the playlist and clear the current recommendation metadata
                        // this.dataMgr.removeTrackFromRecommendations(trackId);

                        atom.commands.dispatch(
                            atom.views.getView(atom.workspace),
                            'Music-Time:refresh-treeview'
                        );
                    } else {
                        if (errMsg) {
                            utilMgr.notify(
                                'Music Time',
                                `Failed to add '${playlistItem.name}' to '${playlistName}'. You cannot add tracks to a playlist you don't own.`
                            );
                        }
                    }
                }
            }
            // localStorage.setItem('selectedAddPlaylistId' , '');
            return;
        }
        // const matchingPlaylists = playlists
        // .filter((n) => n.name === pick.label)
        // .map((n) => n);

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

        // playlists.forEach(item => {
        //     menuOptions.items.push({
        //         label: item.name,
        //         cb: null,
        //     });
        // });

        var myDiv = document.createElement('div');
        var closeButton = document.createElement('span');
        closeButton.setAttribute('style', 'float:right;margin-bottom: 10px;');
        closeButton.setAttribute('id', 'closeCateory');
        closeButton.innerHTML =
            '<img alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" />';
        var selectList = document.createElement('select');
        selectList.setAttribute('id', 'addPlaylist');
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
        playlists.forEach(playlist => {
            let label = playlist.name.replace(/[_-]/g, ' ');
            // capitalize the 1st character
            label = label.charAt(0).toUpperCase() + label.substring(1);
            var option = document.createElement('option');
            option.value = playlist.id;
            option.text = label;
            selectList.appendChild(option);
        });

        atom.workspace.addModalPanel({
            item: myDiv,
            visible: true,
            priority: 4,
        });
        // const pick = await showQuickPick(menuOptions);
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
        // const selection = await window.showInformationMessage(
        //     `Are you sure you would like to disconnect ${type}?`,
        //     ...[NOT_NOW_LABEL, YES_LABEL]
        // );
        const musicMgr = KpmMusicManager.getInstance();
        let confirm = window.confirm(
            `Are you sure you want to disconnect ${type}?`
        );

        if (confirm) {
            let serverIsOnline = await utilMgr.serverIsAvailable();
            if (serverIsOnline) {
                const type_lc = type.toLowerCase();
                let result = await utilMgr.softwarePut(
                    `/auth/${type_lc}/disconnect`,
                    {},
                    utilMgr.getItem('jwt')
                );

                if (utilMgr.isResponseOk(result)) {
                    // oauth is not null, initialize spotify
                    if (type_lc === 'slack') {
                        await musicMgr.updateSlackAccessInfo(null);
                        utilMgr.removeMusicMenuItem(
                            DISCONNECT_SLACK_MENU_LABEL
                        );
                        utilMgr.addMusicMenuItem(
                            CONNECT_SLACK_MENU_LABEL,
                            WEB_SLACK_COMMAND_KEY
                        );
                        utilMgr.clearNotification();
                    } else if (type_lc === 'spotify') {
                        this.KpmMusicStoreManagerObj.clearSpotifyAccessInfo();

                        $('#spotify-status').text('Spotify Premium required');
                        $('#spotify-disconnect').hide();
                        $('#likeSong').hide();
                        $('#unlikeSong').hide();

                        $('#spotify-connect').show();
                        $('#spotify-status').hide();
                        $('#spotify-refresh-playlist').hide();

                        atom.commands.dispatch(
                            atom.views.getView(atom.workspace),
                            'Music-Time:clearTreeView'
                        );
                        atom.commands.dispatch(
                            atom.views.getView(atom.workspace),
                            'Music-Time:clearFooterStatus'
                        );
                        utilMgr.removeMusicMenuItem(
                            DISCONNECT_SPOTIFY_MENU_LABEL
                        );
                        utilMgr.addMusicMenuItem(
                            CONNECT_SPOTIFY_MENU_LABEL,
                            CONNECT_SPOTIFY_COMMAND_KEY
                        );
                        utilMgr.removeMusicMenuItem(MUSIC_DASHBOARD_LABEL);
                        utilMgr.removeMusicMenuItem(CONNECT_SLACK_MENU_LABEL);
                        utilMgr.removeMusicMenuItem(
                            DISCONNECT_SLACK_MENU_LABEL
                        );
                        utilMgr.setItem('isSpotifyConnected', '');
                        utilMgr.clearNotification();
                    }
                }
            } else {
                window.showInformationMessage(
                    `Our service is temporarily unavailable.\n\nPlease try again later.\n`
                );
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
            const track = await getRunningTrack();
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
    }

    async displayMusicTimeMetricsMarkdownDashboard() {
        if (fetchingMusicTimeMetrics) {
            window.showInformationMessage(
                `Still building Music Time dashboard, please wait...`
            );
            return;
        }
        fetchingMusicTimeMetrics = true;

        const musicTimeFile = utilMgr.getMusicTimeMarkdownFile();
        await this.fetchMusicTimeMetricsMarkdownDashboard();

        const content = fs.readFileSync(musicTimeFile).toString();
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
