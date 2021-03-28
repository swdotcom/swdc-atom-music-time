'use babel';

import KpmMusicControlManager from '../music/KpmMusicControlManager';
import KpmMusicManager from '../music/KpmMusicManager';
import StructureView from '../music/structure-view';
import { getStatusView } from "./StatusViewManager";
import { PlayerName } from 'cody-music';
import { connectSpotify, disconnectSpotify } from './SpotifyManager';
import $ from 'jquery';
import {
    showGenreSelections,
    showCategorySelections,
} from '../music/RecTypeSelectorManager';
import { showSearchInput } from '../music/SearchSelectorManager';
import { showDeviceSelectorMenu } from '../music/KpmMusicControlManager';
import { disconnectSlackWorkspace, connectSlackWorkspace } from "./SlackManager";
import {
  initiateSignupFlow,
  initiateLoginFlow} from "../utils/PopupUtil";
import {
    GITHUB_ISSUE_URL,
    FEEDBACK_URL,
    CONNECT_SPOTIFY_MENU_LABEL } from '../Constants';

const utilMgr = require('./UtilManager');
const deviceMgr = require('../music/DeviceManager');

const commandMgr = {};

let showPlaylist = false;

commandMgr.addCommands = async subscriptions => {
    const musicControlMgr = KpmMusicControlManager.getInstance();
    const musicMgr = KpmMusicManager.getInstance();
    const structureViewObj = musicMgr.structureViewObj;

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:connect-spotify': () => connectSpotify(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:disconnect-spotify': () =>
                disconnectSpotify(),
        })
    );

    subscriptions.add(
      atom.commands.add('atom-workspace', {
          'Music-Time:disconnect-slack': () => disconnectSlackWorkspace(),
      })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:generateUsersWeeklyTopSongs': () =>
                musicMgr.generateUsersWeeklyTopSongs(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:createNewPlaylist': () => {
                let newPlaylistName = localStorage.getItem('newPlaylistName');
                musicControlMgr.createNewPlaylist(newPlaylistName);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:software-top-40': () =>
                utilMgr.launchSoftwareTopForty(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:web-dashboard': () =>
                musicControlMgr.displayMusicTimeMetricsMarkdownDashboard(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refreshSongStatus': () =>
              musicMgr.fetchTrack(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:launchTrackPlayer': () => deviceMgr.launchTrackPlayer(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:pause': () => musicControlMgr.pause(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:play': () => musicControlMgr.play(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:next': () => musicControlMgr.next(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:previous': () => musicControlMgr.previous(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'musictime.generateGlobalPlaylist': () =>
                musicMgr.createOrRefreshGlobalTopSongsPlaylist(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:clearFooterStatus': () =>
                getStatusView().clearStatus(),
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:clearTreeView': () => structureViewObj.clearTree(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:toggle-music-tree': () => commandMgr.toggleTreeView(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:launchAnalytics': () => utilMgr.launchMusicAnalytics(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:musictime-learn-more': () => {
                utilMgr.displayReadmeIfNotExists(true /*override*/);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:toggle-playlist': () => musicMgr.togglePlaylist(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:play-playlist-song': () => musicMgr.playPlaylistSong(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:play-recommend-song': () => musicMgr.playPlaylistSong(),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refresh-treeview': async () => {
                musicMgr.clearSavedPlaylists();
                await musicMgr.refreshPlaylists(true);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refresh-account': async () => {
                await musicMgr.refreshPlaylists(false);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:song-search': async () => {
                showSearchInput();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refresh-recommend-treeview': async () => {
                await musicMgr.refreshRecommendations();
                const structureViewObj = StructureView.getInstance();
                structureViewObj.refreshTreeView();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:update-recommend-treeview': async () => {
                const structureViewObj = StructureView.getInstance();
                structureViewObj.refreshTreeView();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refresh-search-songs-treeview': async () => {
                musicMgr.updateSearchedSongsRecommendations();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:sortAlphabetically': async () => {
                musicMgr.updateSort(true);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:sortToOriginal': async () => {
                musicMgr.updateSort(false);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:like': async () => {
                musicControlMgr.setLiked(true);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:unlike': async () => {
                musicControlMgr.setLiked(false);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:share-track': async () => {
                musicControlMgr.shareSong();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:recommendation-for-track': async () => {
              const trackId = localStorage.getItem(
                  '_selectedRecommendPlaylistTrackId'
              );
              const trackName = localStorage.getItem(
                  '_selectedRecommendPlaylistTrackName'
              );
              musicMgr.fetchAndPopulateRecommendations([trackId], trackName);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refreshRecommendationsTree': async () => {
                musicMgr.refreshRecommendations();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:showGenreSelections': () => {
                showGenreSelections();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:showCategorySelections': () => {
                showCategorySelections();
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:addToPlaylist': () => {
                musicControlMgr.addToPlaylistMenu();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:connectDevice': () => {
                showDeviceSelectorMenu();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:launchSpotifyDesktop': () => {
                deviceMgr.launchTrackPlayer(PlayerName.SpotifyDesktop);
            },
        })
    );
    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:launchSpotify': () => {
                deviceMgr.launchTrackPlayer(PlayerName.SpotifyWeb);
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:refreshDeviceInfo': () => {
                musicControlMgr.refreshDeviceInfo();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:removeSong': () => {
                musicControlMgr.removeSong();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:submit-issue': () =>
                utilMgr.launchWebUrl(GITHUB_ISSUE_URL),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:submit-feedback': () =>
                utilMgr.launchWebUrl(FEEDBACK_URL),
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:connect-slack': () => connectSlackWorkspace(),
        })
    );

    subscriptions.add(
      atom.commands.add("atom-workspace", {
        "Music-Time:toggle-slack-workspaces": event => {
          structureViewObj.toggleSlackWorkspaceTree();
        }
      })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:sign-up': () => {
                initiateSignupFlow();
            },
        })
    );

    subscriptions.add(
        atom.commands.add('atom-workspace', {
            'Music-Time:log-in': () => {
                initiateLoginFlow();
            },
        })
    );
};

commandMgr.toggleTreeView = () => {
    const dock = atom.workspace.getLeftDock();

    showPlaylist = !showPlaylist ? true : false;

    structureViewObj = StructureView.getInstance();
    structureViewObj['name'] = 'MusicTimePlaylist';

    // force redraw
    $('ul.list-inline.tab-bar.inset-panel').height();

    const panes = dock.getPanes();
    if (panes.length) {
        if (!showPlaylist) {
            // check to see if the playlist was removed, if so
            // we'll show it instead
            const foundMusicTimePlaylist = panes[0].items.find(
                n => n.name && n.name === 'MusicTimePlaylist'
            );
            if (!foundMusicTimePlaylist) {
                showPlaylist = true;
            }
        }
    }

    if (showPlaylist) {
        try {
            // add these first for performance
            dock.getPanes()[0].addItem(structureViewObj);
            dock.getPanes()[0].activateItem(structureViewObj);
        } catch (e) {
            //
        }
        dock.show();

        // refresh the view
        structureViewObj.refreshTreeView();
    } else {
        dock.getPanes()[0].removeItem(structureViewObj);
    }
};

commandMgr.buildMenu = () => {
  let submenu = utilMgr.getCodeTimeSubmenu();
  let menu = utilMgr.getCodeTimeMenu();

  submenu.push({
      label: CONNECT_SPOTIFY_MENU_LABEL,
      command: 'Music-Time:connect-spotify',
  });

  utilMgr.updateMusicTimeSubmenu(submenu);
  menu.push({
      label: 'Packages',
      submenu: [
          {
              label: 'Music Time',
              submenu: submenu,
          },
      ],
  });

  // this needs to happen first to enable spotify playlist and control logic
  utilMgr.updateMusicTimeMenu(menu);
  utilMgr.updateLoginPreference(false);

  atom.menu.add(menu);
  atom.menu.update();
};

module.exports = commandMgr;
