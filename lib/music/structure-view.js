'use babel';

import $ from 'jquery';
import fs from 'fs';
import path from 'path';
import _find from 'lodash/find';
import _forEach from 'lodash/forEach';

import KpmMusicStoreManager from './KpmMusicStoreManager';
import KpmMusicControlManager from './KpmMusicControlManager';

import {
    PLAY_CONTROL_ICON,
    PAUSE_CONTROL_ICON,
    SPOTIFY_ICON,
    PAW_ICON,
    DIVIDER,
    GENERATE_CUSTOM_PLAYLIST_TITLE,
    REFRESH_ICON,
    TIME_RELOAD,
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

    initialize(
        spotifyPlaylists,
        selectedPlaylistTrackId,
        devicesFound = [],
        generatePLaylistButton = {}
    ) {
        this.showLoader();
        if (spotifyPlaylists) {
            // let uniqueSpotifyPlaylist = {};
            // let res = spotifyPlaylists.filter((playlist, index) => {
            //   if(!uniqueSpotifyPlaylist[playlist.id]) {

            //   } else {
            //     uniqueSpotifyPlaylist[playlist.id] =
            //   }
            // });
            this._spotifyPlaylists = spotifyPlaylists;

            // this._spotifyPlaylists = this.getUnique(spotifyPlaylists,'id');
        }
        this._selectedPlaylistTrackId = selectedPlaylistTrackId;
        let needsSpotifyAccess = this.musicstoreMgr.requiresSpotifyAccess();

        // there's nothing to get if it's windows and they don't have
        // a premium spotify account
        let premiumAccountRequired =
            !utilMgr.isMac() && !this.musicstoreMgr.hasSpotifyPlaybackAccess()
                ? true
                : false;

        if (needsSpotifyAccess || premiumAccountRequired) {
            this.toggleDeviceStatus(true);
            this.toggleDeviceStatus(true);

            $('#tree-content').show();
            if (utilMgr.getItem('spotify_access_token')) {
                $('#spotify-status').show();
                $('#spotify-status').text('Spotify Premium required');
            }
            $('#spotify-connect').show();
            // $("#spotify-disconnect").hide();
            $('#spotify-refresh-playlist').hide();
            $('#refresh-treeview').hide();
            this.hideLoader();
        } else {
            //show connected spotify device
            this.toggleDeviceStatus(false);
            this.toggleRefreshTreeview(false);

            $('#refresh-treeview').attr('src', REFRESH_ICON);
            $('#spotify-player-device').text(devicesFound.title);
            $('#spotify-player-device').prop('title', devicesFound.tooltip);
            $('#web-analytics').show();

            $('#spotify-status').show();
            $('#spotify-connect').hide();
            $('#spotify-status').text('Spotify Connected');
            // $("#spotify-disconnect").show();
            $('#spotify-refresh-playlist').text(generatePLaylistButton.label);
            $('#spotify-refresh-playlist').show();
            this.renderTree(this._spotifyPlaylists);
        }
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('#spotify-player-device').hide();
        } else {
            $('#spotify-player-device').show();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('#refresh-treeview').hide();
        } else {
            $('#refresh-treeview').show();
        }
    }

    renderTree(spotifyPlaylists) {
        let html = this.treeGenerator(spotifyPlaylists);
        $('div.structure-view>div>ol').html(html);
        this.hideLoader();
    }

    clearTree() {
        $('div.structure-view>div>ol').html('');
    }

    // getPLaylistItem(playlistId) {
    //   const playlist = this.musicstoreMgr.getPlaylistItemTracksForPlaylistId(playlistId);
    // }

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
                let isCollapsedClass = 'collapsed';
                let playlistIcon = '';
                let arrowClass = 'play-list-angle-right';
                let playlistStatusIcon = PLAY_CONTROL_ICON;
                if (item.isSelected && isChildAvailable) {
                    isCollapsedClass = '';
                    arrowClass = 'play-list-angle-down';
                }
                if (item.isPlaying) {
                    playlistStatusIcon = PAUSE_CONTROL_ICON;
                }

                if (item.tag == 'paw') {
                    playlistIcon = PAW_ICON;
                } else if (item.tag == 'spotify') {
                    playlistIcon = SPOTIFY_ICON;
                }
                let entry = '';
                if (item.type == 'playlist') {
                    entry = `<li node-id="${
                        item.id
                    }" class="list-nested-item expanded list-item play-list ${arrowClass}  ${isCollapsedClass}" title="${
                        item.name
                    }">
            
            <div class="symbol-mixed-block list-tab">

              <img width='15' height='15' src='${playlistIcon}'/>
              <span>${utilMgr.text_truncate(item.name, 35)}</span>
          
               
            </div>
          `;

                    if (isChildAvailable) {
                        //let childContent = self.treeGenerator(item.child);
                        entry += `<ol class="list-tree child-list-tree">`;
                        _forEach(item.child, childItem => {
                            // if(this._selectedPlaylistTrackId == childItem.id) {

                            // }

                            // if (childItem.state === 'playing') {
                            //     playlistStatusIcon = PAUSE_CONTROL_ICON;
                            // } else {
                            //     playlistStatusIcon = PLAY_CONTROL_ICON;
                            // }
                            let innerHTML = `<span class='playlist-control' title='
                ${playTooltip}
              '><img width='11' height='11' id='play-image-${childItem.id}' src='${PLAY_CONTROL_ICON}'/>
              </span>`;
                            //if (childContent.length != 0) {
                            entry += `<li node-id="${
                                childItem.id
                            }"  class="list-item playlist-nested-item" title="${
                                childItem.name
                            }">
                
                            <div class=" symbol-mixed-block">
                              
                                <span>${utilMgr.text_truncate(
                                    childItem.name,
                                    20
                                )}</span>
                                ${innerHTML}
                            </div>
                        </li>`;
                        });
                        entry += `</ol>`;
                    }
                    entry += `</li>`;
                } else if (item.type == 'divider' && index > 0) {
                    entry = `<li>&nbsp;&nbsp;<span class='' 
          '><img width='11' height='11' class='divider' src='${DIVIDER}'/>
          </span> </li>`;
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
