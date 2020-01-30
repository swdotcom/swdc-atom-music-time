'use babel';

import { CompositeDisposable } from 'atom';
import $ from 'jquery';
import StructureView from './music/structure-view';
import KpmMusicTimeStatusView from './music/KpmMusicTimeStatusView';
import KeystrokeManager from './KeystrokeManager';
import KpmMusicManager from './music/KpmMusicManager';
import KpmMusicControlManager from './music/KpmMusicControlManager';
import { GITHUB_ISSUE_URL, FEEDBACK_URL } from './Constants';
import { PlayerName, setConfig, CodyConfig } from 'cody-music';
const utilMgr = require('./UtilManager');
const userstatusMgr = require('./UserStatusManager');
const dashboardMgr = require('./DashboardManager');
const kpmRepoMgr = require('./KpmRepoManager');
const sessionMgr = require('./SessionManager');
const slackMgr = require('./SlackControlManager');

const { exec } = require('child_process');

const POST_DELAY_IN_SEC = 60;
const DEFAULT_DURATION = 60;
const DEFAULT_DURATION_MILLIS = DEFAULT_DURATION * 1000;

const newLineRegex = new RegExp(/\n/);
const spacesRegex = new RegExp(/^\s+$/);

let projectMap = {};
let keystrokeMgr = null;
let musicMgr = null;
let musicControlMgr = null;
let packageVersion = null;
let activated = false;
let retry_counter = 0;
let musicTimeStatusView;
let structureViewObj;
const check_online_interval_ms = 1000 * 60 * 10;
var keystrokeObj = {};
let token_check_interval = null;

export default {
    subscriptions: null,
    sendDataInterval: null,
    keystrokeMgr: new KeystrokeManager(null, null),
    async activate(state) {
        const serverIsOnline = await utilMgr.serverIsAvailable();

        // continue on with activation
        this.initializePlugin(state, false);

    },

    async initializePlugin(state, initializedUser) {
        utilMgr.setItem('isSpotifyConnected', '');
        if (activated) {
            return;
        }
        if (!structureViewObj) structureViewObj = new StructureView();
        if (!musicMgr) {
            musicMgr = new KpmMusicManager(state);
        }

        if (!musicTimeStatusView) {
            musicTimeStatusView = new KpmMusicTimeStatusView();
        }
        if (!musicControlMgr) {
            musicControlMgr = new KpmMusicControlManager();
        }
        // Subscribe to the "observeActiveTextEditor"
        this.subscriptions = new CompositeDisposable();
        let submenu = utilMgr.getCodeTimeSubmenu();
        let menu = utilMgr.getCodeTimeMenu();

        utilMgr.setItem('isSpotifyConnected', false);
        // await musicMgr.refreshPlaylists();
        packageVersion = atom.packages.getLoadedPackage('music-time').metadata
            .version;
        console.log(`Music Time: Loaded v${packageVersion}`);

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:connectSpotify': () =>
                    musicControlMgr.connectSpotify(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:disconnectSpotify': () =>
                    musicControlMgr.disconnectSpotify(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:disconnectSlack': () =>
                    musicControlMgr.disconnectSlack(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:refreshPlaylist': () =>
                    musicMgr.refreshClearPlaylists(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:generateUsersWeeklyTopSongs': () =>
                    musicMgr.generateUsersWeeklyTopSongs(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:software-top-40': () =>
                    utilMgr.launchSoftwareTopForty(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:web-dashboard': () =>
                    musicControlMgr.displayMusicTimeMetricsMarkdownDashboard(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:log-in': () => userstatusMgr.launchLoginUrl(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:toggle-status-bar-metrics': () =>
                    utilMgr.toggleStatusBarMetrics(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:launchTrackPlayer': () =>
                    musicControlMgr.launchTrackPlayer(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:pause': () => musicControlMgr.pause(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:play': () => musicControlMgr.play(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:next': () => musicControlMgr.next(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:previous': () => musicControlMgr.previous(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'musictime.generateGlobalPlaylist': () =>
                    musicMgr.createOrRefreshGlobalTopSongsPlaylist(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:clearFooterStatus': () =>
                    musicTimeStatusView.clearStatus(),
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:clearTreeView': () => structureViewObj.clearTree(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:toggle-music-tree': () =>
                    this.togglePlaylistView('on'),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:launchAnalytics': () =>
                    utilMgr.launchMusicAnalytics(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:toggle-playlist': () => musicMgr.togglePLaylist(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:play-playlist-song': () =>
                    musicMgr.playPlaylistSong(),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:refresh-treeview': async () => {
                    musicMgr.clearSavedPlaylists();
                    await musicMgr.refreshPlaylists();
                },
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:sortAlphabetically': async () => {
                    musicMgr.updateSort(true);
                },
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:sortToOriginal': async () => {
                    musicMgr.updateSort(false);
                },
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:like': async () => {
                    musicControlMgr.setLiked(true);
                },
            })
        );
        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:unlike': async () => {
                    musicControlMgr.setLiked(false);
                },
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:share-track': async () => {
                    musicControlMgr.shareSong();
                },
            })
        );  
    
        submenu.push({
            label: 'Connect spotify',
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

        let codyConfig = new CodyConfig();
        codyConfig.enableItunesDesktop = false;
        codyConfig.enableItunesDesktopSongTracking = utilMgr.isMac()
            ? true
            : false;
        codyConfig.enableSpotifyDesktop = utilMgr.isMac() ? true : false;
        setConfig(codyConfig);

        this.togglePlaylistView('on');
        // this needs to happen first to enable spotify playlist and control logic
        await musicMgr.initializeSpotify();
        await slackMgr.initializeSlack();

        utilMgr.updateMusicTimeMenu(menu);

        // gather music info every 15 seconds
        setInterval(() => {
            musicMgr.gatherMusicInfo();
        }, 10000);

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:submit-issue': () =>
                    utilMgr.launchWebUrl(GITHUB_ISSUE_URL),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:submit-feedback': () =>
                    utilMgr.launchWebUrl(FEEDBACK_URL),
            })
        );

        this.subscriptions.add(
            atom.commands.add('atom-workspace', {
                'Music-Time:connect-slack': () => slackMgr.connectSlack(),
            })
        );

        atom.menu.add(menu);
        atom.menu.update();

        // intialize the editor event handling
        this.activeTextEditorHandler();

        this.sendDataInterval = setInterval(
            this.keystrokeMgr.sendKeystrokeData,
            POST_DELAY_IN_SEC * 1000
        );

        let one_min = 1000 * 60;

        // send any offline data every 30 minutes
        const half_hour_ms = one_min * 30;
        setInterval(() => {
            dashboardMgr.sendOfflineData();
        }, half_hour_ms);

        // call the hourly jobs handler with an hour interval
        setInterval(() => {
            this.processHourlyJobs();
        }, one_min * 60);

        // process the hourly jobs in a minute to get things started
        setTimeout(() => {
            this.processHourlyJobs();
        }, one_min);

        activated = true;

        atom.config.onDidChange(utilMgr.getMusicConfigKey(), [], event =>
            this.musicConfigChanged(event)
        );
        atom.config.onDidChange(utilMgr.geGitConfigKey(), [], event =>
            this.gitConfigChanged(event)
        );
        atom.config.onDidChange(utilMgr.getRankingConfigKey(), [], event =>
            this.rankingConfigChanged(event)
        );

        sessionMgr.initializeStatus();
        this.initializeUserInfo(initializedUser);



    },

    deactivate() {
        // utilMgr
        //   .softwareDelete(
        //     `/integrations/${utilMgr.getPluginId()}`,
        //     utilMgr.getItem("jwt")
        //   )
        //   .then(resp => {
        //     if (utilMgr.isResponseOk(resp)) {
        //       if (resp.data) {
        //         console.log("Code Time: Uninstalled plugin");
        //       } else {
        //         console.log(
        //           "Code Time: Failed to update Code  about the uninstall event"
        //         );
        //       }
        //     }
        //   });

        clearInterval(this.sendDataInterval);
        if (token_check_interval) {
            clearInterval(token_check_interval);
        }
        if (utilMgr.getStatusView()) {
            utilMgr.getStatusView().destroy();
        }
        this.subscriptions.dispose();
    },

    serialize() {
        //
    },

    async initializeUserInfo(initializedUser) {
        await userstatusMgr.getUserStatus();
        if (!musicMgr) {
            musicMgr = new KpmMusicManager(state);
        }
        if (initializedUser) {
            userstatusMgr.launchLoginPrompt();
            musicMgr.buildBootstrapSongSession();
            // send an initial payload.
            keystrokeMgr = this.keystrokeMgr.initializeKeystrokeMgr();
            let fileName = 'Untitled';
            keystrokeMgr.updateFileInfoData(fileName, 1, 'add');
            this.keystrokeMgr.sendKeystrokeData();

            utilMgr.sendHeartbeat('INSTALLED');
        } else {
            // send a heartbeat
            utilMgr.sendHeartbeat('INITIALIZED');
        }

        // send the current offline data now
        setTimeout(async () => {
            await dashboardMgr.sendOfflineData();
            dashboardMgr.fetchDailyKpmSessionInfo();
        }, 1000);
    },

    musicConfigChanged(event) {
        utilMgr.updatePreference(utilMgr.getMusicConfigKey(), event.newValue);
    },

    rankingConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    gitConfigChanged(event) {
        utilMgr.updatePreferences();
    },

    processHourlyJobs() {
        utilMgr.sendHeartbeat('HOURLY');

        keystrokeMgr = this.keystrokeMgr.initializeKeystrokeMgr();
        if (
            keystrokeMgr &&
            keystrokeMgr.keystrokeCount &&
            keystrokeMgr.keystrokeCount.project
        ) {
            setTimeout(() => {
                kpmRepoMgr.getHistoricalCommits(
                    keystrokeMgr.keystrokeCount.project.directory
                );
            }, 1000 * 5);
        }
    },

    /*
     * Observing the active text editor will allow us to monitor
     * opening and closing of a file, and the keystroke changes of the
     * file.
     **/
    activeTextEditorHandler() {
        let dashboardFile = utilMgr.getDashboardFile();
        atom.workspace.observeTextEditors(editor => {
            if (!editor || !editor.buffer) {
                return;
            }

            keystrokeMgr = this.keystrokeMgr.initializeKeystrokeMgr();

            let buffer = editor.buffer;
            let file;
            let lineCount;
            let fileName = buffer.file ? buffer.file.path : 'Untitled';
            let grammar = editor.getGrammar() ? editor.getGrammar().name : '';

            if (fileName === dashboardFile) {
                utilMgr.updateDashboardFileVisibility(true);
            }

            // viewing the file for the 1st time, add to the open
            keystrokeMgr.updateFileInfoData(fileName, 1, 'open');

            keystrokeMgr.updateFileInfoData(
                fileName,
                buffer.getLength(),
                'length'
            );

            // update the line count.
            lineCount = editor.getLineCount();
            keystrokeMgr.updateFileInfoData(fileName, lineCount, 'lines');

            buffer.onDidDestroy(e => {
                if (fileName === dashboardFile) {
                    utilMgr.updateDashboardFileVisibility(false);
                }
                if (keystrokeMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                    keystrokeMgr.updateFileInfoData(
                        fileName,
                        grammar,
                        'syntax'
                    );
                }
                keystrokeMgr.updateFileInfoData(fileName, 1, 'close');
            });

            // observe when changes stop
            buffer.onDidStopChanging(e => {
                keystrokeMgr = this.keystrokeMgr.initializeKeystrokeMgr();

                // get the previous line count
                const prevLines = keystrokeMgr.getFileInfoByKey(
                    fileName,
                    'lines'
                );
                lineCount = editor.getLineCount();

                if (prevLines !== 0) {
                    const diff = lineCount - prevLines;
                    if (diff > 0) {
                        // lines were added
                        keystrokeMgr.updateFileInfoData(
                            fileName,
                            diff,
                            'linesAdded'
                        );
                        console.log('Code Time: incremented lines added');
                    } else if (diff < 0) {
                        // lines were removed
                        keystrokeMgr.updateFileInfoData(
                            fileName,
                            Math.abs(diff),
                            'linesRemoved'
                        );
                        console.log('Code Time: incremented lines removed');
                    }
                }

                // update the line count.
                keystrokeMgr.updateFileInfoData(fileName, lineCount, 'lines');

                if (keystrokeMgr.getFileInfoByKey(fileName, 'syntax') === '') {
                    keystrokeMgr.updateFileInfoData(
                        fileName,
                        grammar,
                        'syntax'
                    );
                }

                if (!keystrokeMgr.getFileInfoByKey(fileName, 'length')) {
                    keystrokeMgr.updateFileInfoData(
                        fileName,
                        buffer.getLength(),
                        'length'
                    );
                }
            });

            // observer on every keystroke.
            buffer.onDidChange(async e => {
                let changes = e && e.changes[0] ? e.changes[0] : null;
                let diff = 0;
                let isNewLine = false;
                if (changes) {
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

                // get the repo info if we don't already have it for the project.
                if (
                    keystrokeMgr.keystrokeCount.project &&
                    (!keystrokeMgr.keystrokeCount.project.resource ||
                        Object.keys(
                            keystrokeMgr.keystrokeCount.project.resource
                        ).length === 0)
                ) {
                    const resourceInfo = await kpmRepoMgr.getResourceInfo(
                        keystrokeMgr.keystrokeCount.project.directory
                    );
                    if (resourceInfo && resourceInfo.identifier) {
                        keystrokeMgr.keystrokeCount.project.resource = resourceInfo;
                        keystrokeMgr.keystrokeCount.project.identifier =
                            resourceInfo.identifier;
                    }
                }

                if (diff > 8) {
                    // it's a copy and paste Event
                    keystrokeMgr.updateFileInfoData(fileName, 1, 'paste');
                    console.log('Code Time: incremented paste');
                } else if (diff < 0) {
                    keystrokeMgr.updateFileInfoData(fileName, 1, 'delete');
                    console.log('Code Time: incremented delete');
                } else if (diff === 1) {
                    // increment the count for this specific file
                    keystrokeMgr.updateFileInfoData(fileName, 1, 'add');
                    console.log('Code Time: incremented add');
                }

                if (diff !== 0) {
                    // increment the top level data property as well
                    keystrokeMgr.incrementKeystrokeCount();
                }
            });
        });
    },
    // it toggles playlist view
    togglePlaylistView(stat) {
        const rightDock = atom.workspace.getRightDock();
        if (!this.structureView) this.structureView = new StructureView();
        if (!stat) {
            rightDock.toggle();
        } else if ('on' === stat) {
            rightDock.show();
            try {
                // Whatever do these first for performance
                rightDock.getPanes()[0].addItem(this.structureView);
                rightDock.getPanes()[0].activateItem(this.structureView);
            } catch (e) {
                if (
                    e.message.includes('can only contain one instance of item')
                ) {
                    this.handleOneInstanceError();
                }
            }

            // Sometimes dock title is hidden for somehow,
            // so force recalculate here to redraw
            $('ul.list-inline.tab-bar.inset-panel').height();

            // if (rightDock.isVisible()) {
            //     this.structureView.initialize();
            //     //musicMgr.refreshPlaylists()
            // }
        } else if ('off' === stat) {
            rightDock.getPanes()[0].removeItem(this.structureView);
            rightDock.hide();
        }
    },
};
