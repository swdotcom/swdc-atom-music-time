'use babel';

let $ = require('jquery');
import {
    PLAY_CONTROL_ICON,
    PAUSE_CONTROL_ICON,
    NEXT_CONTROL_ICON,
    PREV_CONTROL_ICON,
    MUSIC_CONNECT_PREMIUM,
    CONNECT_SPOTIFY_COMMAND_KEY,
    LIKE_ICON_OUTLINE,
    LIKE_ICON,
} from '../Constants';
let readyMsg = '';
let isReady = false;
let userStatus = null;
// import '../node_modules/font-awesome/css/font-awesome.min.css';
import KpmMusicStoreManager from './KpmMusicStoreManager';
import { getRunningTrack,getSpotifyLikedSongs } from 'cody-music';
$(document).ready(function() {
    isReady = true;
    $(document).on('click', '#music-play-control-status', async function() {
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            await getRunningTrack().then(track => {
                this.trackData = track;
                if (track.state == 'paused') {
                    $('#play-image').attr('src', PAUSE_CONTROL_ICON);
                    atom.commands.dispatch(
                        atom.views.getView(atom.workspace),
                        'Music-Time:play'
                    );
                } else if (track.state == 'playing') {
                    $('#play-image').attr('src', PLAY_CONTROL_ICON);

                    atom.commands.dispatch(
                        atom.views.getView(atom.workspace),
                        'Music-Time:pause'
                    );
                }
            });
        }
    });

    $(document).on('click', '#music-time-status', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:toggle-music-tree'
        );
    });

    $(document).on('click', '.share-song', function(e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem(
            'isSharePlaylist',
            '0'
        );
        localStorage.setItem(
            '_selectedSharePlaylistTrackId',
            $(_self).attr('node-id')
        );
        localStorage.setItem(
            '_selectedSharePlaylistTrackName',
            $(_self).attr('node-text')
        );

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:share-track'
        );
    });

    $(document).on('click','.share-playlist' , function(e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem(
            'isSharePlaylist',
            '1'
        );
        localStorage.setItem(
            '_selectedSharePlaylistId',
            $(_self).attr('node-id')
        );
        localStorage.setItem(
            '_selectedSharePlaylistName',
            $(_self).attr('node-text')
        );

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:share-track'
        );
    })
    
    $(document).on('click', '#account-status-href', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connectSpotify'
        );
    });

    $(document).on('click', '#music-next-control-status', async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:next'
            );
        }
    });
    $(document).on('click', '#music-prev-control-status', async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:previous'
            );
        }
    });

    $(document).on('click', '#current-track-status', async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:launchTrackPlayer'
            );
        }
    });

    $(document).on('click', '#like-status-href ', async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:like'
            );
            $('#like-status-href img').attr('src', LIKE_ICON);
        }
    });
    $(document).on('click', '#unlike-status-href', async function() {
        // {loggedIn: true|false}
        if (!userStatus || !userStatus.loggedIn) {
            // no user accounts at all, redirect to signup
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:log-in'
            );
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:unlike'
            );
            $('#unlike-status-href img').attr('src', LIKE_ICON_OUTLINE);
        }
    });
});

export default class KpmMusicTimeStatusView {
    constructor() {
        var that = this;

        this.element = document.createElement('div');
        this.element.classList.add('msg-status');
        this.element.classList.add('inline-block');
        this.element.setAttribute('id', 'music-time-status');
        this.element.setAttribute('style', 'cursor:pointer;');

        this.playElement = document.createElement('div');
        this.playElement.classList.add('msg-status');
        this.playElement.classList.add('inline-block');
        this.playElement.setAttribute('id', 'music-play-control-status');
        this.playElement.setAttribute('style', 'cursor:pointer;');

        this.nextElement = document.createElement('div');
        this.nextElement.classList.add('msg-status');
        this.nextElement.classList.add('inline-block');
        this.nextElement.setAttribute('id', 'music-next-control-status');
        this.nextElement.setAttribute('style', 'cursor:pointer;');

        this.prevElement = document.createElement('div');
        this.prevElement.classList.add('msg-status');
        this.prevElement.classList.add('inline-block');
        this.prevElement.setAttribute('id', 'music-prev-control-status');
        this.prevElement.setAttribute('style', 'cursor:pointer;');

        this.stopElement = document.createElement('div');
        this.stopElement.classList.add('msg-status');
        this.stopElement.classList.add('inline-block');
        this.stopElement.setAttribute('id', 'music-stop-control-status');
        this.stopElement.setAttribute('style', 'cursor:pointer;');

        this.currentTrack = document.createElement('div');
        this.currentTrack.classList.add('msg-status');
        this.currentTrack.classList.add('inline-block');
        this.currentTrack.setAttribute('id', 'current-track-status');
        this.currentTrack.setAttribute('style', 'cursor:pointer;');

        this.accountStatus = document.createElement('div');
        this.accountStatus.classList.add('inline-block');
        this.accountStatus.setAttribute('id', 'account-status');

        this.likeStatus = document.createElement('div');
        this.likeStatus.classList.add('inline-block');
        this.likeStatus.setAttribute('id', 'likeSong');

        this.unLikeStatus = document.createElement('div');
        this.unLikeStatus.classList.add('inline-block');
        this.unLikeStatus.setAttribute('id', 'unlikeSong');
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    updateCurrentStatus(status) {
        userStatus = status;
    }

    clearStatus() {
        let nextNode = document.getElementById('music-next-control-status');
        let playNode = document.getElementById('music-play-control-status');
        let prevNode = document.getElementById('music-prev-control-status');
        let trackNode = document.getElementById('current-track-status');
        let footerBars = atom.workspace.getFooterPanels();
        if (
            footerBars &&
            footerBars.length > 0 &&
            nextNode &&
            playNode &&
            prevNode &&
            trackNode
        ) {
            footerBars[0].getItem().leftPanel.removeChild(nextNode);
            footerBars[0].getItem().leftPanel.removeChild(playNode);
            footerBars[0].getItem().leftPanel.removeChild(prevNode);
            footerBars[0].getItem().leftPanel.removeChild(trackNode);
        }
    }

    /**
     * Display the message in the status bar
     **/
    async display(msg, icon, tooltip, track) {
        if (KpmMusicStoreManager) {
            this.musicstoreMgr = KpmMusicStoreManager.getInstance();
        }
        const utilMgr = require('../UtilManager');
        var foundLiked = false;
        if (track && track.id) {
            let tracks = await getSpotifyLikedSongs();
            foundLiked = tracks.find(element => element.id == track.id );
        }
        
        
        this.trackData = track;
        const accountStatusMsg = 'Connect Premium';
        const likeStatusMsg = 'Like/Unlike Song';

        if (!tooltip) {
            tooltip = ' Click to see more from Music Time';
        }
        let playTooltip = 'Click to play/pause song';
        let nextTooltip = 'Click to play next song';
        let previousTooltip = 'Click to play previous song';

        if (userStatus && userStatus.name && userStatus.name !== '') {
            tooltip += ' (' + userStatus.name + ')';
        }

        let currentTrackName =
            this.trackData && this.trackData.state != 'notassigned'
                ? this.trackData.name
                : '';

        let iconClass = icon ? 'icon icon-' + icon : '';

        this.playElement.innerHTML =
            "<span id='music-play-control-href' class='" +
            iconClass +
            '\' style="cursor: pointer;" title=\'' +
            playTooltip +
            "'><img width='11' height='11' id='play-image' src='" +
            PLAY_CONTROL_ICON +
            "'/></span>";

        this.nextElement.innerHTML =
            "<span id='music-next-control-href' class='" +
            iconClass +
            '\' style="cursor: pointer;" title=\'' +
            nextTooltip +
            "'><img width='11' height='11' src='" +
            NEXT_CONTROL_ICON +
            "'/></span>";

        this.prevElement.innerHTML =
            "<span id='music-prev-control-href' class='" +
            iconClass +
            '\' style="cursor: pointer;" title=\'' +
            previousTooltip +
            "'><img width='11' height='11' src='" +
            PREV_CONTROL_ICON +
            "'/></span>";

        // there's nothing to get if it's windows and they don't have
        // a premium spotify account
        let premiumAccountRequired = this.musicstoreMgr
            ? utilMgr.isMac() && !this.musicstoreMgr.hasSpotifyPlaybackAccess()
                ? true
                : false
            : true;

        if ( currentTrackName) {
            this.currentTrack.innerHTML =
                "<span id='music-current-control-href' class='" +
                iconClass +
                '\' style="cursor: pointer;" title=\'' +
                tooltip +
                "'>" +
                currentTrackName +
                '</span>';
        } 
        
        if (premiumAccountRequired) {
            this.accountStatus.innerHTML =
                "<span id='account-status-href' style='cursor: pointer;' title='" +
                accountStatusMsg +
                "' > " +
                accountStatusMsg +
                '</span>';
        } else {
            this.accountStatus.innerHTML =
            "<span id='account-status-href' style='cursor: pointer; display:none' title='" +
            accountStatusMsg +
            "' > " +
            accountStatusMsg +
            '</span>';
        }

        if (foundLiked ) {
            this.likeStatus.innerHTML =
                "<span id='unlike-status-href' style='cursor: pointer;' title='" +
                likeStatusMsg +
                "'><img width='11' height='11' src='" +
                LIKE_ICON +
                "'/></span>";
        } else {
            this.likeStatus.innerHTML =
                "<span id='like-status-href' style='cursor: pointer;' title='" +
                likeStatusMsg +
                "'><img width='11' height='11' src='" +
                LIKE_ICON_OUTLINE +
                "'/></span>";
        }

        this.element.innerHTML =
            "<span id='music-time-href' class='" +
            iconClass +
            '\' style="cursor: pointer;" title=\'' +
            tooltip +
            "'>" +
            msg +
            '</span>';

        let footerBars = atom.workspace.getFooterPanels();
        // footerBars[0].getItem().leftPanel.innerHTML = "";
        let needsSpotifyAccess = this.musicstoreMgr
            ? this.musicstoreMgr.requiresSpotifyAccess()
            : true;

        await getRunningTrack().then(track => {
            // console.log(footerBars[0].getItem());
            if (footerBars && footerBars.length > 0) {
                footerBars[0].getItem().leftPanel.appendChild(this.element);
            }
            if (track.state !== 'notassigned' && !needsSpotifyAccess) {
                footerBars[0].getItem().leftPanel.appendChild(this.prevElement);
                footerBars[0].getItem().leftPanel.appendChild(this.playElement);
                footerBars[0].getItem().leftPanel.appendChild(this.nextElement);
                footerBars[0].getItem().leftPanel.appendChild(this.currentTrack);
                footerBars[0].getItem().leftPanel.appendChild(this.likeStatus);
            }

            if (
                utilMgr.getItem('isSpotifyConnected') &&
                premiumAccountRequired
            ) {
                footerBars[0]
                    .getItem()
                    .leftPanel.appendChild(this.accountStatus);
                utilMgr.addMusicMenuItem(
                    MUSIC_CONNECT_PREMIUM,
                    CONNECT_SPOTIFY_COMMAND_KEY
                );
            } else {
                utilMgr.removeMenuItem(MUSIC_CONNECT_PREMIUM);
            }
            if (track.state == 'paused') {
                $('#play-image').attr('src', PLAY_CONTROL_ICON);
            } else if (track.state == 'playing') {
                $('#play-image').attr('src', PAUSE_CONTROL_ICON);
            }
        });
    }
}
