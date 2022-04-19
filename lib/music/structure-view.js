'use babel';

import $ from 'jquery';
import path from 'path';
import KpmMusicControlManager from './KpmMusicControlManager';
import { MusicDataManager } from "./MusicDataManager";
import {
    ADD_ICON,
    PLAYLIST_ICON_GREEN,
    TRACK_ICON_DARK,
    SPOTIFY_ICON,
    PAW_ICON,
    DIVIDER,
    LIKE_ICON,
    REFRESH_ICON,
    SHARE_ICON,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    REMOVE_ICON,
    RECOMMEND_ICON,
    SLACK_ICON
} from '../Constants';

const {getSlackWorkspaces} = require("../managers/SlackManager");
const {getCachedSpotifyIntegration, requiresSpotifyAccess} = require("../managers/SpotifyManager");
const fileIt = require("file-it");
const deviceMgr = require("./DeviceManager");
const fileUtil = require('../utils/FileUtil');
const stringUtil = require("../utils/StringUtil");

let checkedMap = {};

$(document).on('click', '#spotify-refresh-playlist', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:generateUsersWeeklyTopSongs'
    );
});

$(document).on('click', 'ul#sortDropDown', function() {
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', '#addToPlaylist', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:addToPlaylist'
    );
});

$(document).on('click', 'span#alphabetically', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:sortAlphabetically'
    );
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', 'span#sortToOriginal', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:sortToOriginal'
    );
    $('#myDropdown').toggleClass('show');
});

$(document).on('click', 'img#category-recommendation', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:showCategorySelections'
    );
});

$(document).on('click', 'img#genre-recommendation', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:showGenreSelections'
    );
});

$(document).on('click', 'a#spotify-connect', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:connect-spotify'
    );
});

$(document).on('click', 'a#musictime-learn-more', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:musictime-learn-more'
    );
});

$(document).on('click', 'a#musictime-web-analytics', function() {
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:launchAnalytics'
    );
});

$(document).on('click', 'a#spotify-player-device', function() {
    let deviceCount = $(this).attr('device-count');
    if (!deviceCount || deviceCount == 0) {
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:connectDevice'
        );
    }
});

$(document).on('click', 'li.slack-workspaces-list', el => {
  event.stopPropagation();
  if (!el.currentTarget) {
      return;
  }

  if (checkedMap[el.currentTarget.id]) {
    checkedMap[el.currentTarget.id] = null;
  } else {
    checkedMap[el.currentTarget.id] = el.currentTarget.id;
  }

  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:toggle-slack-workspaces'
  );
});

$(document).on('click', 'a#add-workspace-button', el => {
  // call the add workspace action
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:connect-slack"
  );
});

$(document).on('click', 'img#remove-slack-workspace', el => {
  // call the remove workspace action
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    "Music-Time:disconnect-slack"
  );
});

$(document).on('click', 'a#signup-button', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:sign-up',
      "click"
  );
});

$(document).on('click', 'a#login-button', () => {
  atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:log-in',
      "click"
  );
});

export default class StructureView {
    constructor() {
        this.musicControlMgr = KpmMusicControlManager.getInstance();

        const filename = path.join(__dirname, '../..', 'templates', 'structure-view.html');
        const htmlString = fileIt.readContentFileSync(filename);
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
        $('div#loaderdiv span').text('Loading...');
        $('div#loaderdiv').show();
    }

    hideLoader() {
        $('div#tree-content').show();
        $('div#loaderdiv').hide();
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

    initialize() {
      this.buildTree();
    }

    refreshTreeView() {
      this.buildTree();
    }

    async buildTree() {
        const requireAccess = await requiresSpotifyAccess();

        const dataMgr = MusicDataManager.getInstance();

        this._myRecommendations = dataMgr.recommendationPlaylist;
        this._myPlaylists = dataMgr.spotifyPlaylists;

        const hasPlaylistData = this._myPlaylists && this._myPlaylists.length ? true : false;

        if (requireAccess) {
            await this.showDisconnectedTree();
        } else if (hasPlaylistData) {
            await this.showConnectedTree();
        } else {
            await this.preInitialize();
        }

        await this.toggleSlackWorkspaceTree();

        this.updateDevice();
    }

    async toggleSlackWorkspaceTree() {
      $('#slack-workspaces-tree').html(await this.buildSlackWorkspacesNode());
    }

    async preInitialize() {
        this.showLoader();

        this.toggleRegistrationButtons();
        await this.toggleConnectSpotify();

        $('a#musictime-learn-more').show();
    }

    async showConnectedTree() {
        this.showLoader();

        await this.renderTree();

        $('img#refresh-treeview').attr('src', REFRESH_ICON);

        this.toggleRegistrationButtons();

        // false means to show it
        this.toggleDeviceStatus(false);
        await this.togglerMenuDivider(false);
        $('a#musictime-learn-more').show();

        this.toggleRefreshTreeview(false);
        this.toggleSearchTreeview(false);
        this.toggleSortDev(false);
        this.toggleLikeButton(false);

        $('#spotify-refresh-playlist').show();

        // true means to hide it
        await this.toggleConnectSpotify();
        $('a#spotify-status').hide();

        this.renderRecommendTree();

        this.hideLoader();
    }

    async showDisconnectedTree() {
        this.showLoader();

        this.renderRecommendTree();
        await this.renderTree();

        this.toggleRegistrationButtons();

        // false means to show it

        $('a#musictime-learn-more').show();
        $('#spotify-refresh-playlist').hide();

        await this.toggleConnectSpotify();

        // true means to hide it
        this.toggleDeviceStatus(true);
        this.togglerMenuDivider(true);

        this.toggleRefreshTreeview(true);
        this.toggleSearchTreeview(true);
        $('div#tree-content').show();

        this.hideLoader();
    }

    async updateDevice() {
        const devicesFound = await deviceMgr.getActiveSpotifyDevicesButton()
        $('a#spotify-player-device').text(devicesFound.title);
        $('a#spotify-player-device').prop('title', devicesFound.tooltip);
        $('a#spotify-player-device').prop(
            'device-count',
            devicesFound.deviceCount
        );
    }

    toggleDeviceStatus(isHide) {
        if (isHide) {
            $('a#spotify-player-device').hide();
        } else {
            $('a#spotify-player-device').show();
        }
    }

    async togglerMenuDivider(isHide) {
        const requiresAccess = await requiresSpotifyAccess();

        if (requiresAccess) {
            $('img#menu-divider').hide();
        } else {
            $('img#menu-divider').show();
        }
    }

    toggleRefreshTreeview(isHide) {
        if (isHide) {
            $('img#refresh-treeview').hide();
        } else {
            $('img#refresh-treeview').show();
        }
    }

    toggleSearchTreeview(isHide) {
        if (isHide) {
            $('img#song-search').hide();
        } else {
            $('img#song-search').show();
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

    toggleSortDev(isHide) {
        if (isHide) {
            $('div#sortDiv').hide();
        } else {
            $('div#sortDiv').show();
        }
    }

    toggleRegistrationButtons() {
      if (fileUtil.getItem("name")) {
        $('a#logged-in-label').html(this.buildLoggedInNode()).show();
        $('a#signup-button').hide();
        $('a#login-button').hide();
        $('a#musictime-web-analytics').show();
      } else {
        $('a#logged-in-label').hide();
        $('a#signup-button').show();
        $('a#login-button').show();
        $('a#musictime-web-analytics').hide();
      }
    }

    buildLoggedInNode() {
      const labelInfo = this.getAuthTypeLabelAndClass();
      const id = "logged-in-menu-input";
      return `<span class="${labelInfo.class}" id="${id}">${labelInfo.label}</span>`
    }

    getAuthTypeLabelAndClass() {
        const authType = fileUtil.getItem('authType');
        const name = fileUtil.getItem("name");
        const label = `${name}`;
        if (authType === 'google') {
            return { label, class: 'google-icon' };
        } else if (authType === 'github') {
            return { label, class: 'github-icon' };
        } else if (authType === 'software') {
            return { label, class: 'email-icon' };
        }
        return { label, class: 'email-icon' };
    }

    async toggleConnectSpotify() {
        const spotifyIntegration = await getCachedSpotifyIntegration();

        if (spotifyIntegration) {
            $('a#spotify-connect').hide();
        } else {
            $('a#spotify-connect').text("Connect Spotify");
            $('a#spotify-connect').show();
        }
        await this.toggleRecommendationView();
    }

    async toggleRecommendationView() {
      const requiresAccess = await requiresSpotifyAccess();
      if (requiresAccess) {
        $('div#musictime-recommend-head-bar').hide();
      } else {
        $('div#musictime-recommend-head-bar').show();
      }
    }

    async renderTree() {
        let html = await this.treeGenerator();
        $('ol#tree-playlist').html(html);
        this.hideLoader();
    }

    renderRecommendTree() {
        let html = this.recommendTreeGenerator();
        $('ol#musictime-tree-recommend-playlist').html(html);
    }

    clearTree() {
        // clear the playlist and recommendations
        const dataMgr = MusicDataManager.getInstance();
        dataMgr.spotifyPlaylists = [];
        dataMgr.recommendationPlaylist = {};
        $('div.structure-view-music-time>div>ol#tree-playlist').html('');
        this.refreshTreeView();
    }

    async buildSlackWorkspacesNode() {
      const workspaces = await getSlackWorkspaces();

      const id = "slack-workspaces-folder";
      const label = "Slack workspaces";
      let isCollapsedClass = "collapsed";
      let arrowClass = "play-list-angle-right";

      if (!!(checkedMap[id])) {
        isCollapsedClass = "";
        arrowClass = "play-list-angle-down";
      }

      // build the workspace list
      let workspaceHtml = "";
      if (workspaces.length) {
        workspaces.forEach(workspace => {
          let team_name = workspace.meta && workspace.meta.team ? workspace.meta.team.name || "Slack" : "Slack";
          workspaceHtml += `<li class="workspace-node-item list-item playlist-nested-item slack-workspace-item tracks-li">
            <div class="workspace-node">
            <span style="margin-left: 8px;">${team_name} <span class="artist-label">(${team_name})</span></span>
            </div>
            </li>\n`
        });
      }

      const addIconHref = `<a href="#" id="add-workspace-button" class="add-icon">Add workspace</a>`;

      workspaceHtml += `<li class="workspace-node-item list-item playlist-nested-item slack-workspace-item tracks-li">
        <div class="symbol-mixed-block" style="margin-left: 8px;">${addIconHref}</div>
        </li>`;

      return `
        <li class="playlist-parent-li list-nested-item expanded list-item slack-workspaces-list ${arrowClass} ${isCollapsedClass}" id="slack-workspaces-folder">
          <div class="symbol-mixed-block list-tab" style="margin-left: 8px; width: 100%; min-width: 210px;">
            <img width='16' heigh='16' src='${SLACK_ICON}' style="margin-right: 2px">
            <span>${label}</span>
            <span class='playlist-control'><img class='share-parent-icon' title='Remove workspace' id='remove-slack-workspace' src='${REMOVE_ICON}'/></span>
          </div>
          <ol class="list-tree child-list-tree">
            ${workspaceHtml}
          </ol>
        </li>`;
    }

    async treeGenerator() {
        let array = [];

        if (!this._myPlaylists || this._myPlaylists.length === 0) {
            return;
        }

        const requiresAccess = await requiresSpotifyAccess();

        this._myPlaylists.forEach((item, index) => {
            if (item) {
                let isChildAvailable = item.child && item.child.length > 0 ? true : false;

                let shareTooltip = 'Share a song';
                let addTooltip = 'Add a song to playlist';
                let isCollapsedClass = 'collapsed';
                let playlistIcon = '';
                let arrowClass = 'play-list-angle-right';
                // let SHARE_ICON = SHARE_ICON;
                this._selectedPlaylistId = localStorage.getItem('_selectedPlaylistId');
                if (this._selectedPlaylistId && item.id === this._selectedPlaylistId && isChildAvailable) {
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
                    entry = `<li node-id="${item.id}" class="playlist-parent-li list-nested-item expanded list-item play-list ${arrowClass} ${isCollapsedClass}" title="${item.name}"> <div class="symbol-mixed-block list-tab" style="margin-left: 8px; width: 100%; min-width: 210px;">
                        <img width='15' height='15' src='${playlistIcon}'
                        style="margin-right: 2px" />
                        <span>${stringUtil.text_truncate(item.name, 30)}</span>${shareParentInnerHTML}</div>`;

                    if (isChildAvailable) {
                        entry += `<ol class="list-tree child-list-tree">`;
                        item.child.forEach(childItem => {
                          let recommendIcon = `<span class='playlist-control' title='${shareTooltip}'><img class='recommend-song share-icon' node-text='${childItem.name}' title='Recommendations for ${childItem.name}' id='track-recommend-${childItem.id}' node-id='${childItem.id}' src='${RECOMMEND_ICON}'/></span>`;
                          let shareIcon = `<span class='playlist-control' title='${shareTooltip}'><img class='share-song share-icon' node-text='${childItem.name}' title='Share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/></span>`;
                          let addSongIcon = `<span class='playlist-control' title='${addTooltip}'><img class='add-song share-icon' node-parent-id='${item.id}' title='Add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/></span>`;

                          let trackIcon = `<img src='${TRACK_ICON_DARK}' style='margin-right: 2px;' >`;

                          let removeSongIcon = '';
                          if (item.itemType === "playlist") {
                              removeSongIcon = `<span class='playlist-control' title='Remove ${childItem.name}'><img class='remove-song share-icon' node-parent-id='${item.id}' title='Remove ${childItem.name}' id='remove-image-${childItem.id}' node-id='${childItem.id}' src='${REMOVE_ICON}'/></span>`;
                          }

                          if (childItem.itemType === 'empty') {
                            recommendIcon = '';
                            shareIcon = '';
                            addSongIcon = '';
                            trackIcon = '';
                            removeSongIcon = '';
                          }

                          const artist = this.getArtist(childItem);

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
                              ${recommendIcon}
                              ${removeSongIcon}
                              ${addSongIcon}
                              ${shareIcon}

                          </div>
                      </li>`;
                      });
                      entry += `</ol>`;
                    }
                    entry += `</li>`;
                }

                if (!requiresAccess && item.type == 'divider' && index > 0) {
                    entry = `<li>&nbsp;&nbsp;&nbsp;&nbsp;<span><img width='11' height='11' class='divider' src='${DIVIDER}'/></span></li>`;
                }

                array.push(entry);
            }
        });

        return array.join('');
    }

    recommendTreeGenerator() {
        let array = [];

        const item = this._myRecommendations;

        if (item) {
            // let iconTpl = `<span class="icon icon-code"></span>`;
            let isChildAvailable = item.childs && item.childs.length > 0 ? true : false;

            let shareTooltip = 'Share a song';
            let playlistIcon = '';

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
                    let trackIcon = `<img src='${TRACK_ICON_DARK}'  >`;

                    entry += `<ol class="list-tree child-list-tree">`;
                    item.childs.forEach(childItem => {
                        let recommendIcon = `<span class='playlist-control' title='${shareTooltip}'><img class='recommend-song share-icon' node-text='${childItem.name}' title='Recommendations for ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${RECOMMEND_ICON}'/></span>`;
                        let shareInnerHTML = `<span class='playlist-control' title='${shareTooltip}'><img class='share-song share-icon' node-text='${childItem.name}' title='Share ${childItem.name}' id='share-image-${childItem.id}' node-id='${childItem.id}' src='${SHARE_ICON}'/></span>`;
                        let addSongInnerHTML = `<span class='playlist-control' title='${addTooltip}'><img class='add-song share-icon' node-parent-id='${item.id}' title='Add ${childItem.name}' id='add-image-${childItem.id}' node-id='${childItem.id}' src='${ADD_ICON}'/></span>`;

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
                                ${recommendIcon}
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
