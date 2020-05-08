'use babel';

import $ from 'jquery';
import fs, { link } from 'fs';
import path from 'path';
import KpmMusicControlManager from './KpmMusicControlManager';
import KpmMusicManager from './KpmMusicManager';
import {
    ADD_ICON,
    TRACK_ICON,
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

const utilMgr = require('../UtilManager');
const fileUtil = require('../FileUtil');

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

$(document).on('click', '#open-dashboard', function() {
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

$(document).on('click', '#learn-more', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:learn-more'
    );
});

$(document).on('click', '#web-analytics', function() {
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
        this._myRecommendations = [];
    }

    showLoader(isRecommendTree = false, isDisconnect = false) {
        if (!isRecommendTree) {
            $('#tree-content').hide();
            if (isDisconnect) {
                $('#loaderdiv span').text('Disconnecting Spotify...');
            } else {
                $('#loaderdiv span').text('Loading...');
            }

            $('#loaderdiv').show();
        }
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
        this._myPlaylists = KpmMusicManager.getInstance().spotifyPlaylists;
        this._myRecommendations = KpmMusicManager.getInstance().recommendationPlaylist;
        const requiresSpotifyAccess = fileUtil.requiresSpotifyAccess();
        if (requiresSpotifyAccess) {
            this.initializeNeedsAccess();
        } else {
            this.initializeHasAccess();
        }
    }

    async initialize(
        spotifyPlaylists,
        selectedPlaylistTrackId,
        devicesFound = [],
        generatePLaylistButton = {},
        recommendPlaylists = [],
        isRecommendTree,
        needsSpotifyAccess,
        premiumAccountRequired
    ) {
        this.showLoader(isRecommendTree);

        this._myRecommendations = recommendPlaylists;
        this._myPlaylists = spotifyPlaylists
        this._selectedPlaylistTrackId = selectedPlaylistTrackId;
        this._generatePLaylistButton = generatePLaylistButton;

        const initializedApp = KpmMusicManager.getInstance().initialized;

        if (needsSpotifyAccess) {
            this.initializeNeedsAccess();
        } else {
            this.initializeHasAccess(isRecommendTree);
        }
    }

    initializeHasAccess(isRecommendTree = false) {
        this.showLoader(isRecommendTree);

        //show connected spotify device
        if (isRecommendTree) {
            this.renderRecommendTree();
        } else {
            this.renderTree();
        }

        this.toggleDeviceStatus(false);
        this.toggleLearnMore(false);
        this.toggleOpenDashboard(false);
        this.toggleSortTreeview(false);
        this.toggleRefreshTreeview(false);
        this.toggleSearchTreeview(false);
        this.toggleRecommendHeadview(false);
        this.toggleRecommendTreeview(false);
        this.toggleRefreshRecommendation(false);
        this.toggleSortDev(false);
        this.toggleLikeButton(false);

        $('#refresh-treeview').attr('src', REFRESH_ICON);
        $('#refresh-recommendation').attr('src', REFRESH_ICON);

        this.toggleWebAnalytics(false);

        this.toggleConnectSpotify(true);
        $('#spotify-status').hide();
        $('#spotify-refresh-playlist').text(this._generatePLaylistButton.label);
        $('#spotify-refresh-playlist').show();

        this.hideLoader();
    }

    initializeNeedsAccess() {
        this.showLoader(false /*isRecommendTree*/);

        this.toggleDeviceStatus(true);
        this.toggleLearnMore(false);
        this.toggleWebAnalytics(true);

        $('#tree-content').show();
        this.toggleConnectSpotify(false);
        this.toggleOpenDashboard(true);
        $('#spotify-refresh-playlist').hide();
        this.toggleSortTreeview(true);
        this.toggleRefreshTreeview(true);
        this.toggleSearchTreeview(true);
        this.toggleRecommendHeadview(true);
        this.toggleRecommendTreeview(true);
        this.toggleRefreshRecommendation(true);
        this.toggleWebAnalytics(true);

        this.hideLoader();
    }

    updateDevice(devicesFound) {
        $('#spotify-player-device').text(devicesFound.title);
        $('#spotify-player-device').prop('title', devicesFound.tooltip);
        $('#spotify-player-device').prop(
            'device-count',
            devicesFound.deviceCount
        );
    }

    toggleOpenDashboard(isHide) {
        if (isHide) {
            $('#open-dashboard').hide();
        } else {
            $('#open-dashboard').show();
        }
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }

    toggleLearnMore(isHide) {
        if (isHide) {
            $('#learn-more').hide();
        } else {
            $('#learn-more').show();
        }
    }

    toggleWebAnalytics(isHide) {
        if (isHide) {
            $('#web-analytics').hide();
        } else {
            $('#web-analytics').show();
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

    toggleRecommendHeadview(isHide) {
        if (isHide) {
            $('#recommend-head-bar').hide();
        } else {
            $('#recommend-head-bar').show();
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

    toggleRecommendTreeview(isHide) {
        if (isHide) {
            $('#tree-recommend-content').hide();
        } else {
            $('#tree-recommend-content').show();
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

    toggleConnectSpotify(isHide) {
        if (isHide) {
            $('#spotify-connect').hide();
        } else {
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
        $('#tree-recommend-playlist').html(html);
    }

    clearTree() {
        $('div.structure-view-music-time>div>ol#tree-playlist').html('');
    }

    treeGenerator(data) {
        let array = [],
            letter;

        if (!this._myPlaylists || this._myPlaylists.length === 0) {
            return;
        }

        this._myPlaylists.forEach((item, index) => {
            if (item) {
                // let iconTpl = `<span class="icon icon-code"></span>`;
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
                    playlistIcon = USER_PLAYLIST;
                }
                let entry = '';

                let shareParentInnerHTML = '';
                if (item.id !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                    shareParentInnerHTML = `<span class='playlist-control' title='${shareTooltip}'><img width='11' height='11' class='share-playlist share-parent-icon' node-text='${item.name}' title='share ${item.name}' id='share-image-${item.id}' node-id='${item.id}' src='${SHARE_ICON}' /></span>`;
                }

                if (item.type == 'playlist') {
                    entry = `<li node-id="${item.id}" class="playlist-parent-li list-nested-item expanded list-item play-list ${arrowClass}  ${isCollapsedClass}" title="${item.name}"> <div class="symbol-mixed-block list-tab" style="margin-left: 8px;">
                        <img width='15' height='15' src='${playlistIcon}'
                        style="margin-right: 2px;" />
                        <span>${utilMgr.text_truncate(item.name, 35)}</span>${shareParentInnerHTML}</div>`;

                    if (isChildAvailable) {
                        //let childContent = self.treeGenerator(item.child);
                        entry += `<ol class="list-tree child-list-tree">`;
                        item.child.forEach(childItem => {
                            let shareInnerHTML = `<span class='playlist-control' title='${shareTooltip}'><img width='11' height='11' class='share-song share-icon' node-text='${childItem.name}' title='share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/></span>`;
                            let addSongInnerHTML = `<span class='playlist-control' title='${addTooltip}'><img class='add-song share-icon' node-parent-id='${item.id}' title='Add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/></span>`;

                            let trackIcon = `<img src='${TRACK_ICON}' style='margin-right: 2px;' >`;
                            if (childItem.itemType === 'empty') {
                                shareInnerHTML = '';
                                addSongInnerHTML = '';
                                trackIcon = '';
                            }
                            let removeSongInnerHTML = '';
                            if (item.id == SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                                removeSongInnerHTML = `<span class='playlist-control' title='Remove ${childItem.name}'><img class='remove-song share-icon' node-parent-id='${item.id}' title='Remove ${childItem.name}' id='remove-image-${childItem.id}' node-id='${childItem.id}' src='${REMOVE_ICON}'/></span>`;
                            }

                            const artist = this.getArtist(childItem);

                            //if (childContent.length != 0) {
                            entry += `<li node-id="${
                                childItem.id
                            }"  parent-node-id='${
                                item.id
                            }' class="list-item playlist-nested-item playlist-li tracks-li" title="${
                                childItem.name
                            }">

                            <div class=" symbol-mixed-block" style="margin-left: 8px;">
                            ${trackIcon}
                                <span>${utilMgr.text_truncate(
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
                if (item.type == 'divider' && index > 0) {
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
                    margin-right: 10px;" title="${
                        item.name
                    }"> <div class="symbol-mixed-block list-tab" style="margin-left: 8px;">

                        <img width='15' height='15' src='${playlistIcon}'/>
                        <span>${utilMgr.text_truncate(item.name, 35)}</span>
                            ${shareParentInnerHTML}

                        </div>
                    `;

                if (isChildAvailable) {
                    //let childContent = self.treeGenerator(item.child);
                    let trackIcon = `<img src='${TRACK_ICON}'  >`;

                    entry += `<ol class="list-tree child-list-tree">`;
                    item.childs.forEach(childItem => {
                        let shareInnerHTML = `<span class='playlist-control' title='
                ${shareTooltip}
              '><img width='11' height='11' class='share-song share-icon' node-text='${childItem.name}' title='share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/>
              </span>`;
                        let addSongInnerHTML = `<span class='playlist-control' title='
              ${addTooltip}
            '><img class='add-song share-icon' node-parent-id='${item.id}' title='add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/>
            </span>`;
                        //if (childContent.length != 0) {

                        const songName = childItem.name;
                        const artist = this.getArtist(childItem);

                        entry += `<li node-id="${
                            childItem.id
                        }"  class="list-item playlist-recommend-item playlist-li " title="${songName}">

                            <div class=" symbol-mixed-block" style="margin-left: 8px;">
                            ${trackIcon}
                                <span>${utilMgr.text_truncate(
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
            if (item.type == 'divider' && index > 0) {
                entry = `<li>&nbsp;&nbsp;<span class=''
          '><img width='11' height='11' class='divider' src='${DIVIDER}'/>
          </span> </li>`;
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
        if (item && item.artists && item.artists.length) {
            const artistNames = item.artists.map(n => n.name);
            if (artistNames.length) {
                artist = artistNames.join(', ');
            }
        }
        return artist;
    }
}
