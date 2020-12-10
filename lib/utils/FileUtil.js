'use babel';
import { v4 as uuidv4 } from "uuid";

const fs = require('fs');
const os = require('os');
const commonUtil = require("./CommonUtil");
const fileIt = require("file-it");

const fileUtil = {};

fileUtil.isLoggedIn = () => {
  return (fileUtil.getItem("name")) ? true : false;
};

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

fileUtil.getDeviceFile = (autoCreate = true) => {
  let file = fileUtil.getSoftwareDir(autoCreate);
  if (commonUtil.isWindows()) {
      file += '\\device.json';
  } else {
      file += '/device.json';
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

fileUtil.getPluginUuid = () => {
  let plugin_uuid = fileIt.getJsonValue(fileUtil.getDeviceFile(), "plugin_uuid");
  if (!plugin_uuid) {
      // set it for the 1st and only time
      plugin_uuid = uuidv4();
      fileIt.setJsonValue(fileUtil.getDeviceFile(), "plugin_uuid", plugin_uuid);
  }
  return plugin_uuid;
};

fileUtil.getAuthCallbackState = () => {
  return fileIt.getJsonValue(fileUtil.getDeviceFile(), "auth_callback_state");
};

fileUtil.setAuthCallbackState = (value) => {
  fileIt.setJsonValue(fileUtil.getDeviceFile(), "auth_callback_state", value);
};

/**
 * Store the json data to session.json
 **/
function writeSessionJson(jsonObj) {
  fileIt.writeJsonFileSync(fileUtil.getSoftwareSessionFile(), jsonObj);
}

module.exports = fileUtil;
