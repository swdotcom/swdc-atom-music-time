'use babel';

import KpmStatusView from './KpmStatusView';
import KpmMusicTimeStatusView from './music/KpmMusicTimeStatusView';
import KpmMusicManager from './music/KpmMusicManager';

import { launch_url } from './Constants';
import {
    SHOW_MUSIC_METRICS_CONFIG_KEY,
    SHOW_GIT_METRICS_CONFIG_KEY,
    SHOW_RANKING_METRICS_CONFIG_KEY,
    TOP_MUSIC_MENU_LABEL,
    CONNECT_SPOTIFY_MENU_LABEL,
    DISCONNECT_SPOTIFY_MENU_LABEL,
    DISCONNECT_SPOTIFY_COMMAND_KEY,
    WEB_ISSUE_GITHUB_LABEL,
    WEB_ISSUE_GITHUB_COMMAND_KEY,
    MUSIC_DASHBOARD_LABEL,
    MUSIC_DASHBOARD_COMMAND_KEY,
    WEB_FEEDBACK_LABEL,
    WEB_FEEDBACK_COMMAND_KEY,
    WEB_SLACK_LABEL,
    WEB_SLACK_COMMAND_KEY,
    api_endpoint,
    api_spotify_endpoint,
    DISCONNECT_SLACK_MENU_LABEL,
    DISCONNECT_SLACK_COMMAND_KEY,
    SPOTIFY_LIKED_SONGS_PLAYLIST_ID,
    SPOTIFY_LIKED_SONGS_PLAYLIST_NAME,
} from './Constants';
import {
    isResponseOk,
    softwareGet,
    softwarePut,
    softwareDelete,
} from './HttpClient';
import $ from 'jquery';
import {
    PlaylistItem,
    TrackStatus,
    CodyResponse,
    CodyResponseType,
    getSpotifyLikedSongs,
} from 'cody-music';
import StructureView from './music/structure-view';
import { MusicDataManager } from './music/MusicDataManager';

const { exec } = require('child_process');
const crypto = require('crypto');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
import path from 'path';
const cp = require('child_process');
const open = require('open');

// this should be the only place that initializes music time status view
const musicTimeStatusView = new KpmMusicTimeStatusView();

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const NO_PROJECT_DIR_NAME = 'Unnamed';

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

const DASHBOARD_LABEL_WIDTH = 25;
const DASHBOARD_VALUE_WIDTH = 25;
const MARKER_WIDTH = 4;

const PLUGIN_ID = 7;

let telemetryOn = true;
let statusView = new KpmStatusView();

let dashboardFileVisible = false;
let cachedSessionKeys = {};
let editorSessiontoken = null;
let showStatusBarText = true;
let isOnline = null;
let lastOnlineCheck = 0;
let lastMsg = null;
let lastIcon = null;
let whoami = null;
let extensionName = null;
let _spotifyUser = null;
const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

const spotifyApi = axios.create({
    baseURL: `${api_spotify_endpoint}`,
});

utilMgr.getEditorSessionToken = () => {
    if (!editorSessiontoken) {
        editorSessiontoken = utilMgr.randomCode();
    }
    return editorSessiontoken;
};

utilMgr.getVersion = () => {
    return atom.packages.getLoadedPackage('music-time').metadata.version;
};

utilMgr.getHostname = async () => {
    let hostname = await utilMgr.getCommandResult('hostname');
    return hostname;
};

utilMgr.getOs = () => {
    let parts = [];
    let osType = os.type();
    if (osType) {
        parts.push(osType);
    }
    let osRelease = os.release();
    if (osRelease) {
        parts.push(osRelease);
    }
    let platform = os.platform();
    if (platform) {
        parts.push(platform);
    }
    if (parts.length > 0) {
        return parts.join('_');
    }
    return '';
};

utilMgr.nowInSecs = () => {
    let d = new Date();
    return Math.round(d.getTime() / 1000);
};

utilMgr.updateDashboardFileVisibility = visible => {
    dashboardFileVisible = visible;
};

utilMgr.getDefaultProjectName = () => {
    return NO_PROJECT_DIR_NAME;
};

utilMgr.getMusicConfigKey = () => {
    return SHOW_MUSIC_METRICS_CONFIG_KEY;
};

utilMgr.geGitConfigKey = () => {
    return SHOW_GIT_METRICS_CONFIG_KEY;
};

utilMgr.getRankingConfigKey = () => {
    return SHOW_RANKING_METRICS_CONFIG_KEY;
};

utilMgr.getPluginId = () => {
    return PLUGIN_ID;
};

utilMgr.getStatusView = () => {
    return musicTimeStatusView;
};

utilMgr.getOpenProjects = () => {
    let openProjectNames = [];
    if (atom.project && atom.project.getPaths()) {
        openProjectNames = atom.project.getPaths();
    }
    return openProjectNames;
};

utilMgr.showErrorStatus = async () => {
    utilMgr.getStatusView().display('Code Time');
};

utilMgr.showDeactivatedErrorStatus = async () => {
    utilMgr
        .getStatusView()
        .display(
            'Code Time',
            'alert',
            'To see your coding data in Code Time, please reactivate your account.'
        );
};

utilMgr.isTelemetryOn = () => {
    return telemetryOn;
};

utilMgr.randomCode = () => {
    return crypto
        .randomBytes(16)
        .map(value =>
            alpha.charCodeAt(Math.floor((value * alpha.length) / 256))
        )
        .toString();
};

utilMgr.getTelemetryStatus = () => {
    return telemetryOn;
};

utilMgr.updateTelemetryOn = isOn => {
    telemetryOn = isOn;
};

utilMgr.getLongThresholdHours = () => {
    return LONG_THRESHOLD_HOURS;
};

utilMgr.getShortThresholdHours = () => {
    return SHORT_THRESHOLD_HOURS;
};

utilMgr.getMillisPerHour = () => {
    return MILLIS_PER_HOUR;
};

utilMgr.getSessionFileCreateTime = () => {
    let sessionFile = utilMgr.getSoftwareSessionFile();
    const stat = fs.statSync(sessionFile);
    if (stat.birthtime) {
        return stat.birthtime;
    }
    return stat.ctime;
};

utilMgr.isLinux = () => {
    if (!utilMgr.isWindows() && !utilMgr.isMac()) {
        return true;
    }
    return false;
};

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
utilMgr.isWindows = () => {
    return process.platform.indexOf('win32') !== -1;
};

utilMgr.isMac = () => {
    return process.platform.indexOf('darwin') !== -1;
};

utilMgr.getOsUsername = async () => {
    let username = os.userInfo().username;
    if (!username || username.trim() === '') {
        username = await utilMgr.getCommandResult('whoami');
    }
    return username;
};

utilMgr.getCommandResult = async (cmd, maxLines = -1) => {
    let result = await utilMgr.wrapExecPromise(`${cmd}`, null);
    if (!result) {
        return '';
    }
    let contentList = result
        .replace(/\r\n/g, '\r')
        .replace(/\n/g, '\r')
        .split(/\r/);
    if (contentList && contentList.length > 0) {
        let len =
            maxLines !== -1
                ? Math.min(contentList.length, maxLines)
                : contentList.length;
        for (let i = 0; i < len; i++) {
            let line = contentList[i];
            if (line && line.trim().length > 0) {
                result = line.trim();
                break;
            }
        }
    }
    return result;
};

utilMgr.cleanSessionInfo = () => {
    const jsonObj = utilMgr.getSoftwareSessionAsJson();
    if (jsonObj) {
        let keys = Object.keys(jsonObj);
        let removedKeys = false;
        if (keys) {
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                if (key !== 'jwt' && key !== 'name') {
                    // remove  it
                    delete jsonObj[key];
                    removedKeys = true;
                }
            }
        }

        if (removedKeys) {
            const content = JSON.stringify(jsonObj);

            const sessionFile = utilMgr.getSoftwareSessionFile();
            fs.writeFileSync(sessionFile, content, err => {
                if (err)
                    console.log(
                        'Code Time: Error writing to the Software session file: ',
                        err.message
                    );
            });
        }
    }
};

utilMgr.setItem = (key, value) => {
    // update the cached session key map
    cachedSessionKeys[key] = value;

    const jsonObj = utilMgr.getSoftwareSessionAsJson();
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = utilMgr.getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, err => {
        if (err)
            console.log(
                'Code Time: Error writing to the Software session file: ',
                err.message
            );
    });
};

utilMgr.getItem = key => {
    let cachedVal = cachedSessionKeys[key];
    if (cachedVal) {
        return cachedVal;
    }
    const jsonObj = utilMgr.getSoftwareSessionAsJson();

    return jsonObj[key] || null;
};

utilMgr.getSoftwareSessionAsJson = () => {
    let data = null;

    const sessionFile = utilMgr.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile).toString();
        if (content) {
            data = JSON.parse(content);
        }
    }
    return data ? data : {};
};

utilMgr.jwtExists = () => {
    let jwt = utilMgr.getItem('jwt');
    return !jwt ? false : true;
};

utilMgr.softwareSessionFileExists = () => {
    // don't auto create the file
    const file = utilMgr.getSoftwareSessionFile(false);
    // check if it exists
    return fs.existsSync(file);
};

/**
 * Get the .software/session.json path/name
 **/
utilMgr.getSoftwareSessionFile = (autoCreate = true) => {
    let file = utilMgr.getSoftwareDir(autoCreate);
    if (utilMgr.isWindows()) {
        file += '\\session.json';
    } else {
        file += '/session.json';
    }
    return file;
};

utilMgr.getDashboardFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\CodeTime.txt';
    } else {
        file += '/CodeTime.txt';
    }
    return file;
};

utilMgr.getSummaryInfoFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\SummaryInfo.txt';
    } else {
        file += '/SummaryInfo.txt';
    }
    return file;
};

/**
 * Get the .software directory path/name
 **/
utilMgr.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (utilMgr.isWindows()) {
        softwareDataDir += '\\.software';
    } else {
        softwareDataDir += '/.software';
    }

    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
};

/**
 * Get the .software/data.json path/name
 **/
utilMgr.getSoftwareDataStoreFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\data.json';
    } else {
        file += '/data.json';
    }
    return file;
};

utilMgr.deleteFile = file => {
    //
    // if the file exists, get it
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
};

utilMgr.showStatus = async (msg, icon, TrackInfo) => {
    if (!showStatusBarText) {
        msg = '';
        icon = 'clock';
    } else {
        lastMsg = msg;
        lastIcon = icon;
    }
    utilMgr.getStatusView().display(msg, icon, null, TrackInfo);
};

utilMgr.toggleStatusBarMetrics = () => {
    showStatusBarText = !showStatusBarText;
    utilMgr.showStatus(lastMsg, lastIcon);
};

utilMgr.launchCodeTimeDashboard = async () => {
    // launch the CodeTime file
    let file = utilMgr.getDashboardFile();

    if (!fs.existsSync(file)) {
        await dashboardMgr.fetchDailyKpmSessionInfo();
        file = utilMgr.getDashboardFile();
    }

    atom.workspace.open(file, {
        changeFocus: true,
        activatePane: true,
        activateItem: true,
    });
};

utilMgr.humanizeMinutes = minutes => {
    let humizedStr = '';
    minutes = parseInt(minutes, 10) || 0;
    let sessionTime = '';
    if (minutes === 60) {
        humizedStr = '1 hr';
    } else if (minutes > 60) {
        let hours = minutes / 60;
        if (hours % 1 === 0) {
            humizedStr = hours.toFixed(0) + ' hrs';
        } else {
            humizedStr = (Math.round(hours * 10) / 10).toFixed(1) + ' hrs';
        }
    } else if (minutes === 1) {
        humizedStr = '1 min';
    } else {
        humizedStr = minutes + ' min';
    }
    return humizedStr;
};

utilMgr.execPromise = (command, opts) => {
    return new Promise((resolve, reject) => {
        exec(command, opts, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            return resolve(stdout.trim());
        });
    });
};

utilMgr.wrapExecPromise = async (cmd, projectDir = null) => {
    let prop = null;
    try {
        if (projectDir) {
            prop = await utilMgr.execPromise(cmd, {
                cwd: projectDir,
            });
        } else {
            prop = await utilMgr.execPromise(cmd, {});
        }
    } catch (e) {
        // console.error(e.message);
        prop = null;
    }
    return prop;
};

utilMgr.spotifyGet = async (api, token) => {
    if (token) {
        // spotifyApi.defaults.headers.common['Authorization'] = token;
        spotifyApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return await spotifyApi
        .get(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error fetching data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

/**
 * Response returns a paylod with the following..
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
utilMgr.softwareGet = async (api, jwt) => {
    if (jwt) {
        beApi.defaults.headers.common['Authorization'] = jwt;
    }

    return await beApi
        .get(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error fetching data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwarePut = async (api, payload, jwt) => {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .put(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwarePost = async (api, payload, jwt) => {
    // POST the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .post(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error posting data for ${api}, message: ${err.message}`
            );
            return err;
        });
};

utilMgr.softwareDelete = async (api, jwt) => {
    beApi.defaults.headers.common['Authorization'] = jwt;
    return beApi
        .delete(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(
                `Code Time: error with delete request for ${api}, message: ${err.message}`
            );
            return err;
        });
};

function getResponseStatus(resp) {
    let status = null;
    if (resp && resp.status) {
        status = resp.status;
    } else if (resp && resp.response && resp.response.status) {
        status = resp.response.status;
    }
    return status;
}

function getResponseData(resp) {
    let data = null;
    if (resp && resp.data) {
        data = resp.data;
    } else if (resp && resp.response && resp.response.data) {
        data = resp.response.data;
    }
    return data;
}

utilMgr.isResponseOk = resp => {
    let status = getResponseStatus(resp);
    if (!resp || (status && status < 400)) {
        return true;
    }
    return false;
};

utilMgr.isUnauthenticated = resp => {
    let status = getResponseStatus(resp);
    if (status && status >= 400 && status < 500) {
        return true;
    }
    return false;
};

utilMgr.isDeactivated = async () => {
    let pingResp = await utilMgr.softwareGet(
        '/users/ping/',
        utilMgr.getItem('jwt')
    );
    return await utilMgr.isUserDeactivated(pingResp);
};

utilMgr.isUserDeactivated = async resp => {
    let deactivated = await utilMgr.isUnauthenticatedAndDeactivated(resp);
    if (deactivated) {
        return true;
    }
    return false;
};

// we send back "NOTFOUND" or "DEACTIVATED" codes
utilMgr.isUnauthenticatedAndDeactivated = async resp => {
    let status = getResponseStatus(resp);
    let data = getResponseData(resp);
    if (status && status >= 400 && data) {
        // check if we have the data object
        let code = data.code || '';
        if (code === 'DEACTIVATED') {
            return true;
        }
    }
    return false;
};

utilMgr.launchSoftwareTopForty = async () => {
    utilMgr.launchUrl('https://api.software.com/music/top40');
};

utilMgr.launchUrl = url => {
    let open = 'open';
    let args = [`${url}`];
    if (utilMgr.isWindows()) {
        open = 'cmd';
        // adds the following args to the beginning of the array
        args.unshift('/c', 'start', '""');
    } else if (!utilMgr.isMac()) {
        open = 'xdg-open';
    }

    let process = cp.execFile(open, args, (error, stdout, stderr) => {
        if (error != null) {
            console.log(
                'Code Time: Error launching Software authentication: ',
                error.toString()
            );
        }
    });
};

utilMgr.serverIsAvailable = async () => {
    let nowInSec = utilMgr.nowInSecs();
    let pastThreshold = nowInSec - lastOnlineCheck > 60;
    if (pastThreshold) {
        isOnline = await utilMgr
            .softwareGet('/ping', null)
            .then(result => {
                return utilMgr.isResponseOk(result);
            })
            .catch(e => {
                return false;
            });
    }
    return isOnline;
};

/**
 * get the app jwt
 */
utilMgr.getAppJwt = async () => {
    utilMgr.setItem('app_jwt', null);
    let serverIsOnline = await utilMgr.serverIsAvailable();

    if (serverIsOnline) {
        // get the app jwt
        let resp = await utilMgr.softwareGet(
            `/data/apptoken?token=${utilMgr.nowInSecs()}`,
            null
        );
        if (utilMgr.isResponseOk(resp)) {
            return resp.data.jwt;
        }
    }
    return null;
};

/**
 * create an anonymous user
 */
utilMgr.createAnonymousUser = async serverIsOnline => {
    let appJwt = await utilMgr.getAppJwt();
    if (appJwt) {
        utilMgr.setItem('jwt', appJwt);
        return appJwt;
    }

    return null;
};

utilMgr.validateEmail = email => {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
};

utilMgr.initializePreferences = async () => {
    let user = utilMgr.getItem('user');
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline && user) {
        let cachedUser = user;
        if (!cachedUser.id) {
            cachedUser = JSON.parse(cachedUser);
        }
        let userId = parseInt(cachedUser.id, 10);

        let api = `/users/${userId}`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                let prefs = resp.data.data.preferences;
                let prefsShowMusic =
                    prefs.showMusic !== null && prefs.showMusic !== undefined
                        ? prefs.showMusic
                        : null;
                let prefsShowGit =
                    prefs.showGit !== null && prefs.showGit !== undefined
                        ? prefs.showGit
                        : null;
                let prefsShowRank =
                    prefs.showRank !== null && prefs.showRank !== undefined
                        ? prefs.showRank
                        : null;

                if (
                    prefsShowMusic === null ||
                    prefsShowGit === null ||
                    prefsShowRank === null
                ) {
                    await utilMgr.sendPreferencesUpdate(userId, prefs);
                } else {
                    if (prefsShowMusic !== null) {
                        await atom.config.set(
                            SHOW_MUSIC_METRICS_CONFIG_KEY,
                            prefsShowMusic
                        );
                        utilMgr.updateMenuPreference(
                            SHOW_MUSIC_METRICS_CONFIG_KEY,
                            prefsShowMusic
                        );
                    }
                    if (prefsShowGit !== null) {
                        await atom.config.set(
                            'code-time.showGitMetrics',
                            prefsShowGit
                        );
                    }
                    if (prefsShowRank !== null) {
                        await atom.config.set(
                            'code-time.showWeeklyRanking',
                            prefsShowRank
                        );
                    }
                }
            }
        }
    }
};

utilMgr.getLoginUrl = () => {
    let jwt = utilMgr.getItem('jwt');
    let loginUrl = `${launch_url}/onboarding?token=${jwt}`;
    return loginUrl;
};

utilMgr.launchWebDashboardUrl = () => {
    utilMgr.launchUrl(launch_url + '/login');
};

let codeTimeSubmenu = [];
let codeTimeMenu = [];

let musicTimeSubmenu = [];
let musicTimeMenu = [];

utilMgr.getCodeTimeMenu = () => {
    return codeTimeMenu;
};

utilMgr.getMusicTimeMenu = () => {
    return musicTimeMenu;
};

utilMgr.updateCodeTimeMenu = menu => {
    codeTimeMenu = menu;
};

utilMgr.updateMusicTimeMenu = menu => {
    musicTimeMenu = menu;
};

utilMgr.getCodeTimeSubmenu = () => {
    return codeTimeSubmenu;
};

utilMgr.updateCodeTimeSubmenu = menu => {
    codeTimeSubmenu = menu;
};

utilMgr.getMusicTimeMenu = () => {
    return musicTimeMenu;
};

utilMgr.getMusicTimeSubmenu = () => {
    return musicTimeSubmenu;
};

utilMgr.updateMusicTimeSubmenu = menu => {
    musicTimeSubmenu = menu;
};

utilMgr.updatePreference = (command, flag) => {
    utilMgr.updateMenuPreference(command, flag);
    utilMgr.updatePreferences();
};

utilMgr.removeMusicMenuItem = prefLabel => {
    const result = musicTimeSubmenu.find(n => n.label === prefLabel);
    if (result) {
        musicTimeSubmenu = musicTimeSubmenu.filter(n => n.label !== prefLabel);
        atom.menu.remove(musicTimeMenu);
        musicTimeMenu[0].submenu = musicTimeSubmenu;

        musicTimeMenu = [];
        musicTimeMenu.push({
            label: 'Packages',
            submenu: [
                {
                    label: 'Music Time',
                    submenu: musicTimeSubmenu,
                },
            ],
        });

        atom.menu.add(musicTimeMenu);
        atom.menu.update();
    }
};

utilMgr.addMusicMenuItem = (prefLabel, command) => {
    const result = musicTimeSubmenu.find(n => n.label === prefLabel);
    if (!result) {
        atom.menu.remove(musicTimeMenu);
        musicTimeSubmenu.push({
            label: prefLabel,
            command,
        });

        musicTimeMenu = [];
        musicTimeMenu.push({
            label: 'Packages',
            submenu: [
                {
                    label: 'Music Time',
                    submenu: musicTimeSubmenu,
                },
            ],
        });

        atom.menu.add(musicTimeMenu);
        atom.menu.update();
    }
};

utilMgr.updateLoginPreference = loggedIn => {
    const structureViewObj = new StructureView();
    utilMgr.addMusicMenuItem(
        WEB_ISSUE_GITHUB_LABEL,
        WEB_ISSUE_GITHUB_COMMAND_KEY
    );
    utilMgr.addMusicMenuItem(WEB_FEEDBACK_LABEL, WEB_FEEDBACK_COMMAND_KEY);

    if (loggedIn) {
        structureViewObj.toggleConnectSpotify(true);

        utilMgr.removeMusicMenuItem(CONNECT_SPOTIFY_MENU_LABEL);
        utilMgr.addMusicMenuItem(
            DISCONNECT_SPOTIFY_MENU_LABEL,
            DISCONNECT_SPOTIFY_COMMAND_KEY
        );
        utilMgr.addMusicMenuItem(
            MUSIC_DASHBOARD_LABEL,
            MUSIC_DASHBOARD_COMMAND_KEY
        );
        if (utilMgr.getItem('slack_access_token')) {
            utilMgr.removeMusicMenuItem(WEB_SLACK_LABEL);
            utilMgr.addMusicMenuItem(
                DISCONNECT_SLACK_MENU_LABEL,
                DISCONNECT_SLACK_COMMAND_KEY
            );
        } else {
            utilMgr.addMusicMenuItem(WEB_SLACK_LABEL, WEB_SLACK_COMMAND_KEY);
            utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
        }
        $('.divider').show();
    }
};

utilMgr.getMusicTimeMarkdownFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\MusicTime.html';
    } else {
        file += '/MusicTime.html';
    }
    return file;
};

utilMgr.getMusicDataFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\musicData.json';
    } else {
        file += '/musicData.json';
    }
    return file;
};
utilMgr.createUriFromTrackId = track_id => {
    if (track_id && !track_id.includes('spotify:track:')) {
        track_id = `spotify:track:${track_id}`;
    }

    return track_id;
};

utilMgr.createUriFromPlaylistId = playlist_id => {
    if (playlist_id && !playlist_id.includes('spotify:playlist:')) {
        playlist_id = `spotify:playlist:${playlist_id}`;
    }

    return playlist_id;
};

utilMgr.getSongSessionDataFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\songSessionData.json';
    } else {
        file += '/songSessionData.json';
    }
    return file;
};

utilMgr.createSpotifyIdFromUri = id => {
    if (id && id.indexOf('spotify:') === 0) {
        return id.substring(id.lastIndexOf(':') + 1);
    }
    return id;
};

utilMgr.storeMusicSessionPayload = payload => {
    // store the payload into the data.json file
    const musicFile = utilMgr.getSongSessionDataFile();

    // also store the payload into the musicData.json file
    try {
        fs.appendFileSync(musicFile, JSON.stringify(payload) + os.EOL);
    } catch (err) {
        logIt(
            `Error appending to the music session data store file: ${err.message}`
        );
    }
};

utilMgr.sendSessionPayload = songSession => {
    let api = `/music/session`;
    return utilMgr
        .softwarePost(api, songSession, utilMgr.getItem('jwt'))
        .then(resp => {
            if (!utilMgr.isResponseOk(resp)) {
                return { status: 'fail' };
            }
            return { status: 'ok' };
        })
        .catch(e => {
            return { status: 'fail' };
        });
};

utilMgr.updateMenuPreference = (command, flag) => {
    // only concerned with the music setting to update the dropdown menu
    if (command === SHOW_MUSIC_METRICS_CONFIG_KEY) {
        let prefLabel = TOP_MUSIC_MENU_LABEL;
        if (!flag) {
            utilMgr.removeMusicMenuItem(prefLabel);
        } else {
            utilMgr.addMusicMenuItem(prefLabel, command);
        }
    }
};

utilMgr.sendPreferencesUpdate = async (userId, userPrefs) => {
    let api = `/users/${userId}`;
    let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');
    userPrefs['showMusic'] = showMusicMetrics;
    userPrefs['showGit'] = showGitMetrics;
    userPrefs['showRank'] = showWeeklyRanking;

    // update the preferences
    // /:id/preferences
    api = `/users/${userId}/preferences`;
    let resp = await utilMgr.softwarePut(
        api,
        userPrefs,
        utilMgr.getItem('jwt')
    );
    if (utilMgr.isResponseOk(resp)) {
        console.log('Code Time: update user code time preferences');
    }
};

utilMgr.getUserId = async () => {
    let jwt = utilMgr.getItem('jwt');
    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                let userId = parseInt(resp.data.data.id, 10);
                return userId;
            }
        }
    }
    return null;
};

utilMgr.updatePreferences = async () => {
    let showMusicMetrics = atom.config.get(SHOW_MUSIC_METRICS_CONFIG_KEY);
    let showGitMetrics = atom.config.get('code-time.showGitMetrics');
    let showWeeklyRanking = atom.config.get('code-time.showWeeklyRanking');

    // get the user's preferences and update them if they don't match what we have
    let jwt = utilMgr.getItem('jwt');

    let serverIsOnline = await utilMgr.serverIsAvailable();
    if (jwt && serverIsOnline) {
        let userId = await utilMgr.getUserId();
        let api = `/users/${userId}`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                let prefs = resp.data.data.preferences;
                let prefsShowMusic =
                    prefs.showMusic !== null && prefs.showMusic !== undefined
                        ? prefs.showMusic
                        : null;
                let prefsShowGit =
                    prefs.showGit !== null && prefs.showGit !== undefined
                        ? prefs.showGit
                        : null;
                let prefsShowRank =
                    prefs.showRank !== null && prefs.showRank !== undefined
                        ? prefs.showRank
                        : null;

                if (
                    prefsShowMusic === null ||
                    prefsShowGit === null ||
                    prefsShowRank === null ||
                    prefsShowMusic !== showMusicMetrics ||
                    prefsShowGit !== showGitMetrics ||
                    prefsShowRank !== showWeeklyRanking
                ) {
                    await utilMgr.sendPreferencesUpdate(userId, prefs);
                }
            }
        }
    }
};

utilMgr.sendHeartbeat = async reason => {
    let serverIsOnline = await utilMgr.serverIsAvailable();
    let jwt = utilMgr.getItem('jwt');
    if (serverIsOnline && jwt) {
        let heartbeat = {
            pluginId: PLUGIN_ID,
            os: utilMgr.getOs(),
            start: utilMgr.nowInSecs(),
            version: utilMgr.getVersion(),
            hostname: await utilMgr.getHostname(),
            session_ctime: utilMgr.getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: utilMgr.getEditorSessionToken(),
        };

        let api = `/data/heartbeat`;
        utilMgr.softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!utilMgr.isResponseOk(resp)) {
                console.log('Code Time: unable to send heartbeat ping');
            }
        });
    }
};

utilMgr.getDashboardRow = (label, value) => {
    let content = `${utilMgr.getDashboardLabel(
        label
    )} : ${utilMgr.getDashboardValue(value)}\n`;
    return content;
};

utilMgr.getSectionHeader = label => {
    let content = `${label}\n`;
    // add 3 to account for the " : " between the columns
    let dashLen = DASHBOARD_LABEL_WIDTH + DASHBOARD_VALUE_WIDTH + 15;
    for (let i = 0; i < dashLen; i++) {
        content += '-';
    }
    content += '\n';
    return content;
};

utilMgr.getDashboardLabel = (label, width = DASHBOARD_LABEL_WIDTH) => {
    return utilMgr.getDashboardDataDisplay(width, label);
};

utilMgr.getDashboardValue = value => {
    let valueContent = utilMgr.getDashboardDataDisplay(
        DASHBOARD_VALUE_WIDTH,
        value
    );
    let paddedContent = '';
    for (let i = 0; i < 11; i++) {
        paddedContent += ' ';
    }
    paddedContent += valueContent;
    return paddedContent;
};

utilMgr.getDashboardDataDisplay = (widthLen, data) => {
    let len =
        data.constructor === String
            ? widthLen - data.length
            : widthLen - String(data).length;
    let content = '';
    for (let i = 0; i < len; i++) {
        content += ' ';
    }
    return `${content}${data}`;
};

utilMgr.getNowTimes = () => {
    let d = new Date();
    d = new Date(d.getTime());
    // offset is the minutes from GMT.
    // it's positive if it's before, and negative after
    const offset = d.getTimezoneOffset();
    const offset_sec = offset * 60;
    let now_in_sec = Math.round(d.getTime() / 1000);
    // subtract the offset_sec (it'll be positive before utc and negative after utc)
    return {
        now_in_sec,
        local_now_in_sec: now_in_sec - offset_sec,
    };
};

utilMgr.getExtensionName = () => {
    if (extensionName) {
        return extensionName;
    }
    let extInfoFile = __dirname;
    if (utilMgr.isWindows()) {
        extInfoFile += '\\extensioninfo.json';
    } else {
        extInfoFile += '/extensioninfo.json';
    }
    if (fs.existsSync(extInfoFile)) {
        const content = fs.readFileSync(extInfoFile).toString();
        if (content) {
            try {
                const data = JSON.parse(content);
                if (data) {
                    extensionName = data.name;
                }
            } catch (e) {
                utilMgr.logIt(`unable to read ext info name: ${e.message}`);
            }
        }
    }
    if (!extensionName) {
        extensionName = 'code-time';
    }
    return extensionName;
};

utilMgr.logIt = message => {
    console.log(`${utilMgr.getExtensionName()}: ${message}`);
};

utilMgr.refetchSpotifyConnectStatusLazily = async (tryCountUntilFound = 20) => {
    const structureViewObj = new StructureView();
    structureViewObj.showLoader();
    setTimeout(() => {
        utilMgr.spotifyConnectStatusHandler(tryCountUntilFound);
    }, 10000);
};

utilMgr.spotifyConnectStatusHandler = tryCountUntilFound => {
    var __awaiter =
        (this && this.__awaiter) ||
        function(thisArg, _arguments, P, generator) {
            return new (P || (P = Promise))(function(resolve, reject) {
                function fulfilled(value) {
                    try {
                        step(generator.next(value));
                    } catch (e) {
                        reject(e);
                    }
                }
                function rejected(value) {
                    try {
                        step(generator['throw'](value));
                    } catch (e) {
                        reject(e);
                    }
                }
                function step(result) {
                    result.done
                        ? resolve(result.value)
                        : new P(function(resolve) {
                              resolve(result.value);
                          }).then(fulfilled, rejected);
                }
                step(
                    (generator = generator.apply(
                        thisArg,
                        _arguments || []
                    )).next()
                );
            });
        };
    return __awaiter(this, void 0, void 0, function*() {
        let serverIsOnline = yield utilMgr.serverIsAvailable();
        let oauthResult = yield utilMgr.getMusicTimeUserStatus(serverIsOnline);

        if (!oauthResult.loggedOn) {
            // try again if the count is not zero
            if (tryCountUntilFound > 0) {
                tryCountUntilFound -= 1;
                utilMgr.refetchSpotifyConnectStatusLazily(tryCountUntilFound);
            }
            utilMgr.setItem('isSpotifyConnected', false);
        } else if (
            tryCountUntilFound > 0 &&
            !utilMgr.getItem('isSpotifyConnected')
        ) {
            tryCountUntilFound = 0;
            const musicMgr = KpmMusicManager.getInstance();
            const dataMgr = MusicDataManager.getInstance();

            utilMgr.setItem('isSpotifyConnected', true);

            utilMgr.updateLoginPreference(true);

            utilMgr.notify(
                'Music Time',
                `Successfully connected to Spotify. Loading playlists...`
            );

            // populate the liked songs and send them as the seed data
            yield utilMgr.populateLikedSongs();
            if (dataMgr.spotifyLikedSongs.length) {
                let nowTime = utilMgr.getNowTimes();
                let startingTime = nowTime;
                dataMgr.spotifyLikedSongs.forEach((track: Track) => {
                    track['playlistId'] = SPOTIFY_LIKED_SONGS_PLAYLIST_ID;
                    track.loved = true;
                    track['start'] = startingTime;
                    startingTime -= 60;
                    track['end'] = startingTime;
                    track['duration'] = 60;

                    track['local_start'] = track['start'] - nowTime.offset_sec;
                    track['local_end'] = track['end'] - nowTime.offset_sec;
                    // set a convenience "spotifyTrackId" attribute based on the URI
                    if (track.uri) {
                        track['spotifyTrackId'] = track.uri;
                        // make sure the trackId is the URI if it's a spotify track
                        track.id = track.uri;
                    }
                    startingTime -= 1;
                });
            }
            yield utilMgr.seedLikedSongSessions(
                utilMgr.getBootstrapFileMetrics()
            );

            setTimeout(() => {
                utilMgr.clearNotification();
            }, 1000);

            yield musicMgr.refreshPlaylists(true);
        }
    });
};

utilMgr.populateLikedSongs = async () => {
    MusicDataManager.getInstance().spotifyLikedSongs = await getSpotifyLikedSongs();
};

utilMgr.seedLikedSongSessions = async fileMetrics => {
    const dataMgr = MusicDataManager.getInstance();

    const batch_size = 30;
    if (dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length > 0) {
        let batch = [];
        // batch send the liked songs
        for (let i = 0; i < dataMgr.spotifyLikedSongs.length; i++) {
            const track = dataMgr.spotifyLikedSongs[i];
            track['liked'] = true;
            if (
                !track.playlistId ||
                track.playlistId === SPOTIFY_LIKED_SONGS_PLAYLIST_ID
            ) {
                track['playlistId'] = SPOTIFY_LIKED_SONGS_PLAYLIST_NAME;
            }
            // add the empty file metrics
            const songSession = {
                ...track,
                ...fileMetrics,
            };
            batch.push(songSession);
            if (batch.length >= batch_size) {
                await utilMgr.sendBatchedLikedSongSessions(batch);
                batch = [];
            }
        }

        // send the remaining
        if (batch.length > 0) {
            await utilMgr.sendBatchedLikedSongSessions(batch);
        }
    }
};

utilMgr.sendBatchedLikedSongSessions = tracksToSave => {
    const api = `/music/session/seed`;

    softwarePut(api, { tracks: tracksToSave }, utilMgr.getItem('jwt'))
        .then(resp => {
            if (!isResponseOk(resp)) {
                return { status: 'fail' };
            }
            return { status: 'ok' };
        })
        .catch(e => {
            return { status: 'fail' };
        });
};

utilMgr.getBootstrapFileMetrics = () => {
    const fileMetrics = {
        add: 0,
        paste: 0,
        delete: 0,
        netkeys: 0,
        linesAdded: 0,
        linesRemoved: 0,
        open: 0,
        close: 0,
        keystrokes: 0,
        syntax: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: utilMgr.getOffsetSecends() / 60,
        pluginId: utilMgr.getPluginId(),
        os: utilMgr.getOs(),
        version: utilMgr.getVersion(),
        source: [],
        repoFileCount: 0,
        repoContributorCount: 0,
    };
    return fileMetrics;
};

utilMgr.getMusicTimeUserStatus = async serverIsOnline => {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = utilMgr.getItem('jwt');
    const spotify_refresh_token = utilMgr.getItem('spotify_refresh_token');
    const musicMgr = KpmMusicManager.getInstance();
    if (serverIsOnline && (jwt || spotify_refresh_token)) {
        const api = '/users/plugin/state';
        const additionalHeaders = spotify_refresh_token
            ? { spotify_refresh_token }
            : null;
        const resp = await utilMgr.softwareGet(api, jwt, additionalHeaders);
        if (utilMgr.isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            const state = resp.data.state ? resp.data.state : 'UNKNOWN';
            if (state === 'OK') {
                /**
                 * stateData only contains:
                 * {email, jwt, state}
                 */
                const stateData = resp.data;
                const sessionEmail = utilMgr.getItem('name');
                if (sessionEmail !== stateData.email) {
                    utilMgr.setItem('name', stateData.email);
                }
                // check the jwt
                if (stateData.jwt && stateData.jwt !== jwt) {
                    // update it
                    utilMgr.setItem('jwt', stateData.jwt);
                }

                // get the user from the payload
                const user = resp.data.user;
                let foundSpotifyAuth = false;

                if (user.auths && user.auths.length > 0) {
                    for (let i = 0; i < user.auths.length; i++) {
                        const auth = user.auths[i];

                        // update the spotify access info if the auth matches
                        if (auth.type === 'spotify' && auth.access_token) {
                            foundSpotifyAuth = true;
                            // update spotify access info
                            await musicMgr.updateSpotifyAccessInfo(auth);
                            break;
                        }
                    }
                }

                return { loggedOn: foundSpotifyAuth, state };
            }
            // return the state that is returned
            return { loggedOn: false, state };
        }
    }
    return { loggedOn: false, state: 'UNKNOWN' };
};

utilMgr.getSpotifyUser = async (serverIsOnline, jwt) => {
    if (jwt && serverIsOnline) {
        const api = `/auth/spotify/user`;
        const resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data) {
                return resp.data;
            }
        }
    }
    return null;
};

utilMgr.getUser = async (serverIsOnline, jwt) => {
    if (jwt && serverIsOnline) {
        let api = `/users/me`;
        let resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                return resp.data.data;
            }
        }
    }
    return null;
};

utilMgr.getSpotifyUser = async (serverIsOnline, jwt) => {
    if (jwt && serverIsOnline) {
        const api = `/auth/spotify/user`;
        const resp = await utilMgr.softwareGet(api, jwt);
        if (utilMgr.isResponseOk(resp)) {
            if (resp && resp.data) {
                return resp.data;
            }
        }
    }
    return null;
};

utilMgr.getScrollDistance = ($child, $parent) => {
    const viewTop = $parent.offset().top,
        viewBottom = viewTop + $parent.height(),
        scrollTop = $parent.scrollTop(),
        // scrollBottom = scrollTop + $parent.height(),
        elemTop = $child.offset().top,
        elemBottom = elemTop + $child.height();

    const ret = {
        needScroll: true,
        distance: 0,
    };
    // Element is upon or under the view
    if (elemTop < viewTop || elemBottom > viewBottom)
        ret.distance = scrollTop + elemTop - viewTop;
    else ret.needScroll = false;

    return ret;
};

utilMgr.selectTreeNode = ($target, vm, opts) => {
    if ($target.is('span')) $target = $target.parent();
    if ($target.is('div')) $target = $target.parent();
    if ($target.is('li')) {
        // ".toggle" would be TRUE if it's double click
        if (opts && opts.toggle) {
            $target.hasClass('list-nested-item') &&
                $target[
                    $target.hasClass('collapsed') ? 'removeClass' : 'addClass'
                ]('collapsed');
        }
        let oldVal = vm.treeNodeId,
            val = $target.attr('node-id');

        // Same node
        if (oldVal === val) return;

        oldVal &&
            $('div.structure-view>div.tree-panel>ol')
                .find('li.selected')
                .removeClass('selected');
        $target.addClass('selected');
        vm.treeNodeId = val;
    }
};

utilMgr.notify = (title, msg, dismissable = true) => {
    utilMgr.clearNotification();
    atom.notifications.addInfo(title, {
        detail: msg,
        dismissable: dismissable,
    });
};

utilMgr.notifyWarn = (title, msg) => {
    atom.notifications.addError(title, { detail: msg, dismissable: true });
};

utilMgr.notifyButton = (title, msg, buttons) => {
    atom.notifications.addInfo(title, {
        detail: msg,
        buttons: buttons,
        dismissable: true,
    });
};

utilMgr.clearNotification = () => {
    atom.notifications.getNotifications().forEach(notification => {
        notification.dismiss();
    });
    atom.notifications.clear();
};

utilMgr.createSpotifyIdFromUri = id => {
    if (id && id.indexOf('spotify:') === 0) {
        return id.substring(id.lastIndexOf(':') + 1);
    }
    return id;
};

utilMgr.alert = (title, msg) => {
    atom.confirm({
        message: title,
        detailedMessage: msg,
        buttons: {
            Close: function() {
                return;
            },
        },
    });
};

// utilMgr.launchLogin = async () => {
//     let loginUrl = await utilMgr.buildLoginUrl();
//     utilMgr.launchWebUrl(loginUrl);
//     utilMgr.refetchUserStatusLazily();
// };

utilMgr.launchWebUrl = url => {
    open(url);
};

utilMgr.buildLoginUrl = async () => {
    let jwt = utilMgr.getItem('jwt');
    if (jwt) {
        const encodedJwt = encodeURIComponent(jwt);
        const loginUrl = `${launch_url}/onboarding?token=${encodedJwt}&plugin=${getPluginType()}`;
        return loginUrl;
    } else {
        // no need to build an onboarding url if we dn't have the token
        return launch_url;
    }
};

utilMgr.getPluginName = () => {
    return MUSIC_TIME_EXT_ID;
};

utilMgr.getPluginType = () => {
    return MUSIC_TIME_TYPE;
};

utilMgr.isValidJson = val => {
    if (val === null || val === undefined) {
        return false;
    }
    if (typeof val === 'string' || typeof val === 'number') {
        return false;
    }
    try {
        const stringifiedVal = JSON.stringify(val);
        JSON.parse(stringifiedVal);
        return true;
    } catch (e) {
        //
    }
    return false;
};

utilMgr.getMusicSessionDataStoreFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\MusicSession.json';
    } else {
        file += '/MusicSession.json';
    }
    return file;
};

utilMgr.getOffsetSecends = () => {
    let d = new Date();
    return d.getTimezoneOffset() * 60;
};

utilMgr.deleteFile = file => {
    // if the file exists, get it
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
};

utilMgr.text_truncate = (str, length, ending) => {
    if (length == null) {
        length = 100;
    }
    if (ending == null) {
        ending = '...';
    }
    if (str && str.length > length) {
        return str.substring(0, length - ending.length) + ending;
    } else {
        return str;
    }
};

utilMgr.isEmptyObj = obj => {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
};

utilMgr.refetchSlackConnectStatusLazily = (tryCountUntilFound = 20) => {
    setTimeout(() => {
        utilMgr.slackConnectStatusHandler(tryCountUntilFound);
    }, 10000);
};

utilMgr.getSlackOauth = async serverIsOnline => {
    let jwt = utilMgr.getItem('jwt');
    if (serverIsOnline && jwt) {
        let user = await utilMgr.getUser(serverIsOnline, jwt);
        if (user && user.auths) {
            // get the one that is "slack"
            for (let i = 0; i < user.auths.length; i++) {
                if (user.auths[i].type === 'slack') {
                    return user.auths[i];
                }
            }
        }
    }
};

utilMgr.slackConnectStatusHandler = async tryCountUntilFound => {
    let serverIsOnline = await utilMgr.serverIsAvailable();
    let oauth = await utilMgr.getSlackOauth(serverIsOnline);
    if (!oauth) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            utilMgr.refetchSlackConnectStatusLazily(tryCountUntilFound);
        }
    } else {
        const musicMgr = KpmMusicManager.getInstance();
        // oauth is not null, initialize slack
        await musicMgr.updateSlackAccessInfo(oauth);

        utilMgr.removeMusicMenuItem(WEB_SLACK_LABEL);
        utilMgr.addMusicMenuItem(
            DISCONNECT_SLACK_MENU_LABEL,
            DISCONNECT_SLACK_COMMAND_KEY
        );
        utilMgr.clearNotification();
        setTimeout(() => {
            utilMgr.notify('Music Time', `Successfully connected to Slack`);
            utilMgr.clearNotification();
        }, 5000);
        //window.showInformationMessage(`Successfully connected to Slack`);

        // setTimeout(() => {
        //     commands.executeCommand('musictime.refreshPlaylist');
        // }, 1000);
    }
};

utilMgr.getMusicTimeMarkdownFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\MusicTime.html';
    } else {
        file += '/MusicTime.html';
    }
    return file;
};
utilMgr.getCodyErrorMessage = response => {
    let errMsg = null;
    if (response.state === CodyResponseType.Failed) {
        // format the message
        errMsg = '';
        if (response.message) {
            errMsg = response.message;
            var hasEndingPeriod = errMsg.lastIndexOf('.') === errMsg.length - 1;
            if (!hasEndingPeriod) {
                errMsg = `${errMsg}.`;
            }
        }
    }
    return errMsg;
};
utilMgr.getMusicTimeMarkdownFile = () => {
    let file = utilMgr.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\MusicTime.html';
    } else {
        file += '/MusicTime.html';
    }
    return file;
};
utilMgr.launchMusicAnalytics = () => {
    open(`${launch_url}/music`);
};

utilMgr.buildQueryString = obj => {
    let params = [];
    if (obj) {
        let keys = Object.keys(obj);
        if (keys && keys.length > 0) {
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let val = obj[key];
                if (val && val !== undefined) {
                    let encodedVal = encodeURIComponent(val);
                    params.push(`${key}=${encodedVal}`);
                }
            }
        }
    }
    if (params.length > 0) {
        return '?' + params.join('&');
    } else {
        return '';
    }
};

utilMgr.isOnRepeatStartingOver = (playingTrack, trackProgressInfo) => {
    if (
        playingTrack.progress_ms === null ||
        playingTrack.progress_ms === undefined
    ) {
        return false;
    }

    if (
        playingTrack.id &&
        trackProgressInfo.id === playingTrack.id &&
        playingTrack.progress_ms >= 0 &&
        playingTrack.status === TrackStatus.Playing &&
        trackProgressInfo.progress_ms > playingTrack.progress_ms &&
        trackProgressInfo.endInRange
    ) {
        return true;
    }
    return false;
};

utilMgr.trackIsDone = playingTrack => {
    if (
        playingTrack.progress_ms === null ||
        playingTrack.progress_ms === undefined
    ) {
        return false;
    }

    const playingTrackId = playingTrack.id || null;
    const hasProgress =
        playingTrackId && playingTrack.progress_ms > 0 ? true : false;
    const isPausedOrNotPlaying =
        !playingTrackId || playingTrack.state !== TrackStatus.Playing
            ? true
            : false;

    // check to see if it's not playing and doesn't have any progress
    if (isPausedOrNotPlaying && !hasProgress) {
        return true;
    }

    return false;
};

utilMgr.getUtcAndLocal = () => {
    const utc = utilMgr.nowInSecs();
    const offset_sec = utilMgr.timeOffsetSeconds();
    const local = utc - offset_sec;

    return { utc, local };
};
utilMgr.timeOffsetSeconds = () => {
    const d = new Date();
    // offset is the minutes from GMT. it's positive if it's before, and negative after
    const offset = d.getTimezoneOffset();
    return offset * 60;
};
utilMgr.trackIsLongPaused = (playingTrack, trackProgressInfo) => {
    if (
        playingTrack.progress_ms === null ||
        playingTrack.progress_ms === undefined
    ) {
        return false;
    }

    const playingTrackId = playingTrack ? playingTrack.id : null;
    const hasProgress =
        playingTrackId && playingTrack.progress_ms > 0 ? true : false;

    // check to see if it's paused more than a minute
    const utcLocalTimes = utilMgr.getUtcAndLocal();
    const pauseThreshold = 60;
    const diff = utcLocalTimes.utc - trackProgressInfo.lastUpdateUtc;
    if (
        hasProgress &&
        trackProgressInfo.lastUpdateUtc > 0 &&
        diff > pauseThreshold
    ) {
        return true;
    }

    return false;
};

utilMgr.storePayload = payload => {
    // store the payload into the data.json file
    const file = utilMgr.getSoftwareDataStoreFile();

    // also store the payload into the data.json file
    try {
        fs.appendFileSync(file, JSON.stringify(payload) + os.EOL);
    } catch (err) {
        logIt(
            `Error appending to the code time data store file: ${err.message}`
        );
    }
};

utilMgr.storeKpmDataForMusic = payload => {
    // store the payload into the musicData.json file
    const file = utilMgr.getMusicDataFile();

    // also store the payload into the data.json file
    try {
        fs.appendFileSync(file, JSON.stringify(payload) + os.EOL);
    } catch (err) {
        logIt(
            `Error appending to the code time data store file: ${err.message}`
        );
    }
};
utilMgr.sendBatchPayload = async batch => {
    await utilMgr
        .softwarePost('/data/batch', batch, utilMgr.getItem('jwt'))
        .catch(e => {
            utilMgr.logIt(
                `Unable to send plugin data batch, error: ${e.message}`
            );
        });
};
utilMgr.sortTracks = InputTracks => {
    let tracks = InputTracks;
    if (tracks && tracks.length > 0) {
        tracks.sort((a, b) => {
            const nameA = a.name.toLowerCase(),
                nameB = b.name.toLowerCase();
            if (nameA < nameB)
                //sort string ascending
                return -1;
            if (nameA > nameB) return 1;
            return 0; //default return value (no sorting)
        });
    }
    return tracks;
};
utilMgr.buildTracksForRecommendations = async playlists => {
    const dataMgr = MusicDataManager.getInstance();

    // no need to refresh recommendations if we already have track IDs
    if (
        dataMgr.trackIdsForRecommendations &&
        dataMgr.trackIdsForRecommendations.length > 0
    ) {
        return;
    }

    const musicMgr = KpmMusicManager.getInstance();
    let trackIds = [];
    let foundTracksForRec = false;

    // build tracks for recommendations
    if (dataMgr.spotifyLikedSongs && dataMgr.spotifyLikedSongs.length) {
        trackIds = dataMgr.spotifyLikedSongs.map(track => {
            return track.id;
        });
        foundTracksForRec = true;
    } else {
        // go through the found playlists and the first one that returns 3 or more wins
        if (playlists && playlists.length > 0) {
            for (let i = 0; i < playlists.length; i++) {
                const playlist = playlists[i];

                const playlistItems = await musicMgr.getPlaylistItemTracksForPlaylistId(
                    playlist.id
                );
                if (playlistItems && playlistItems.length >= 3) {
                    foundTracksForRec = true;
                    trackIds = playlistItems.map(item => {
                        return item.id;
                    });
                    break;
                }
            }
        }
    }

    dataMgr.trackIdsForRecommendations = trackIds;

    if (foundTracksForRec) {
        // refresh the recommendations
        setTimeout(() => {
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:refreshRecommendationsTree'
            );
        }, 1000);
    }
};

utilMgr.getLocalREADMEFile = () => {
    let file = __dirname;
    if (utilMgr.isWindows()) {
        file += '\\README.md';
    } else {
        file += '/README.md';
    }
    return file;
};
utilMgr.displayReadmeIfNotExists = (override = false) => {
    const displayedReadme = utilMgr.getItem('displayedMtReadme');
    if (!displayedReadme || override) {
        // setTimeout(() => {
        //     commands.executeCommand("musictime.revealTree");
        // }, 1000);

        const readmeUri = Uri.file(getLocalREADMEFile());

        commands.executeCommand(
            'markdown.showPreview',
            readmeUri,
            ViewColumn.One
        );
        setItem('displayedMtReadme', true);
    }
};

utilMgr.getLocalREADMEFile = () => {
    return path.join(__dirname, '..', 'README.md');
};

utilMgr.getImagesDir = () => {
    let dir = __dirname;
    if (utilMgr.isWindows()) {
        dir += '\\images';
    } else {
        dir += '/images';
    }
    return dir;
};

utilMgr.displayReadmeIfNotExists = (override = false) => {
    const readmeFile = utilMgr.getLocalREADMEFile();
    const fileUri = `markdown-preview://${readmeFile}`;

    // implement me... (copied from vscode)
    const displayedReadme = utilMgr.getItem('atom_MtReadme');
    if (!displayedReadme || override) {
        atom.workspace.open(fileUri, {
            changeFocus: true,
            activatePane: true,
            activateItem: true,
        });
        utilMgr.setItem('atom_MtReadme', true);
    }
};

module.exports = utilMgr;
