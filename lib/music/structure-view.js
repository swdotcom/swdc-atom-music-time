'use babel';

import $ from 'jquery';
import fs from 'fs';
import path from 'path';
import _find from 'lodash/find';
import _forEach from 'lodash/forEach';

import KpmMusicStoreManager from './KpmMusicStoreManager';
import KpmMusicControlManager from './KpmMusicControlManager';
import { getUserProfile } from 'cody-music';
import {
    PLAY_CONTROL_ICON,
    FILTER_ICON,
    SPOTIFY_ICON,
    PAW_ICON,
    DIVIDER,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_ICON,
    SHARE_ICON,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
} from '../Constants';

const utilMgr = require('../UtilManager');

$(document).on('click', '#spotify-refresh-playlist', function() {
    let text = $(this).text();

    if (text == GENERATE_CUSTOM_PLAYLIST_TITLE) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:generateUsersWeeklyTopSongs'
        );
    } else {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:refreshPlaylist'
        );
    }
});
$(document).on('click', '#sortDropDown', function() {
    $('#myDropdown').toggleClass('show');
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

$(document).on('click', '#spotify-connect', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:connectSpotify'
    );
});

$(document).on('click', '#web-analytics', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:launchAnalytics'
    );
});

export default class StructureView {
    constructor() {
        this.musicControlMgr = new KpmMusicControlManager();
        this.musicstoreMgr = KpmMusicStoreManager.getInstance();

        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'structure-view.html'),
            {
                encoding: 'utf-8',
            }
        );
        this.element = $(htmlString).get(0);
        this.viewType = 'structureView';
    }
    showLoader() {
        $('#tree-content').hide();
        $('#loader').show();
    }

    hideLoader() {
        $('#tree-content').show();
        $('#loader').hide();
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

    async initialize(
        spotifyPlaylists,
        selectedPlaylistTrackId,
        devicesFound = [],
        generatePLaylistButton = {}
    ) {
        this.showLoader();
        if (spotifyPlaylists) {
            this._spotifyPlaylists = spotifyPlaylists;
        }
        this._selectedPlaylistTrackId = selectedPlaylistTrackId;
        let needsSpotifyAccess = this.musicstoreMgr.requiresSpotifyAccess();

        this.musicstoreMgr.spotifyUser = await getUserProfile();
        // there's nothing to get if it's windows and they don't have
        // a premium spotify account
        let premiumAccountRequired =
            !utilMgr.isMac() && !this.musicstoreMgr.hasSpotifyPlaybackAccess()
                ? true
                : false;

        if (needsSpotifyAccess || premiumAccountRequired) {
            this.toggleDeviceStatus(true);
            this.toggleWebAnalytics(true);
            // this.toggleDeviceStatus(true);

            $('#tree-content').show();
            if (
                utilMgr.getItem('spotify_access_token') &&
                utilMgr.getItem('isSpotifyConnected') == 0
            ) {
                $('#spotify-status').show();
                $('#spotify-status').text('Spotify Premium required');
            }
            this.toggleConnectSpotify(false);
            // $("#spotify-disconnect").hide();
            $('#spotify-refresh-playlist').hide();
            this.toggleRefreshTreeview(true);
            this.toggleRefreshRecommendation(true);
            this.hideLoader();
            this.toggleWebAnalytics(true);
        } else {
            //show connected spotify device
            this.renderTree(this._spotifyPlaylists);
            this.toggleDeviceStatus(false);
            this.toggleRefreshTreeview(false);
            this.toggleRefreshRecommendation(false);
            this.toggleSortDev(false);

            $('#refresh-treeview').attr('src', REFRESH_ICON);
            $('#spotify-player-device').text(devicesFound.title);
            $('#spotify-player-device').prop('title', devicesFound.tooltip);

            this.toggleWebAnalytics(false);

            $('#spotify-status').show();
            this.toggleConnectSpotify(true);
            $('#spotify-status').text('Spotify Connected');
            // $("#spotify-disconnect").show();
            $('#spotify-refresh-playlist').text(generatePLaylistButton.label);
            $('#spotify-refresh-playlist').show();
        }
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }
    toggleWebAnalytics(isHide) {
        if (isHide) {
            $('#sweb-analytics').hide();
        } else {
            $('#sweb-analytics').show();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
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

    toggleWebAnalytics(isHide) {
        if (isHide) {
            $('#web-analytics').hide();
        } else {
            $('#web-analytics').show();
        }
    }

    renderTree(spotifyPlaylists) {
        let html = this.treeGenerator(spotifyPlaylists);
        $('div.structure-view>div>ol#tree-playlist').html(html);
        this.hideLoader();
    }

    clearTree() {
        $('div.structure-view>div>ol#tree-playlist').html('');
    }

    treeGenerator(data) {
        const self = this;
        let array = [],
            letter;

        _forEach(data, (item, index) => {
            if (item) {
                // let iconTpl = `<span class="icon icon-code"></span>`;
                let isChildAvailable =
                    item.child && item.child.length > 0 ? true : false;
                // let playlistClass = "";
                // if(!isChildAvailable) {
                //   playlistClass = "play-list";
                // }
                let playTooltip = 'Click to play/pause song';
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

                let shareParentInnerHTML = '';
                if (item.id !== SPOTIFY_LIKED_SONGS_PLAYLIST_ID) {
                    shareParentInnerHTML = `<span class='playlist-control' title='
                    ${shareTooltip}
                '><img width='11' height='11' class='share-playlist' node-text='${item.name}' title='share ${item.name}' id='share-image-${item.id}' node-id='${item.id}' src='${SHARE_ICON}'/>
                </span>`;
                }

                if (item.type == 'playlist') {
                    entry = `<li node-id="${
                        item.id
                    }" class="playlist-li list-nested-item expanded list-item play-list ${arrowClass}  ${isCollapsedClass}" title="${
                        item.name
                    }"> <div class="symbol-mixed-block list-tab">

                        <img width='15' height='15' src='${playlistIcon}'/>
                        <span>${utilMgr.text_truncate(item.name, 35)}</span>
                            ${shareParentInnerHTML}
                        
                        </div>
                    `;

                    if (isChildAvailable) {
                        //let childContent = self.treeGenerator(item.child);
                        entry += `<ol class="list-tree child-list-tree">`;
                        _forEach(item.child, childItem => {
                            let shareInnerHTML = `<span class='playlist-control' title='
                ${shareTooltip}
              '><img width='11' height='11' class='share-song' node-text='${childItem.name}' title='share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/>
              </span>`;
                            //if (childContent.length != 0) {
                            entry += `<li node-id="${
                                childItem.id
                            }"  class="list-item playlist-nested-item playlist-li" title="${
                                childItem.name
                            }">
                
                            <div class=" symbol-mixed-block">
                              
                                <span>${utilMgr.text_truncate(
                                    childItem.name,
                                    20
                                )}</span>
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
                if (item.type == 'sectionDivider') {
                    entry = `<li id="recomendation-section" class=""><div class="sv-toolbox block playlist-head recommend-head title-header" >
                    <span style="float: left;">RECOMMENDATIONS</span>
            
                    <div class="dropdown" id="sortDiv">
                        
                        <!-- three dots -->
                        <ul
                            class="dropbtn icons btn-right showLeft"
                            id="sortDropDown"
                            style="width: 5px;"
                        >
                            <li></li>
                            <li></li>
                            <li></li>
                        </ul>
                        <!-- menu -->
                        <div id="myDropdown" class="dropdown-content">
                            <span id="alphabetically">Sort A-Z</span>
                            <span id="sortToOriginal">Sort Latest</span>
                        </div>
            
                        
                    </div>
                    <span style="float: right;">
                        <img
                            src="${FILTER_ICON}" 
                            alt=""
                            style="cursor: pointer;"
                            id="filter-recommendation"
                        />
                        <img
                            alt=""
                            style="cursor: pointer; "
                            id="refresh-recommendation"
                            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTIiIGhlaWdodD0iMTQiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIG1lZXQiIHZpZXdCb3g9IjAgLTEyOCAxNTM2IDE3OTIiIHN0eWxlPSItbXMtdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgLXdlYmtpdC10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB2ZXJ0aWNhbC1hbGlnbjogLTAuMTQzZW07Ij48cGF0aCBkPSJNMTUxMSA5MjhxMCA1LTEgN3EtNjQgMjY4LTI2OCA0MzQuNVQ3NjQgMTUzNnEtMTQ2IDAtMjgyLjUtNTVUMjM4IDEzMjRsLTEyOSAxMjlxLTE5IDE5LTQ1IDE5dC00NS0xOXQtMTktNDVWOTYwcTAtMjYgMTktNDV0NDUtMTloNDQ4cTI2IDAgNDUgMTl0MTkgNDV0LTE5IDQ1bC0xMzcgMTM3cTcxIDY2IDE2MSAxMDJ0MTg3IDM2cTEzNCAwIDI1MC02NXQxODYtMTc5cTExLTE3IDUzLTExN3E4LTIzIDMwLTIzaDE5MnExMyAwIDIyLjUgOS41dDkuNSAyMi41em0yNS04MDB2NDQ4cTAgMjYtMTkgNDV0LTQ1IDE5aC00NDhxLTI2IDAtNDUtMTl0LTE5LTQ1dDE5LTQ1bDEzOC0xMzhROTY5IDI1NiA3NjggMjU2cS0xMzQgMC0yNTAgNjVUMzMyIDUwMHEtMTEgMTctNTMgMTE3cS04IDIzLTMwIDIzSDUwcS0xMyAwLTIyLjUtOS41VDE4IDYwOHYtN3E2NS0yNjggMjcwLTQzNC41VDc2OCAwcTE0NiAwIDI4NCA1NS41VDEyOTcgMjEybDEzMC0xMjlxMTktMTkgNDUtMTl0NDUgMTl0MTkgNDV6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg=="
                        />
                        
                    </span>
                </div></li>`;
                }
                array.push(entry);
            }
        });

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
}
