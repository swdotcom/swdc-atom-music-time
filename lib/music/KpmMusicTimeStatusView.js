'use babel';

let $ = require('jquery');
import {
    PLAY_CONTROL_ICON,
    PAUSE_CONTROL_ICON,
    NEXT_CONTROL_ICON,
    PREV_CONTROL_ICON,
    LIKE_ICON_OUTLINE,
    LIKE_ICON,
    TIME_RELOAD,
    HEADPHONES,
    PULSE_ICON
} from '../Constants';
import { MusicDataManager } from './MusicDataManager';
import { requiresSpotifyAccess } from "../managers/SpotifyManager";

const fileUtil = require('../utils/FileUtil');
const commonUtil = require("../utils/CommonUtil");
const stringUtil = require("../utils/StringUtil");

let hideCurrentSongTimeout = null;
let initializedFooter = false;

$(function() {
    isReady = true;
    $(document).on('click', '#music-play-control-status', async function() {
        const track = MusicDataManager.getInstance().runningTrack;

        if (track && track.state == 'paused') {
            $('#play-image').attr('src', PAUSE_CONTROL_ICON);
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:play'
            );
        } else if (track && track.state == 'playing') {
            $('#play-image').attr('src', PLAY_CONTROL_ICON);

            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:pause'
            );
        }
    });

    $(document).on('click', '#music-time-connect', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connect-spotify'
        );
    });

    $(document).on('click', '#music-time-icon', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:toggle-music-tree'
        );
    });

    $(document).on('click', '.share-song', function(e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem('isSharePlaylist', '0');
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

    $(document).on('click', '.recommend-song', function(e) {
      e.stopPropagation();
      var _self = this;

      localStorage.setItem(
          '_selectedRecommendPlaylistTrackId',
          $(_self).attr('node-id')
      );
      localStorage.setItem(
          '_selectedRecommendPlaylistTrackName',
          $(_self).attr('node-text')
      );

      atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'Music-Time:recommendation-for-track'
      );
    });

    $(document).on('click', '.add-song', function(e) {
        e.stopPropagation();
        var _self = this;

        $(_self).attr('node-id')
            ? localStorage.setItem(
                '_selectedAddPlaylistTrackId',
                $(_self).attr('node-id')
            )
            : localStorage.setItem('_selectedAddPlaylistTrackId', '');
        $(_self).attr('node-parent-id')
            ? localStorage.setItem(
                '_selectedAddTrackParentId',
                $(_self).attr('node-parent-id')
            )
            : localStorage.setItem('_selectedAddTrackParentId', '');

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:addToPlaylist'
        );
    });

    $(document).on('click', '.remove-song', function(e) {
        e.stopPropagation();
        var _self = this;

        $(_self).attr('node-id')
            ? localStorage.setItem(
                '_selectedAddPlaylistTrackId',
                $(_self).attr('node-id')
            )
            : localStorage.setItem('_selectedAddPlaylistTrackId', '');
        $(_self).attr('node-parent-id')
            ? localStorage.setItem(
                '_selectedAddTrackParentId',
                $(_self).attr('node-parent-id')
            )
            : localStorage.setItem('_selectedAddTrackParentId', '');

        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:removeSong'
        );
    });

    $(document).on('click', '.share-playlist', function(e) {
        e.stopPropagation();
        var _self = this;
        localStorage.setItem('isSharePlaylist', '1');
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
    });

    $(document).on('click', '#account-status-href', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connect-spotify'
        );
    });

    $(document).on('click', '#music-next-control-status', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:next'
        );
    });
    $(document).on('click', '#music-prev-control-status', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:previous'
        );
    });

    $(document).on('click', '#refresh-song-status', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:refreshSongStatus'
        );
    });

    $(document).on('click', '#current-track-status', async function() {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:launchTrackPlayer'
        );
    });

    $(document).on('click', '#likeSong', async function() {
        let id = $('#likeSong span').attr('id');
        if (id == 'unlike-status-href') {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:like'
            );
            $('#unlike-status-href img').attr('src', TIME_RELOAD);
        } else {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:unlike'
            );
            $('#like-status-href img').attr('src', TIME_RELOAD);
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

        this.musicIcon = document.createElement('div');
        this.musicIcon.classList.add('msg-status');
        this.musicIcon.classList.add('inline-block');
        this.musicIcon.setAttribute('id', 'music-time-icon');
        this.musicIcon.setAttribute('style', 'cursor:pointer;');

        this.statusSpan = document.createElement('span');
        this.statusSpan.classList.add('status-info');
        this.statusSpan.classList.add('inline-block');
        this.statusSpan.setAttribute('id', 'music-time-status');
        this.statusSpan.setAttribute('style', 'cursor:pointer;');

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

        this.likeStatus = document.createElement('div');
        this.likeStatus.classList.add('inline-block');
        this.likeStatus.setAttribute('id', 'likeSong');
        this.likeStatus.setAttribute('style', 'cursor:pointer');

        this.refreshSongElement = document.createElement('div');
        this.refreshSongElement.classList.add('msg-status');
        this.refreshSongElement.classList.add('inline-block');
        this.refreshSongElement.setAttribute('id', 'refresh-song-status');
        this.refreshSongElement.setAttribute('style', 'cursor:pointer;');

        this.currentTrack = document.createElement('div');
        this.currentTrack.classList.add('msg-status');
        this.currentTrack.classList.add('inline-block');
        this.currentTrack.setAttribute('id', 'current-track-status');
        this.currentTrack.setAttribute('style', 'cursor:pointer;');
    }

    // Returns an object that can be retrieved when package is activated
    serialize() { }

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    clearStatus() {
        $('#like-status-href').hide();
    }

    intializeFooterElements() {

        if (initializedFooter) {
            return;
        }

        const footerBars = atom.workspace.getFooterPanels();
        if (footerBars && footerBars.length) {
            footerBars[0].getItem().leftPanel.appendChild(this.musicIcon);
            footerBars[0].getItem().leftPanel.appendChild(this.statusSpan);
            footerBars[0].getItem().leftPanel.appendChild(this.prevElement);
            footerBars[0].getItem().leftPanel.appendChild(this.playElement);
            footerBars[0].getItem().leftPanel.appendChild(this.nextElement);
            footerBars[0].getItem().leftPanel.appendChild(this.likeStatus);
            footerBars[0].getItem().leftPanel.appendChild(this.refreshSongElement);
            footerBars[0].getItem().leftPanel.appendChild(this.currentTrack);
            footerBars[0].getItem().leftPanel.appendChild(this.element);
        }

        initializedFooter = true;
    }

    /**
     * Display the message in the status bar
     **/
    async display() {

        const track = MusicDataManager.getInstance().runningTrack;

        const name = fileUtil.getItem("name");

        let headphonesTooltip = `Click to see more from Music Time`;
        if (name) {
            headphonesTooltip = `Click to see more from Music Time. Logged in as ${name}`;
        }

        const needsSpotifyAccess = await requiresSpotifyAccess();

        if (!this.dataMgr) {
            this.dataMgr = MusicDataManager.getInstance();
        }

        let headphonesHtml = "<span id='music-time-menu' style='padding: 0; margin: 0;cursor: pointer;' title='" + headphonesTooltip + "'><img width='10' height='10' src='" + HEADPHONES + "' style='padding: 0; margin: 0;'/></span>";
        this.musicIcon.innerHTML = headphonesHtml;

        if (needsSpotifyAccess) {
            this.statusSpan.innerHTML = "<span id='music-time-connect' style='cursor:pointer;'>Connect Spotify</span>";
        } else {
            // make sure this element is hidden
            this.statusSpan.innerHTML = "";
            this.statusSpan.setAttribute('style', 'display:none;');
        }

        let foundLiked = false;
        // let skipTrack = false;
        if (track && track.id && this.dataMgr.spotifyLikedSongs) {
            foundLiked = this.dataMgr.spotifyLikedSongs.find(
                element => element.id === track.id
            );
        }

        const likeStatusMsg = 'Like/Unlike Song';

        let currentTrackTooltip = "Click to view track"
        if (track && track.name) {
            currentTrackTooltip = `(${track.name}) Click to view track`;
        }
        let playTooltip = 'Click to play/pause song';
        let nextTooltip = 'Click to play next song';
        let previousTooltip = 'Click to play previous song';

        let currentTrackName = track && track.name
            ? stringUtil.text_truncate(track.name, 15)
            : '';

        const refreshDisplay = currentTrackName ? "display:none" : "";
        const likeDisplay = !currentTrackName ? "display:none" : "";

        let songStateIcon =
            track && track.state == 'playing'
                ? PAUSE_CONTROL_ICON
                : PLAY_CONTROL_ICON;

        this.playElement.innerHTML =
            "<span id='music-play-control-href' class='play-control-panel' title='" + playTooltip + "'><img width='10' height='10' id='play-image' src='" + songStateIcon + "' style='padding: 0; margin: 0;'/></span>";

        this.nextElement.innerHTML =
            "<span id='music-next-control-href' class='play-control-panel' title='" + nextTooltip + "'><img width='10' height='10' src='" + NEXT_CONTROL_ICON + "' style='padding: 0; margin: 0;'/></span>";

        this.prevElement.innerHTML =
            "<span id='music-prev-control-href' class='play-control-panel' title='" + previousTooltip + "'><img width='10' height='10' src='" + PREV_CONTROL_ICON + "' style='padding: 0; margin: 0;'/></span>";

        if (track && track.id) {
          this.likeStatus.setAttribute('style', 'cursor:pointer');
          if (foundLiked) {
              this.likeStatus.innerHTML =
                `<span id='like-status-href' class='play-control-panel' style='${likeDisplay}' title='${likeStatusMsg}'><img width='13' height='13' src='${LIKE_ICON}'/></span>`;
          } else {
              this.likeStatus.innerHTML =
                `<span id='unlike-status-href' class='play-control-panel' style='${likeDisplay}' title='${likeStatusMsg}'><img width='13' height='13' src='${LIKE_ICON_OUTLINE}'/></span>`;
          }
        } else {
          this.likeStatus.setAttribute('style', 'display:none;');
        }

        if (!currentTrackName) {
          this.refreshSongElement.innerHTML = `<span id='music-refresh-song-href' class='play-control-panel' style='${refreshDisplay}' title='Refresh song status'><img width='12' height='12' src='${PULSE_ICON}' style='padding: 0; margin: 0;'/></span>`;
        } else {
          // hide it until the song is hidden
          this.refreshSongElement.setAttribute('style', 'display:none;');
        }

        this.currentTrack.innerHTML = `<span id='music-current-control-href' class='play-control-panel' title='${currentTrackTooltip}'>${currentTrackName}</span>`;

        this.intializeFooterElements();

        this.hideCurrentSong();
    }

    hideCurrentSong() {
        if (hideCurrentSongTimeout) {
            // cancel the current timeout
            clearTimeout(hideCurrentSongTimeout);
            hideCurrentSongTimeout = null;
        }

        hideCurrentSongTimeout = setTimeout(() => {
           this.refreshSongElement.setAttribute('style', 'cursor:pointer;');
           $('#music-current-control-href').hide();
        }, 5000);
    }
}
