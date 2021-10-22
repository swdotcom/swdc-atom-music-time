'use babel';

import { CompositeDisposable } from 'atom';
import StructureView from './music/structure-view';
import { getStatusView } from './managers/StatusViewManager';
import KpmMusicManager from './music/KpmMusicManager';
import KpmMusicControlManager from './music/KpmMusicControlManager';
import { softwarePost } from './client/HttpClient';
import { migrateAccessInfo, initializeSpotify } from './managers/SpotifyManager';
import { clearWebsocketConnectionRetryTimeout, initializeWebsockets } from './websockets';

const serviceUtil = require('./utils/ServiceUtil');
const utilMgr = require('./managers/UtilManager');
const treeViewManager = require("./music/TreeViewManager");
const commandMgr = require('./managers/CommandManager');
const fileUtil = require('./utils/FileUtil');
const tracker = require('./managers/TrackerManager');

let musicMgr = null;
let musicControlMgr = null;
let packageVersion = null;
let activated = false;
let structureViewObj;

export default {
    subscriptions: null,

    async activate(state, tries = 0) {
      let jwt = fileUtil.getItem("jwt");
      if (!jwt) {
        // create an anon user
        jwt = await serviceUtil.createAnonymousUser();
        if (!jwt) {
          if (tries === 0) {
            const isOnline = await serviceUtil.serverIsAvailable();
            if (!isOnline) {
              utilMgr.showOfflinePrompt();
            }
          }
          if (tries < 5) {
            setTimeout(() => {this.activate(state, tries);}, 1000 * 6);
            return;
          }
        } else {
          this.initializePlugin(state, true);
        }
      }
      this.initializePlugin(state, false);
    },

    async initializePlugin(state, initializedUser) {
        if (activated) {
            return;
        }

        activated = true;

        // INITIALIZE the tree view
        structureViewObj = StructureView.getInstance();
        // this HAS to be done before initializing kpm music mgr
        treeViewManager.setStructureView(structureViewObj);
        // pre-initialize
        structureViewObj.preInitialize();

        // INITIALIZE the KPM Music Manager (has music control and gather music)
        if (!musicMgr) {
            musicMgr = KpmMusicManager.getInstance();
        }

        // INIITIALIZE the status bar
        getStatusView();

        // INITALIZE the music controller (play/pause controls)
        if (!musicControlMgr) {
            musicControlMgr = KpmMusicControlManager.getInstance();
        }

        // initialize the tracker manager
        await tracker.init();

        // store the activate event
        tracker.trackEditorAction('editor', 'activate');

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        packageVersion = atom.packages.getLoadedPackage('music-time').metadata.version;
        console.log(`Music Time: Loaded v${packageVersion}`);

        // ADD all of the subscription commands
        commandMgr.addCommands(this.subscriptions);

        // migrate legacy spotify access token info to integration info
        await migrateAccessInfo();

        await initializeSpotify();

        setTimeout(() => {
            musicMgr.fetchTrack();
        }, 60000);

        const atom_musictime_initialized = fileUtil.getItem('atom_MtReadme');
        if (!atom_musictime_initialized) {
            commandMgr.toggleTreeView();

            // send the show readme command
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:musictime-learn-more'
            );

            // initialize the plugin
            softwarePost("/plugins/activate", {}, fileUtil.getItem("jwt"));
        }

        setTimeout(() => {
          commandMgr.buildMenu();
        }, 5000);

        try {
            initializeWebsockets();
        } catch (e) {
            console.log(`error initializing webscockets: ${e.message}`);
            console.error('[MusicTime] failed to initialize websockets', e);
        }
    },

    deactivate() {
        tracker.trackEditorAction('editor', 'deactivate');

        clearWebsocketConnectionRetryTimeout();

        if (getStatusView()) {
            getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },
};
