'use babel';

const utilMgr = require('../UtilManager');
let isPlaylist = false;
import KpmMusicManager from './KpmMusicManager';
import MusicDashboard from './Music-dashboard';
import  SocialShareManager from '../social/SocialShareManager';
const moment = require('moment-timezone');
const fs = require('fs');
import { softwareGet, softwarePut, isResponseOk } from '../HttpClient';
const clipboardy = require("clipboardy");
import $ from 'jquery';
import {
    showSlackChannelMenu
} from "../SlackControlManager";
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
    MUSIC_DASHBOARD_LABEL
} from '../Constants';
import KpmMusicStoreManager from './KpmMusicStoreManager';
import { MusicDataManager } from './MusicDataManager';
import StructureView from './structure-view';



let lastDayOfMonth = -1;
let fetchingMusicTimeMetrics = false;
const NO_DATA = 'MUSIC TIME\n\nNo data available\n';

//
// KpmMusicManager - handles software session management
//
export default class KpmMusicControlManager {
    constructor() {
        this.KpmMusicStoreManagerObj = KpmMusicStoreManager.getInstance();
        this.KpmMusicStoreManagerObj.currentPlayerName = PlayerName.SpotifyWeb;
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
        const context = this.isPlaylist == '1' ? "Playlist" : "Song";
        this.title = `Check out this ${context}`;
        if(this.isPlaylist == '1') {
            this._selectedShareId = localStorage.getItem(
                '_selectedSharePlaylistId'
            );
            this._selectedShareName = localStorage.getItem(
                '_selectedSharePlaylistName'
            );
        }
        else {
            this._selectedShareId = localStorage.getItem(
                '_selectedSharePlaylistTrackId'
            );
            this._selectedShareName = localStorage.getItem(
                '_selectedSharePlaylistTrackName'
            );
        }
        const _self = this;
        let slackStatus =  utilMgr.getItem('slack_access_token') ? true : false;
        let slackButton = slackStatus ? 'Slack' : 'Connect Slack';
        let shareButton = [
            {
                'className' : 'btn btn-info',
                'text' : 'Facebook',
                'onDidClick' :  function () {
                    _self.shareToFacebook()
                }
            },
            {
                'className' : 'btn btn-info',
                'text' : 'WhatsApp' ,
                'onDidClick' :  function () {
                    _self.shareToWhatsapp()
                }
            },
            {
                'className' : 'btn btn-info',
                'text' : 'Tumblr' ,
                'onDidClick' :  function () {
                    _self.shareToTumblr()
                }
            },
            {
                'className' : 'btn btn-info',
                'text' : 'Twitter' ,
                'onDidClick' :  function () {
                    _self.shareToTwitter()
                }
            }
            ,
            {
                'className' : 'btn btn-info',
                'text' : slackButton ,
                'onDidClick' :  function () {
                    if(slackStatus) {
                        _self.shareToSlack();
                    } else {
                        atom.commands.dispatch(
                            atom.views.getView(atom.workspace),
                            'Music-Time:connect-slack'
                        );
                    }
                }
            },
            {
                'className' : 'btn btn-info',
                'text' : 'Copy Song Link' ,
                'onDidClick' :  function () {
                    _self.copySpotifyLink(_self._selectedShareId,_self.isPlaylist)
                }
            }
        ]
        utilMgr.notifyButton('Music Time', `Share '${this._selectedShareName}' ${context}` , shareButton)

    }
    shareToFacebook() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt("facebook", { url: url, hashtag: "#MusicTime" });
    }
    shareToWhatsapp() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt("whatsapp", { title: this.title, url: url });
    }

    shareToTumblr() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt("tumblr", { title: this.title, url: url , tags: ["MusicTime"]});
    }
    shareToTwitter() {
        const socialShare = SocialShareManager.getInstance();
        const url = buildSpotifyLink(this._selectedShareId, this.isPlaylist);
        socialShare.shareIt("twitter", { title: this.title, url: url, hashtags: ["MusicTime"] });
    }
    async shareToSlack() {
        utilMgr.clearNotification();
        await showSlackChannelMenu(this._selectedShareId,this.isPlaylist);
    }

    async copySpotifyLink(id, isPlaylist) {
        let link = buildSpotifyLink(id, isPlaylist);

        if (id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
            link = "https://open.spotify.com/collection/tracks";
        }

        let messageContext = "";
        if (isPlaylist == '1') {
            messageContext = "playlist";
        } else {
            messageContext = "track";
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

    async  populateSpotifyPlaylists() {
        const dataMgr = MusicDataManager.getInstance();
    
        // reconcile playlists
        dataMgr.reconcilePlaylists();
    
        // clear out the raw and orig playlists
        dataMgr.origRawPlaylistOrder = [];
        dataMgr.rawPlaylists = [];
    
        // fire off the populate spotify devices
        await populateSpotifyDevices();
    
        // fetch music time app saved playlists
        await dataMgr.fetchSavedPlaylists();
        // fetch the playlists from spotify
        const rawPlaylists = await getPlaylists(PlayerName.SpotifyWeb, {
            all: true
        });
    
        // set the list of playlistIds based on this current order
        dataMgr.origRawPlaylistOrder = [...rawPlaylists];
        dataMgr.rawPlaylists = rawPlaylists;
    
        // populate generated playlists
        await dataMgr.populateGeneratedPlaylists();
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
                        utilMgr.removeMusicMenuItem(
                            CONNECT_SLACK_MENU_LABEL
                        );
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
    let link = "";
    id = utilMgr.createSpotifyIdFromUri(id);
    if (isPlaylist == '1') {
        link = `https://open.spotify.com/playlist/${id}`;
    } else {
        link = `https://open.spotify.com/track/${id}`;
    }

    return link;
}

