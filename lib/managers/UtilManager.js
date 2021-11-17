'use babel';

import KpmMusicManager from '../music/KpmMusicManager';
import {
    isResponseOk,
    softwareGet,
    softwarePut
} from '../client/HttpClient';
import { execCmd } from "./ExecManager";
import { getStatusView } from "./StatusViewManager";
import { requiresSpotifyAccess } from "./IntegrationManager";
import {
    launch_url,
    api_endpoint,
    SHOW_RANKING_METRICS_CONFIG_KEY,
    CONNECT_SPOTIFY_MENU_LABEL,
    DISCONNECT_SPOTIFY_MENU_LABEL,
    DISCONNECT_SPOTIFY_COMMAND_KEY,
    WEB_ISSUE_GITHUB_LABEL,
    WEB_ISSUE_GITHUB_COMMAND_KEY,
    WEB_FEEDBACK_LABEL,
    WEB_FEEDBACK_COMMAND_KEY,
    WEB_SLACK_LABEL,
    WEB_SLACK_COMMAND_KEY,
    DISCONNECT_SLACK_MENU_LABEL,
    DISCONNECT_SLACK_COMMAND_KEY,
    PLUGIN_ID,
    MUSIC_TIME_EXT_ID,
    MUSIC_TIME_TYPE
} from '../Constants';
import $ from 'jquery';
import {
    TrackStatus,
    CodyResponseType,
    getSpotifyLikedSongs,
} from 'cody-music';
import StructureView from '../music/structure-view';
import { MusicDataManager } from '../music/MusicDataManager';
import path from 'path';

const queryString = require("query-string");
const fileIt = require("file-it");
const fileUtil = require("../utils/FileUtil");
const commonUtil = require("../utils/CommonUtil");
const timeUtil = require('../utils/TimeUtil');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const open = require('open');

const utilMgr = {};

const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NUMBER_IN_EMAIL_REGEX = new RegExp('^\\d+\\+');

const NO_PROJECT_DIR_NAME = 'Unnamed';

const LONG_THRESHOLD_HOURS = 12;
const SHORT_THRESHOLD_HOURS = 1;
const MILLIS_PER_HOUR = 1000 * 60 * 60;

let telemetryOn = true;

let editorSessiontoken = null;
let showStatusBarText = true;
let isOnline = null;
let lastOnlineCheck = 0;
let lastMsg = null;
let lastIcon = null;
let whoami = null;
let extensionName = null;
let _spotifyUser = null;

let username = null;
let osInfo = null;

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
    let hostname = execCmd('hostname');
    return hostname;
};

utilMgr.getOs = () => {
  if (osInfo) {
    return osInfo;
  }
  osInfo = '';
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
      osInfo = parts.join('_');
  }
  return osInfo;
};

utilMgr.nowInSecs = () => {
    let d = new Date();
    return Math.round(d.getTime() / 1000);
};

utilMgr.getDefaultProjectName = () => {
    return NO_PROJECT_DIR_NAME;
};

utilMgr.getRankingConfigKey = () => {
    return SHOW_RANKING_METRICS_CONFIG_KEY;
};

utilMgr.getPluginId = () => {
    return PLUGIN_ID;
};

utilMgr.getOpenProjects = () => {
    let openProjectNames = [];
    if (atom.project && atom.project.getPaths()) {
        openProjectNames = atom.project.getPaths();
    }
    return openProjectNames;
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

utilMgr.getSoftwareSessionAsJson = () => {
    let data = fileIt.readJsonFileSync(fileUtil.getSoftwareSessionFile());
    return data ? data : {};
};

utilMgr.softwareSessionFileExists = () => {
    // don't auto create the file
    const file = fileUtil.getSoftwareSessionFile();
    // check if it exists
    return fs.existsSync(file);
};

utilMgr.getSummaryInfoFile = () => {
  return utilMgr.getFileName('SummaryInfo.txt');
};

/**
 * Get the .software directory path/name
 **/
utilMgr.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (commonUtil.isWindows()) {
        softwareDataDir += '\\.software';
    } else {
        softwareDataDir += '/.software';
    }

    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
};

utilMgr.getFileType = (fileName) => {
    let fileType = '';
    const lastDotIdx = fileName.lastIndexOf('.');
    const len = fileName.length;
    if (lastDotIdx !== -1 && lastDotIdx < len - 1) {
        fileType = fileName.substring(lastDotIdx + 1);
    }
    return fileType;
};

utilMgr.isGitProject = (projectDir) => {
    if (!projectDir) {
        return false;
    }

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
        return false;
    }
    return true;
};

utilMgr.showStatus = async (TrackInfo) => {
    getStatusView().display(TrackInfo);
};

utilMgr.updateStatus = () => {
    getStatusView().display();
};

utilMgr.launchSoftwareTopForty = async () => {
    commonUtil.launchUrl('https://api.software.com/music/top40');
};

utilMgr.getLoginUrl = (loginType, switching_account = false) => {

    fileUtil.setItem("authType", loginType);
    fileUtil.setItem("switching_account", switching_account);
    const jwt = fileUtil.getItem("jwt");
    const name = fileUtil.getItem("name");

    const auth_callback_state = fileUtil.getAuthCallbackState();

    let url = launch_url;
    fileUtil.setItem('authType', loginType);

    let obj = {
        plugin: utilMgr.getPluginType(),
        pluginVersion: utilMgr.getVersion(),
        plugin_id: utilMgr.getPluginId(),
        auth_callback_state
    }

    // send the token info if not yet registered
    if (!name) {
      obj["plugin_uuid"] = fileUtil.getPluginUuid();
      obj["plugin_token"] = jwt;
    }

    if (loginType === "github") {
        // github signup/login flow
        obj["redirect"] = launch_url;
        url = `${api_endpoint}/auth/github`;
    } else if (loginType === "google") {
        // google signup/login flow
        obj["redirect"] = launch_url;
        url = `${api_endpoint}/auth/google`;
    } else {
      obj["token"] = utilMgr.getItem("jwt");
      obj["auth"] = "software";
      if (!switching_account) {
        // its a signup request
        url = `${launch_url}/email-signup`;
      } else {
        obj["login"] = true;
        // switch account is associated with login
        url = `${launch_url}/onboarding`;
      }
    }

    const qryStr = queryString.stringify(obj);

    return `${url}?${qryStr}`;
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

utilMgr.updateLoginPreference = spotifyConnected => {
    utilMgr.addMusicMenuItem(
        WEB_ISSUE_GITHUB_LABEL,
        WEB_ISSUE_GITHUB_COMMAND_KEY
    );
    utilMgr.addMusicMenuItem(WEB_FEEDBACK_LABEL, WEB_FEEDBACK_COMMAND_KEY);

    if (spotifyConnected) {
        const structureViewObj = StructureView.getInstance();
        structureViewObj.toggleConnectSpotify(true);

        utilMgr.removeMusicMenuItem(CONNECT_SPOTIFY_MENU_LABEL);
        utilMgr.addMusicMenuItem(
            DISCONNECT_SPOTIFY_MENU_LABEL,
            DISCONNECT_SPOTIFY_COMMAND_KEY
        );
    }

    if (utilMgr.getSlackWorkspaces().length) {
      utilMgr.removeMusicMenuItem(WEB_SLACK_LABEL);
      utilMgr.addMusicMenuItem(
          DISCONNECT_SLACK_MENU_LABEL,
          DISCONNECT_SLACK_COMMAND_KEY
      );
    } else {
      utilMgr.addMusicMenuItem(WEB_SLACK_LABEL, WEB_SLACK_COMMAND_KEY);
      utilMgr.removeMusicMenuItem(DISCONNECT_SLACK_MENU_LABEL);
    }
};

utilMgr.normalizeGithubEmail = (email, filterOutNonEmails = true) => {
    if (email) {
        if (
            filterOutNonEmails &&
            (email.endsWith('github.com') || email.includes('users.noreply'))
        ) {
            return null;
        } else {
            const found = email.match(NUMBER_IN_EMAIL_REGEX);
            if (found && email.includes('users.noreply')) {
                // filter out the ones that look like
                // 2342353345+username@users.noreply.github.com"
                return null;
            }
        }
    }

    return email;
};

utilMgr.getMusicTimeMarkdownFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
        file += '\\MusicTime.html';
    } else {
        file += '/MusicTime.html';
    }
    return file;
};

utilMgr.getMusicDataFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
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
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
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

utilMgr.updateMenuPreference = (command, flag) => {
    // only concerned with the music setting to update the dropdown menu
};

utilMgr.sendPreferencesUpdate = async (userId, userPrefs) => {
    let api = `/users/${userId}`;

    // update the preferences
    // /:id/preferences
    api = `/users/${userId}/preferences`;
    let resp = await softwarePut(api, userPrefs, fileUtil.getItem('jwt'));
    if (isResponseOk(resp)) {
        console.log('Music Time: update user Music Time preferences');
    }
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
    if (commonUtil.isWindows()) {
        extInfoFile += '\\extensioninfo.json';
    } else {
        extInfoFile += '/extensioninfo.json';
    }
    const data = fileIt.readJsonFileSync(extInfoFile);
    if (data) {
        extensionName = data.name;
    }

    if (!extensionName) {
        extensionName = 'code-time';
    }
    return extensionName;
};

utilMgr.logIt = message => {
    console.log(`${utilMgr.getExtensionName()}: ${message}`);
};

utilMgr.populateLikedSongs = async () => {
    MusicDataManager.getInstance().spotifyLikedSongs = await getSpotifyLikedSongs();
};

utilMgr.seedLikedSongsInitiate = async () => {
    const dataMgr = MusicDataManager.getInstance();

    // populate the liked songs and send them as the seed data
    await utilMgr.populateLikedSongs();

    await KpmMusicManager.getInstance().refreshPlaylists(true);
}

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
        offset: utilMgr.getOffsetSeconds() / 60,
        pluginId: utilMgr.getPluginId(),
        os: utilMgr.getOs(),
        version: utilMgr.getVersion(),
        source: [],
        repoFileCount: 0,
        repoContributorCount: 0,
    };
    return fileMetrics;
};

utilMgr.getUser = async (jwt) => {
    if (jwt) {
        let api = `/users/me`;
        let resp = await softwareGet(api, jwt);

        if (isResponseOk(resp)) {
            if (resp && resp.data && resp.data.data) {
                return resp.data.data;
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

utilMgr.launchWebUrl = url => {
    open(url);
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

utilMgr.getOffsetSeconds = () => {
    let d = new Date();
    return d.getTimezoneOffset() * 60;
};

utilMgr.isEmptyObj = obj => {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
};

utilMgr.getSlackOauth = async () => {
    let jwt = fileUtil.getItem('jwt');
    if (jwt) {
        let user = await utilMgr.getUser(jwt);

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

utilMgr.getMusicTimeMarkdownFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
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
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
        file += '\\MusicTime.html';
    } else {
        file += '/MusicTime.html';
    }
    return file;
};
utilMgr.launchMusicAnalytics = () => {
    open(`${launch_url}`);
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

utilMgr.storeKpmDataForMusic = payload => {
    // store the payload into the musicData.json file
    const file = utilMgr.getMusicDataFile();

    // also store the payload into the data.json file
    try {
        fs.appendFileSync(file, JSON.stringify(payload) + os.EOL);
    } catch (err) {
        logIt(
            `Error appending to the Music Time data store file: ${err.message}`
        );
    }
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

    if (requiresSpotifyAccess()) {
        return [];
    }

    const dataMgr = MusicDataManager.getInstance();

    // no need to refresh recommendations if we already have track IDs
    if (
        dataMgr.trackIdsForRecommendations &&
        dataMgr.trackIdsForRecommendations.length > 0
    ) {
        return;
    }

    let trackIds = [];
    let foundTracksForRec = false;

    if (!dataMgr.spotifyLikedSongs || dataMgr.spotifyLikedSongs.length === 0) {
        await utilMgr.populateLikedSongs();
    }

    const likedSongsLen = dataMgr.spotifyLikedSongs ? dataMgr.spotifyLikedSongs.length : 0;
    if (likedSongsLen === 1) {
        // only 1 liked song, see whats found in the playlists
        trackIds = await utilMgr.getFirstSetOfTracksFromPlaylists(playlists);
    }

    // build tracks for recommendations
    if (trackIds.length === 0 && likedSongsLen > 0) {
        trackIds = dataMgr.spotifyLikedSongs.map(track => {
            return track.id;
        });
        foundTracksForRec = true;
    }

    dataMgr.trackIdsForRecommendations = trackIds;
};

utilMgr.getFirstSetOfTracksFromPlaylists = async (playlists) => {
    let trackIds = [];
    if (playlists && playlists.length > 0) {
        for (let i = 0; i < playlists.length; i++) {
            const playlist = playlists[i];

            if (playlist && playlist.id) {
                const playlistItems = await KpmMusicManager.getInstance().getPlaylistItemTracksForPlaylistId(
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
    return trackIds;
}

utilMgr.getLocalREADMEFile = () => {
    return path.join(__dirname, '..', 'README.md');
};

utilMgr.displayReadmeIfNotExists = async (override = false) => {
    const readmeFile = utilMgr.getLocalREADMEFile();
    const fileUri = `markdown-preview://${readmeFile}`;

    const displayedReadme = fileUtil.getItem('atom_MtReadme');
    if (!displayedReadme || override) {
        const openResult = await atom.workspace.open(fileUri, {
            changeFocus: true,
            activatePane: true,
            activateItem: true,
        });
        if (!openResult.loaded && openResult.loading) {
            // close it and re-open
            await atom.workspace.hide(fileUri);
            setTimeout(() => {
                atom.workspace.open(fileUri, {
                    changeFocus: true,
                    activatePane: true,
                    activateItem: true,
                });
            }, 1500);
        }
        fileUtil.setItem('atom_MtReadme', true);
    }
};

utilMgr.getImagesDir = () => {
    let dir = __dirname;
    if (commonUtil.isWindows()) {
        dir += '\\images';
    } else {
        dir += '/images';
    }
    return dir;
};

utilMgr.getTimeCounterFile = () => {
    return utilMgr.getFileName('timeCounter.json');
};

utilMgr.getTimeDataSummaryFile = () => {
    return utilMgr.getFileName('projectTimeData.json');
};

utilMgr.coalesceNumber = (val, defaultVal = 0) => {
    return val || defaultVal;
};

utilMgr.getFileName = (fileName, autoCreate = true) => {
    const file_path = fileUtil.getSoftwareDir(autoCreate);
    if (commonUtil.isWindows()) {
        return `${file_path}\\${fileName}`;
    }
    return `${file_path}/${fileName}`;
};

utilMgr.showOfflinePrompt = () => {
    // shows a prompt that we're not able to communicate with the app server
    let infoMsg =
        'Our service is temporarily unavailable. We will try to reconnect again in a minute. Your status bar will not update at this time.';
    atom.confirm({
        message: '',
        detailedMessage: infoMsg,
        buttons: {
            OK: () => {},
        },
    });
};

utilMgr.getSpotifyResponseErrorMessage = (resp) => {
    if (resp && resp.error && resp.error.response) {
        return resp.error.response.data.error.message;
    } else if (resp && resp.error && resp.status >= 300) {
        return resp.message;
    }
    return "";
};

/**
 * Return true if it's a new day
 **/
utilMgr.isNewDay = () => {
    const { day } = timeUtil.getNowTimes();
    const currentDay = fileUtil.getItem('currentDay');
    return currentDay !== day ? true : false;
};

utilMgr.getFileDataArray = (file) => {
    let payloads = fileIt.readJsonArraySync(file);
    return payloads;
};

utilMgr.getFileDataPayloadsAsJson = (file) => {
    // Still trying to find out when "undefined" is set into the data.json
    // but this will help remove it so we can process the json lines without failure
    let content = fileIt.readContentFileSync(file);
    if (content && content.indexOf('undefined') !== -1) {
        // remove "undefined" and re-save, then read
        content = content.replace('undefined', '');
        fileIt.writeContentFileSync(file, content);
    }
    return fileIt.readJsonLinesSync(file);
};

utilMgr.getSlackWorkspaces = () => {
  const integrations = fileUtil.getIntegrations();
  if (!integrations) {
    return [];
  }
  return fileUtil.getIntegrations().filter((n) => n.name.toLowerCase() === "slack" && n.status.toLowerCase() === "active");
};

module.exports = utilMgr;
