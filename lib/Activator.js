'use babel';

import { CompositeDisposable } from 'atom';
import StructureView from './music/structure-view';
import KpmMusicTimeStatusView from './music/KpmMusicTimeStatusView';
import KpmMusicManager from './music/KpmMusicManager';
import KpmMusicControlManager from './music/KpmMusicControlManager';
import { CONNECT_SPOTIFY_MENU_LABEL, DEFAULT_CURRENTLY_PLAYING_TRACK_CHECK_SECONDS } from './Constants';

const utilMgr = require('./managers/UtilManager');
const spotifyClient = require("./music/SpotifyClient");
const treeViewManager = require("./music/TreeViewManager");
const slackMgr = require('./managers/SlackControlManager');
const commandMgr = require('./managers/CommandManager');
const fileUtil = require('./utils/FileUtil');
const kpmMgr = require("./managers/KpmManager");
const payloadMgr = require("./managers/PayloadManager");
const tracker = require('./managers/TrackerManager');

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

let musicMgr = null;
let musicControlMgr = null;
let packageVersion = null;
let activated = false;
let musicTimeStatusView;
let structureViewObj;

const one_min = 1000 * 60;

export default {
    subscriptions: null,
    sendDataInterval: null,
    deviceCheckInterval: null,

    async activate(state) {
        this.checkAnonCreation(state);
    },

    async checkAnonCreation(state, tries = 4) {
        if (!utilMgr.jwtExists()) {
            if (tries === 0) {
                // create the anon user
                result = await utilMgr.createAnonymousUser();
                if (!result) {
                    const serverAvail = await utilMgr.serverIsAvailable();
                    if (!serverAvail) {
                        utilMgr.showOfflinePrompt();
                    }
                }
                this.initializePlugin(state, true);
            } else {
                // check to see if the anon user exists in case
                // in case another window has created it
                tries--;
                setTimeout(() => {
                    this.checkAnonCreation(state, tries);
                }, 1000);
            }
        } else {
            this.initializePlugin(state, false);
        }
    },

    async initializePlugin(state, initializedUser) {
        if (activated) {
            return;
        }

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
        if (!musicTimeStatusView) {
            musicTimeStatusView = new KpmMusicTimeStatusView();
        }

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

        let submenu = utilMgr.getCodeTimeSubmenu();
        let menu = utilMgr.getCodeTimeMenu();

        packageVersion = atom.packages.getLoadedPackage('music-time').metadata.version;
        console.log(`Music Time: Loaded v${packageVersion}`);

        // ADD all of the subscription commands
        commandMgr.addCommands(this.subscriptions);

        submenu.push({
            label: CONNECT_SPOTIFY_MENU_LABEL,
            command: 'Music-Time:connectSpotify',
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

        const displayedReadme = fileUtil.getItem('atom_MtReadme');
        if (!displayedReadme) {
            commandMgr.toggleTreeView();

            // send the show readme command
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:musictime-learn-more'
            );
        }

        // this needs to happen first to enable spotify playlist and control logic
        utilMgr.updateMusicTimeMenu(menu);
        utilMgr.updateLoginPreference(false);

        atom.menu.add(menu);
        atom.menu.update();

        if (!utilMgr.isCodetimeInstalled()) {
          // intialize the editor event handling
          kpmMgr.activeTextEditorHandler();
        }

        activated = true;

        await spotifyClient.initializeSpotify();

        setTimeout(() => {
            slackMgr.initializeSlack();
        }, 20000);

        setTimeout(() => {
            musicMgr.fetchTrack();
        }, 3000);
    },

    deactivate() {
        // softwareDelete(
        //     `/integrations/${utilMgr.getPluginId()}`,
        //     fileUtil.getItem("jwt")
        //   )
        //   .then(resp => {
        //     if (isResponseOk(resp)) {
        //       if (resp.data) {
        //         console.log("Music Time: Uninstalled plugin");
        //       } else {
        //         console.log(
        //           "Music Time: Failed to update Code  about the uninstall event"
        //         );
        //       }
        //     }
        //   });
        tracker.trackEditorAction('editor', 'deactivate');

        clearInterval(this.sendDataInterval);
        clearInterval(this.deviceCheckInterval);

        if (utilMgr.getStatusView()) {
            utilMgr.getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },
};
