'use babel';

import { CompositeDisposable } from 'atom';
import $ from 'jquery';
import StructureView from './music/structure-view';
import KpmMusicTimeStatusView from './music/KpmMusicTimeStatusView';
import KeystrokeManager from './KeystrokeManager';
import KpmMusicManager from './music/KpmMusicManager';
import KpmMusicControlManager from './music/KpmMusicControlManager';
import { CONNECT_SPOTIFY_MENU_LABEL } from './Constants';

const utilMgr = require('./UtilManager');
const treeViewManager = require("./music/TreeViewManager");
const dashboardMgr = require('./DashboardManager');
const kpmRepoMgr = require('./KpmRepoManager');
const sessionMgr = require('./SessionManager');
const slackMgr = require('./SlackControlManager');
const commandMgr = require('./CommandManager');
const codyMusicMgr = require('./CodyMusicManager');
const deviceMgr = require('./music/DeviceManager');
const fileUtil = require('./FileUtil');

const { exec } = require('child_process');

const POST_DELAY_IN_SEC = 60;
const DEFAULT_DURATION = 60;
const DEFAULT_DURATION_MILLIS = DEFAULT_DURATION * 1000;

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

let projectMap = {};
let kpmMgr = null;
let musicMgr = null;
let musicControlMgr = null;
let packageVersion = null;
let activated = false;
let retry_counter = 0;
let musicTimeStatusView;
let structureViewObj;
var keystrokeObj = {};

export default {
    subscriptions: null,
    sendDataInterval: null,
    gatherMusicInfoInterval: null,
    trackEndCheckInterval: null,
    deviceCheckInterval: null,
    keystrokeMgr: new KeystrokeManager(null, null),
    async activate(state) {
        const serverIsOnline = await utilMgr.serverIsAvailable();
        if (!utilMgr.softwareSessionFileExists() || !utilMgr.jwtExists()) {
            // session file doesn't exist,
            // check if the server is online before creating the anon user
            if (!serverIsOnline) {
                if (retry_counter === 0) {
                    utilMgr.showOfflinePrompt();
                }
                // call activate again later
                setTimeout(() => {
                    retry_counter++;
                    activate(state);
                }, 1000 * 60);
            } else {
                // create the anon user
                const result = await utilMgr.createAnonymousUser(
                    serverIsOnline
                );
                if (!result) {
                    if (retry_counter === 0) {
                        utilMgr.showOfflinePrompt();
                    }
                    // call activate again later
                    setTimeout(() => {
                        retry_counter++;
                        activate(ctx);
                    }, 1000 * 60);
                } else {
                    // continue on with activation
                    this.initializePlugin(state, true);
                }
            }
        } else {
            // continue on with activation
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

        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();

        let submenu = utilMgr.getCodeTimeSubmenu();
        let menu = utilMgr.getCodeTimeMenu();

        packageVersion = atom.packages.getLoadedPackage('music-time').metadata
            .version;
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

        // INITAILIZE cody config
        await codyMusicMgr.initializeCodyConfig();

        const displayedReadme = utilMgr.getItem('atom_MtReadme');
        if (!displayedReadme) {
            commandMgr.toggleTreeView();
        }
        utilMgr.displayReadmeIfNotExists(false /*override*/);

        // this needs to happen first to enable spotify playlist and control logic
        utilMgr.updateMusicTimeMenu(menu);
        utilMgr.updateLoginPreference(false);

        atom.menu.add(menu);
        atom.menu.update();

        // intialize the editor event handling
        this.activeTextEditorHandler();

        let one_min = 1000 * 60;
        this.sendDataInterval = setInterval(() => {
            this.keystrokeMgr.sendKeystrokeData;
        }, one_min);

        // send any offline data every 30 minutes
        const half_hour_ms = one_min * 30;
        setInterval(() => {
            dashboardMgr.sendOfflineData();
        }, half_hour_ms);

        // call the hourly jobs handler with an hour interval
        setInterval(() => {
            this.processHourlyJobs();
        }, one_min * 60);

        setTimeout(() => {
            dashboardMgr.sendOfflineData();
        }, one_min * 2);

        activated = true;

        atom.config.onDidChange(utilMgr.geGitConfigKey(), [], event =>
            this.gitConfigChanged(event)
        );
        atom.config.onDidChange(utilMgr.getRankingConfigKey(), [], event =>
            this.rankingConfigChanged(event)
        );

        sessionMgr.initializeStatus();
        this.initializeUserInfo(initializedUser);

        const requiresAccess = fileUtil.requiresSpotifyAccess();
        if (!requiresAccess) {
            await this.initializeSpotifyUser();
        } else {
            // just initialize spotify
            await musicMgr.initializeSpotify();
        }

        setTimeout(() => {
            slackMgr.initializeSlack();
        }, 20000);

        // start gathering music
        this.gatherMusicInfoInterval = setInterval(() => {
            musicMgr.gatherMusicInfo();
        }, 20000);

        this.trackEndCheckInterval = setInterval(() => {
            musicMgr.trackEndCheck();
        }, 5000);

        // gather device info
        this.deviceCheckInterval = setInterval(() => {
            deviceMgr.reconcileDevices()
        }, 10000);
    },

    async initializeSpotifyUser(tries = 0) {
        // initialize the spotify user if we already have access
        await musicMgr.populateSpotifyUserProfile();
        await this.initializeSpotifyPlaylist();
    },

    async initializeSpotifyPlaylist() {
        // initialize devices
        await deviceMgr.populateSpotifyDevices();
        setTimeout(async () => {
            // initialize spotify playlists
            await musicMgr.initializeSpotify();

            setTimeout(() => {
                KpmMusicManager.getInstance().gatherMusicInfo();
            }, 1000);
        }, 5000);
    },

    deactivate() {
        // softwareDelete(
        //     `/integrations/${utilMgr.getPluginId()}`,
        //     utilMgr.getItem("jwt")
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

        clearInterval(this.sendDataInterval);
        clearInterval(this.deviceCheckInterval);
        clearInterval(this.gatherMusicInfoInterval);
        clearInterval(this.trackEndCheckInterval);

        if (utilMgr.getStatusView()) {
            utilMgr.getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },

    async initializeUserInfo(initializedUser) {
        if (initializedUser) {
            utilMgr.sendHeartbeat('INSTALLED');
        } else {
            // send a heartbeat
            utilMgr.sendHeartbeat('INITIALIZED');
        }
    },

    rankingConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    gitConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    async processHourlyJobs() {
        utilMgr.sendHeartbeat('HOURLY');

        if (!kpmMgr) {
            kpmMgr = await this.keystrokeMgr.initializeKeystrokeMgr();
        }
        if (kpmMgr && kpmMgr.keystrokeCount && kpmMgr.keystrokeCount.project) {
            setTimeout(() => {
                kpmRepoMgr.getHistoricalCommits(
                    kpmMgr.keystrokeCount.project.directory
                );
            }, 1000 * 5);
        }
    },

    //
    isCodetimeInstalled() {
        const loadedPackages = atom.packages.loadedPackages;
        return loadedPackages['code-time'] ? true : false;
    },

    /*
     * Observing the active text editor will allow us to monitor
     * opening and closing of a file, and the keystroke changes of the
     * file.
     **/
    activeTextEditorHandler() {
        const codetimeInstalled = this.isCodetimeInstalled();
        atom.workspace.observeTextEditors(async editor => {
            if (!editor || !editor.buffer || codetimeInstalled) {
                return;
            }

            let buffer = editor.buffer;
            let file;
            let lineCount;
            let fileName = buffer.file ? buffer.file.path : 'Untitled';

            if (!kpmMgr) {
                kpmMgr = await this.keystrokeMgr.initializeKeystrokeMgr();
            }

            let grammar = editor.getGrammar() ? editor.getGrammar().name : '';

            // viewing the file for the 1st time, add to the open
            kpmMgr.updateFileInfoData(fileName, 1, 'open');

            kpmMgr.updateFileInfoData(fileName, buffer.getLength(), 'length');
            // update the line count.
            lineCount = editor.getLineCount();
            kpmMgr.updateFileInfoData(fileName, lineCount, 'lines');

            buffer.onDidDestroy(async e => {
                if (codetimeInstalled) {
                    return;
                }
                if (!kpmMgr) {
                    kpmMgr = await this.keystrokeMgr.initializeKeystrokeMgr();
                }

                if (kpmMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                    kpmMgr.updateFileInfoData(fileName, grammar, 'syntax');
                }
                kpmMgr.updateFileInfoData(fileName, 1, 'close');
            });

            // observe when changes stop
            buffer.onDidStopChanging(async e => {
                if (codetimeInstalled) {
                    return;
                }
                if (!kpmMgr) {
                    kpmMgr = await this.keystrokeMgr.initializeKeystrokeMgr();
                }
            });
            // observer on every keystroke.
            buffer.onDidChange(async e => {
                if (codetimeInstalled) {
                    return;
                }
                // make sure its initialized
                if (!kpmMgr) {
                    kpmMgr = await this.keystrokeMgr.initializeKeystrokeMgr();
                }
                let changes = e && e.changes[0] ? e.changes[0] : null;
                let diff = 0;
                let isNewLine = false;
                let addedLinesDiff = 0;
                let removedLinesDiff = 0;
                if (changes) {
                    if (changes.newRange) {
                        addedLinesDiff =
                            changes.newRange.end.row -
                            changes.newRange.start.row;
                    }
                    if (changes.oldRange) {
                        removedLinesDiff =
                            changes.oldRange.end.row -
                            changes.oldRange.start.row;
                    }
                    let newText = changes.newText;
                    let oldText = changes.oldText;
                    if (
                        spacesRegex.test(newText) &&
                        !newLineRegex.test(newText)
                    ) {
                        // they added only spaces.
                        diff = 1;
                    } else if (!newLineRegex.test(newText)) {
                        // get the diff.
                        diff = newText.length - oldText.length;
                        if (spacesRegex.test(oldText) && diff > 1) {
                            // remove 1 space from old text. for some reason it logs
                            // that 1 extra delete occurred
                            diff -= 1;
                        }
                    }
                }

                if (diff > 8) {
                    // it's a copy and paste Event
                    kpmMgr.updateFileInfoData(fileName, 1, 'paste');
                    console.log('Music Time: incremented paste');
                } else if (diff < 0 && removedLinesDiff === 0) {
                    kpmMgr.updateFileInfoData(fileName, 1, 'delete');
                    console.log('Music Time: incremented delete');
                } else if (diff === 1) {
                    // increment the count for this specific file
                    kpmMgr.updateFileInfoData(fileName, 1, 'add');
                    console.log('Music Time: incremented add');
                } else if (addedLinesDiff > 0) {
                    kpmMgr.updateFileInfoData(
                        fileName,
                        addedLinesDiff,
                        'linesAdded'
                    );
                    console.log(
                        `Music Time: incremented ${addedLinesDiff} lines added`
                    );
                } else if (removedLinesDiff > 0) {
                    kpmMgr.updateFileInfoData(
                        fileName,
                        removedLinesDiff,
                        'linesRemoved'
                    );
                    console.log(
                        `Music Time: incremented ${removedLinesDiff} lines removed`
                    );
                }

                if (
                    diff !== 0 ||
                    removedLinesDiff !== 0 ||
                    addedLinesDiff !== 0
                ) {
                    kpmMgr.updateFileInfoData(fileName, 1, 'keystrokes');
                    // increment the top level data property as well
                    kpmMgr.incrementKeystrokeCount();
                }
            });
        });
    },
};
