'use babel';

import $ from 'jquery';
import fs, { link } from 'fs';
import path from 'path';
import KpmMusicControlManager from './KpmMusicControlManager';
import { MusicDataManager } from "./MusicDataManager";
import {
    ADD_ICON,
    TRACK_ICON,
    PLAYLIST_ICON_GREEN,
    TRACK_ICON_DARK,
    SPOTIFY_ICON,
    PAW_ICON,
    DIVIDER,
    LIKE_ICON,
    REFRESH_ICON,
    USER_PLAYLIST,
    SHARE_ICON,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    REFRESH_CUSTOM_PLAYLIST_TITLE,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_CUSTOM_PLAYLIST_TOOLTIP,
    GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
    REMOVE_ICON,
} from '../Constants';


const deviceMgr = require("./DeviceManager");
const utilMgr = require('../UtilManager');
const fileUtil = require('../FileUtil');
const stringUtil = require("../StringUtil");

$(document).on('click', '#spotify-refresh-playlist', function() {
    let text = $(this).text();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:generateUsersWeeklyTopSongs'
    );
});

$(document).on('click', '#sortDropDown', function() {
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', '#addToPlaylist', function() {
    let text = $(this).text();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:addToPlaylist'
    );
});

$(document).on('click', '#musictime-open-dashboard', function() {
    let text = $(this).text();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:web-dashboard'
    );
});

$(document).on('click', '#alphabetically', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:sortAlphabetically'
    );
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', '#sortToOriginal', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:sortToOriginal'
    );
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', '#category-recommendation', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:showCategorySelections'
    );
});

$(document).on('click', '#genre-recommendation', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:showGenreSelections'
    );
    //command-palette:toggle
});

$(document).on('click', '#spotify-connect', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:connectSpotify'
    );
});

$(document).on('click', '#musictime-learn-more', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:musictime-learn-more'
    );
});

$(document).on('click', '#musictime-web-analytics', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:launchAnalytics'
    );
});

$(document).on('click', '#spotify-player-device', function() {
    let deviceCount = $(this).attr('device-count');
    if (!deviceCount || deviceCount == 0) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connectDevice'
        );
    }
});

export default class StructureView {
    constructor() {
        this.musicControlMgr = KpmMusicControlManager.getInstance();

        // default button label/tooltip
        this._generatePLaylistButton = {
            label: GENERATE_CUSTOM_PLAYLIST_TITLE,
            tooltip: GENERATE_CUSTOM_PLAYLIST_TOOLTIP,
        };

        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'structure-view.html'),
            {
                encoding: 'utf-8',
            }
        );
        this.element = $(htmlString).get(0);
        this.viewType = 'structureView';
        this._myPlaylists = [];
        this._myRecommendations = {};
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new StructureView();
        }

        return this.instance;
    }

    showLoader() {
        // $('#tree-content').hide();
        // $('#loaderdiv span').text('Disconnecting Spotify...');
        $('#loaderdiv span').text('Loading...');
        $('#loaderdiv').show();
    }

    hideLoader() {
        $('#tree-content').show();
        $('#loaderdiv').hide();
    }

    getUnique(arr, comp) {
        const unique = arr
            .map(e => e[comp])

            // store the keys of the unique objects
            .map((e, i, final) => final.indexOf(e) === i && i)

            // eliminate the dead keys & store unique objects
            .filter(e => arr[e])
            .map(e => arr[e]);

        return unique;
    }

    refreshTreeView() {
        const dataMgr = MusicDataManager.getInstance();

        this._myPlaylists = dataMgr.spotifyPlaylists;
        this._myRecommendations = dataMgr.recommendationPlaylist;

        const hasPlaylistData = this._myPlaylists && this._myPlaylists.length ? true : false;
        const hasRecData = this._myRecommendations && this._myRecommendations.childs ? true : false;

        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
        if (requiresSpotifyAccess) {
            this.showDisconnectedTree();
        } else if (hasPlaylistData) {
            this.showConnectedTree();
        } else {
            this.preInitialize();
        }

        this.updateDevice();
    }

    async initialize(
        selectedPlaylistTrackId,
        generatePLaylistButton = {}
    ) {
        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();

        const dataMgr = MusicDataManager.getInstance();

        this._myRecommendations = dataMgr.recommendationPlaylist;
        this._myPlaylists = dataMgr.spotifyPlaylists
        this._selectedPlaylistTrackId = selectedPlaylistTrackId;
        this._generatePLaylistButton = generatePLaylistButton;

        const hasPlaylistData = this._myPlaylists && this._myPlaylists.length ? true : false;
        const hasRecData = this._myRecommendations && this._myRecommendations.childs ? true : false;

        if (requiresSpotifyAccess) {
            this.showDisconnectedTree();
        } else if (hasPlaylistData) {
            this.showConnectedTree();
        } else {
            this.preInitialize();
        }

        this.updateDevice();
    }

    preInitialize() {
        this.showLoader();

        this.toggleConnectSpotify();
        this.toggleWebAnalytics();
        this.toggleLearnMore(false /*isHide*/);
    }

    showConnectedTree() {
        this.showLoader();

        this.renderTree();

        $('#refresh-treeview').attr('src', REFRESH_ICON);
        $('#refresh-recommendation').attr('src', REFRESH_ICON);
        $('#spotify-refresh-playlist').text(this._generatePLaylistButton.label);

        // false means to show it
        this.toggleDeviceStatus(false);
        this.togglerMenuDivider(false);
        this.toggleLearnMore(false);
        this.toggleOpenDashboard(false);
        this.toggleSortTreeview(false);
        this.toggleRefreshTreeview(false);
        this.toggleSearchTreeview(false);
        this.toggleSortDev(false);
        this.toggleLikeButton(false);
        this.toggleWebAnalytics();
        $('#spotify-refresh-playlist').show();

        // true means to hide it
        this.toggleConnectSpotify();
        $('#spotify-status').hide();

        this.renderRecommendTree();
        this.toggleRefreshRecommendation(false);

        this.hideLoader();
    }

    showDisconnectedTree() {
        this.showLoader();

        this.renderRecommendTree();
        this.renderTree();

        // false means to show it
        this.toggleLearnMore(false);
        this.toggleConnectSpotify();
        $('#spotify-refresh-playlist').hide();

        // true means to hide it
        this.toggleDeviceStatus(true);
        this.togglerMenuDivider(true);
        this.toggleWebAnalytics();
        this.toggleOpenDashboard(true);
        this.toggleSortTreeview(true);
        this.toggleRefreshTreeview(true);
        this.toggleSearchTreeview(true);
        this.toggleRefreshRecommendation(true);
        $('#tree-content').show();

        this.hideLoader();
    }

    async updateDevice() {
        const devicesFound = await deviceMgr.getActiveSpotifyDevicesButton()
        $('#spotify-player-device').text(devicesFound.title);
        $('#spotify-player-device').prop('title', devicesFound.tooltip);
        $('#spotify-player-device').prop(
            'device-count',
            devicesFound.deviceCount
        );
    }

    toggleOpenDashboard(isHide) {
        if (isHide) {
            $('#musictime-open-dashboard').hide();
        } else {
            $('#musictime-open-dashboard').show();
        }
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }

    togglerMenuDivider(isHide) {
        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
        const requiresReAuth = fileUtil.requiresSpotifyReAuthentication();

        if (requiresSpotifyAccess || requiresReAuth) {
            $('#menu-divider').hide();
        } else {
            $('#menu-divider').show();
        }
    }

    toggleLearnMore(isHide) {
        if (isHide) {
            $('#musictime-learn-more').hide();
        } else {
            $('#musictime-learn-more').show();
        }
    }

    toggleWebAnalytics() {
        const nameVal = fileUtil.getItem("name");
        const jwtVal = fileUtil.getItem("jwt");
        if (nameVal && jwtVal) {
            $('#musictime-web-analytics').show();
        } else {
            $('#musictime-web-analytics').hide();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
        }
    }

    toggleSortTreeview(isHide) {
        if (isHide) {
            $('#sort-treeview').hide();
        } else {
            $('#sort-treeview').show();
        }
    }

    toggleSearchTreeview(isHide) {
        if (isHide) {
            $('#song-search').hide();
        } else {
            $('#song-search').show();
        }
    }

    toggleLikeButton(isHide) {
        if (isHide) {
            $('#likeSong').hide();
            $('#unlikeSong').hide();
        } else {
            $('#likeSong').show();
            $('#unlikeSong').show();
        }
    }

    toggleRecommendationRefreshTreeview(isHide) {
        if (isHide) {
            $('#recommedation-refresh-treeview').hide();
        } else {
            $('#recommedation-refresh-treeview').show();
        }
    }

    toggleRefreshRecommendation(isHide) {
        if (isHide) {
            $('#refresh-recommendation').hide();
        } else {
            $('#refresh-recommendation').show();
        }
    }

    toggleSortDev(isHide) {
        if (isHide) {
            $('#sortDiv').hide();
        } else {
            $('#sortDiv').show();
        }
    }

    toggleConnectSpotify() {
        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
        const requiresReAuth = fileUtil.requiresSpotifyReAuthentication();

        if (!requiresSpotifyAccess && !requiresReAuth) {
            $('#spotify-connect').hide();
        } else {
            const connectLabel = requiresReAuth ? "Reconnect Spotify" : "Connect Spotify";
            $('#spotify-connect').text(connectLabel);
            $('#spotify-connect').show();
        }
    }

    renderTree() {
        let html = this.treeGenerator();
        $('#tree-playlist').html(html);
        this.hideLoader();
    }

    renderRecommendTree() {
        let html = this.recommendTreeGenerator();
        $('#musictime-tree-recommend-playlist').html(html);
    }

    clearTree() {
        // clear the playlist and recommendations
        const dataMgr = MusicDataManager.getInstance();
        dataMgr.spotifyPlaylists = [];
        dataMgr.recommendationPlaylist = {};
        $('div.structure-view-music-time>div>ol#tree-playlist').html('');
        this.refreshTreeView();
    }

    treeGenerator(data) {
        let array = [],
            letter;

        if (!this._myPlaylists || this._myPlaylists.length === 0) {
            return;
        }

        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
        const requiresReAuth = fileUtil.requiresSpotifyReAuthentication();

        this._myPlaylists.forEach((item, index) => {
            if (item) {
                let isChildAvailable =
                    item.child && item.child.length > 0 ? true : false;

                let playTooltip = 'Click to play/pause song';
                let shareTooltip = 'Share a song';
                let addTooltip = 'Add a song to playlist';
                let isCollapsedClass = 'collapsed';
                let playlistIcon = '';
                let arrowClass = 'play-list-angle-right';
                // let SHARE_ICON = SHARE_ICON;
                if (item.isSelected && isChildAvailable) {
                    isCollapsedClass = '';
                    arrowClass = 'play-list-angle-down';
                }

                if (item.tag == 'paw') {
                    playlistIcon = PAW_ICON;
                } else if (item.tag == 'spotify') {
                    playlistIcon = SPOTIFY_ICON;
                } else if (item.tag == 'liked') {
                    playlistIcon = LIKE_ICON;
                } else if (item.tag == 'user-playlist') {
                    playlistIcon = PLAYLIST_ICON_GREEN;
                }
                let entry = '';

                let shareParentInnerHTML = '';
                if (item.id !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                    shareParentInnerHTML = `<span class='playlist-control' title='${shareTooltip}'><img class='share-playlist share-parent-icon' node-text='${item.name}' title='Share ${item.name}' id='share-image-${item.id}' node-id='${item.id}' src='${SHARE_ICON}' /></span>`;
                }

                if (item.type == 'playlist') {
                    entry = `<li node-id="${item.id}" class="playlist-parent-li list-nested-item expanded list-item play-list ${arrowClass}  ${isCollapsedClass}" title="${item.name}"> <div class="symbol-mixed-block list-tab" style="margin-left: 8px; width: 100%; min-width: 210px;">
                        <img width='15' height='15' src='${playlistIcon}'
                        style="margin-right: 2px" />
                        <span>${stringUtil.text_truncate(item.name, 30)}</span>${shareParentInnerHTML}</div>`;

                    if (isChildAvailable) {
                        entry += `<ol class="list-tree child-list-tree">`;
                        item.child.forEach(childItem => {
                            let shareInnerHTML = `<span class='playlist-control' title='${shareTooltip}'><img class='share-song share-icon' node-text='${childItem.name}' title='Share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/></span>`;
                            let addSongInnerHTML = `<span class='playlist-control' title='${addTooltip}'><img class='add-song share-icon' node-parent-id='${item.id}' title='Add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/></span>`;

                            let trackIcon = `<img src='${TRACK_ICON_DARK}' style='margin-right: 2px;' >`;

                            let removeSongInnerHTML = '';
                            if (item.itemType === "playlist") {
                                removeSongInnerHTML = `<span class='playlist-control' title='Remove ${childItem.name}'><img class='remove-song share-icon' node-parent-id='${item.id}' title='Remove ${childItem.name}' id='remove-image-${childItem.id}' node-id='${childItem.id}' src='${REMOVE_ICON}'/></span>`;
                            }

                            if (childItem.itemType === 'empty') {
                                shareInnerHTML = '';
                                addSongInnerHTML = '';
                                trackIcon = '';
                                removeSongInnerHTML = '';
                            }

                            const artist = this.getArtist(childItem);

                            //if (childContent.length != 0) {
                            entry += `<li node-id="${
                                childItem.id
                            }" parent-node-id='${
                                item.id
                            }' class="list-item playlist-nested-item playlist-li tracks-li" title="${
                                childItem.name
                            }">

                            <div class="symbol-mixed-block" style="margin-left: 8px;">
                            ${trackIcon}
                                <span>${stringUtil.text_truncate(
                                    childItem.name,
                                    30
                                )}</span>
                                <span class="artist-label">${artist}</span>
                                ${removeSongInnerHTML}
                                ${addSongInnerHTML}
                                ${shareInnerHTML}

                            </div>
                        </li>`;
                        });
                        entry += `</ol>`;
                    }
                    entry += `</li>`;
                }

                if (!requiresSpotifyAccess && !requiresReAuth && item.type == 'divider' && index > 0) {
                    entry = `<li>&nbsp;&nbsp;&nbsp;&nbsp;<span><img width='11' height='11' class='divider' src='${DIVIDER}'/></span></li>`;
                }

                array.push(entry);
            }
        });

        return array.join('');
    }

    recommendTreeGenerator() {
        let songItem = [];
        let array = [];

        const item = this._myRecommendations;

        if (item) {
            // let iconTpl = `<span class="icon icon-code"></span>`;
            let isChildAvailable =
                item.childs && item.childs.length > 0 ? true : false;

            let shareTooltip = 'Share a song';
            let isCollapsedClass = 'collapsed';
            let playlistIcon = '';
            let arrowClass = 'play-list-angle-right';
            // let SHARE_ICON = SHARE_ICON;
            if (item.isSelected && isChildAvailable) {
                isCollapsedClass = '';
                arrowClass = 'play-list-angle-down';
            }

            if (item.tag == 'paw') {
                playlistIcon = PAW_ICON;
            } else if (item.tag == 'spotify') {
                playlistIcon = SPOTIFY_ICON;
            }
            let entry = '';
            let addTooltip = 'Add a song to playlist';
            let shareParentInnerHTML = '';

            if (item.type == 'playlist') {
                entry = `<li node-id="${
                    item.id
                }" class="playlist-parent-li list-nested-item expanded  list-item  " style="
                    margin-right: 2px;" title="${
                        item.name
                    }"> <div class="symbol-mixed-block list-tab" style="margin-left: 8px;">

                        <img width='15' height='15' src='${playlistIcon}'/>
                        <span>${stringUtil.text_truncate(item.name, 35)}</span>
                            ${shareParentInnerHTML}

                        </div>
                    `;

                if (isChildAvailable) {
                    //let childContent = self.treeGenerator(item.child);
                    let trackIcon = `<img src='${TRACK_ICON_DARK}'  >`;

                    entry += `<ol class="list-tree child-list-tree">`;
                    item.childs.forEach(childItem => {
                        let shareInnerHTML = `<span class='playlist-control' title='
                ${shareTooltip}
              '><img class='share-song share-icon' node-text='${childItem.name}' title='Share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/>
              </span>`;
                        let addSongInnerHTML = `<span class='playlist-control' title='
              ${addTooltip}
            '><img class='add-song share-icon' node-parent-id='${item.id}' title='Add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/>
            </span>`;

                        const songName = childItem.name;
                        const artist = this.getArtist(childItem);

                        entry += `<li node-id="${
                            childItem.id
                        }"  class="list-item playlist-recommend-item playlist-li " title="${songName}">

                            <div class=" symbol-mixed-block" style="margin-left: 8px;">
                            ${trackIcon}
                                <span>${stringUtil.text_truncate(
                                    songName,
                                    30
                                )}</span>
                                <span class="artist-label">${artist}</span>

                                ${addSongInnerHTML}
                                ${shareInnerHTML}

                            </div>
                        </li>`;
                    });
                    entry += `</ol>`;
                }
                entry += `</li>`;
            }

            array.push(entry);
        }
        return array.join('');
    }

    serialize() {}

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Music Time';
    }

    getArtist(item) {
        let artist = '';
        if (item && item.artist) {
            artist = item.artist;
        } else if (item && item.artists && item.artists.length) {
            const artistNames = item.artists.map(n => n.name);
            if (artistNames.length) {
                artist = artistNames.join(', ');
            }
        }
        return artist;
    }
}
