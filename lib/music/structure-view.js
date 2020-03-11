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
} from '../Constants';

const utilMgr = require('../UtilManager');

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

$(document).on('click', '#web-analytics', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:launchAnalytics'
    );
});
$(document).on('click', '#spotify-player-device', function() {
    let deviceCount = $(this).attr('device-count')
    if(!deviceCount || deviceCount == 0) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connectDevice'
        );
    }
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
    showLoader(isRecommendTree) {
        if(!isRecommendTree) {

            $('#tree-content').hide();
            $('#loader').show();
        }
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
        generatePLaylistButton = {},
        recommendPlaylists = [],
        isRecommendTree
    ) {
        this.showLoader(isRecommendTree);
        if (spotifyPlaylists) {
            this._spotifyPlaylists = spotifyPlaylists;
        }
        if (recommendPlaylists) {
            this._recommendPlaylists = recommendPlaylists;
        }
        this._selectedPlaylistTrackId = selectedPlaylistTrackId;
        let needsSpotifyAccess = this.musicstoreMgr.requiresSpotifyAccess();

        // this.musicstoreMgr.spotifyUser = await getUserProfile();
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
            this.toggleRecommendHeadview(true);
            this.toggleRecommendTreeview(true);
            this.toggleRefreshRecommendation(true);
            this.hideLoader();
            this.toggleWebAnalytics(true);
        } else {
            //show connected spotify device
            if(isRecommendTree) {
                
                this.renderRecommendTree(this._recommendPlaylists);
            } else {
                this.renderTree(this._spotifyPlaylists);
            }
            this.toggleDeviceStatus(false);
            this.toggleRefreshTreeview(false);
            this.toggleRecommendHeadview(false);
            this.toggleRecommendTreeview(false);
            this.toggleRefreshRecommendation(false);
            this.toggleSortDev(false);
            this.toggleLikeButton(false);
            $('#refresh-treeview').attr('src', REFRESH_ICON);
            $('#refresh-recommendation').attr('src', REFRESH_ICON);
            
            

            this.toggleWebAnalytics(false);

            $('#spotify-status').show();
            this.toggleConnectSpotify(true);
            $('#spotify-status').text('Spotify Connected');
            // $("#spotify-disconnect").show();
            $('#spotify-refresh-playlist').text(generatePLaylistButton.label);
            $('#spotify-refresh-playlist').show();
        }
    }

    updateDevice(devicesFound) {
        $('#spotify-player-device').text(devicesFound.title);
        $('#spotify-player-device').prop('title', devicesFound.tooltip);
        $('#spotify-player-device').prop('device-count', devicesFound.deviceCount);
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

    toggleWebAnalytics(isHide) {
        if (isHide) {
            $('#web-analytics').hide();
        } else {
            $('#web-analytics').show();
        }
    }

    renderTree(spotifyPlaylists) {
        let html = this.treeGenerator(spotifyPlaylists);
        $('#tree-playlist').html(html);
        this.hideLoader();
    }
    renderRecommendTree(recommendPlaylists) {
        let html = this.recommendTreeGenerator(recommendPlaylists);
        $('#tree-recommend-playlist').html(html);
    }

    clearTree() {
        $('div.structure-view-music-time>div>ol#tree-playlist').html('');
    }

    treeGenerator(data) {
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
                    shareParentInnerHTML = `<span class='playlist-control' title='
                    ${shareTooltip}
                '><img width='11' height='11' class='share-playlist share-parent-icon' node-text='${item.name}' title='share ${item.name}' id='share-image-${item.id}' node-id='${item.id}' src='${SHARE_ICON}'/>
                </span>`;
                }

                if (item.type == 'playlist') {
                    entry = `<li node-id="${
                        item.id
                    }" class="playlist-parent-li list-nested-item expanded list-item play-list ${arrowClass}  ${isCollapsedClass}" title="${
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
              '><img width='11' height='11' class='share-song share-icon' node-text='${childItem.name}' title='share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/>
              </span>`;
                            let addSongInnerHTML = `<span class='playlist-control' title='
              ${addTooltip}
            '><img class='add-song share-icon' node-parent-id='${item.id}' title='add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/>
            </span>`;

                            ADD_ICON;

                            let trackIcon = `<img src='${TRACK_ICON}'  >`;
                            //if (childContent.length != 0) {
                            entry += `<li node-id="${
                                childItem.id
                            }"  class="list-item playlist-nested-item playlist-li tracks-li" title="${
                                childItem.name
                            }">
                           
                            <div class=" symbol-mixed-block">
                            ${trackIcon}
                                <span>${utilMgr.text_truncate(
                                    childItem.name,
                                    20
                                )}</span>
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
        });

        return array.join('');
    }

    recommendTreeGenerator(item) {
        let songItem = [];
        let array = [];
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
                    }"> <div class="symbol-mixed-block list-tab">

                        <img width='15' height='15' src='${playlistIcon}'/>
                        <span>${utilMgr.text_truncate(item.name, 35)}</span>
                            ${shareParentInnerHTML}
                        
                        </div>
                    `;

                if (isChildAvailable) {
                    //let childContent = self.treeGenerator(item.child);
                    let trackIcon = `<img src='${TRACK_ICON}'  >`;

                    entry += `<ol class="list-tree child-list-tree">`;
                    _forEach(item.childs, childItem => {
                        let shareInnerHTML = `<span class='playlist-control' title='
                ${shareTooltip}
              '><img width='11' height='11' class='share-song share-icon' node-text='${childItem.name}' title='share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/>
              </span>`;
                        let addSongInnerHTML = `<span class='playlist-control' title='
              ${addTooltip}
            '><img class='add-song share-icon' node-parent-id='${item.id}' title='add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/>
            </span>`;
                        //if (childContent.length != 0) {
                        entry += `<li node-id="${
                            childItem.id
                        }"  class="list-item playlist-recommend-item playlist-li " title="${
                            childItem.name
                        }">
                           
                            <div class=" symbol-mixed-block">
                            ${trackIcon}
                                <span>${utilMgr.text_truncate(
                                    childItem.name,
                                    20
                                )}</span>
                                
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
}
