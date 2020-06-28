'use babel';

const cacheMgr = require("./cache/CacheManager");
const fs = require('fs');
const os = require('os');
const commonUtil = require("./CommonUtil");
const fileIt = require("file-it");

const fileUtil = {};

let sessionJson = {};

/**
 * Get the .software directory path/name
 **/
fileUtil.getSoftwareDir = (autoCreate = true) => {
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

fileUtil.requiresSpotifyAccess = () => {
    const spotifyAccessToken = fileUtil.getItem('spotify_access_token');
    return spotifyAccessToken ? false : true;
};

fileUtil.requiresSpotifyReAuthentication = () => {
    const requiresSpotifyReAuth = fileUtil.getItem("requiresSpotifyReAuth");
    return requiresSpotifyReAuth ? true : false;
}

/**
 * Get the .software/session.json path/name
 **/
fileUtil.getSoftwareSessionFile = (autoCreate = true) => {
    let file = fileUtil.getSoftwareDir(autoCreate);
    if (commonUtil.isWindows()) {
        file += '\\session.json';
    } else {
        file += '/session.json';
    }
    return file;
};

fileUtil.getSoftwareSessionAsJson = () => {
    let data = fileIt.getJsonFileSync(fileUtil.getSoftwareSessionFile());
    return data ? data : {};
};

fileUtil.setItem = (key, value) => {
  fileIt.setJsonValue(fileUtil.getSoftwareSessionFile(), key, value);
};

fileUtil.getItem = (key) => {
  return fileIt.getJsonValue(fileUtil.getSoftwareSessionFile(), key);
};

/**
 * Store the json data to session.json
 **/
function writeSessionJson(jsonObj) {
  fileIt.writeJsonFileSync(fileUtil.getSoftwareSessionFile(), jsonObj);
}

module.exports = fileUtil;
