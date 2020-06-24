'use babel';

const cacheMgr = require("./cache/CacheManager");
const fs = require('fs');
const os = require('os');
const commonUtil = require("./CommonUtil");

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
    let data = null;

    const sessionFile = fileUtil.getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile, {encoding: 'utf8'}).toString();
        if (content) {
            data = JSON.parse(content);
        }
    }
    return data ? data : {};
};

fileUtil.setItem = (key, value) => {
    const jsonObj = fileUtil.getSoftwareSessionAsJson();
    if (jsonObj) {
      // update the locally cached sessionJson
      sessionJson = {
        ...jsonObj
      };
    }
    sessionJson[key] = value;

    writeSessionJson(sessionJson);
};

fileUtil.getItem = (key) => {
    let val = cacheMgr.get(key);
    if (val !== null && val !== undefined) {
      return val;
    }
    const jsonObj = fileUtil.getSoftwareSessionAsJson();
    if (jsonObj) {
      // update locally cached sessionJson
      sessionJson = {
        ...jsonObj
      };
    } else {
      // null jsonObj, save the current version of the session json
      writeSessionJson(sessionJson);
    }

    val = sessionJson[key] || null;
    if (val !== null) {
      // 15 second cache
      cacheMgr.set(key, val, 15);
    }
    return val;
};

/**
 * Store the json data to session.json
 **/
function writeSessionJson(jsonObj) {
  const content = JSON.stringify(jsonObj);
  fs.writeFileSync(fileUtil.getSoftwareSessionFile(), content, (err) => {
      if (err)
          console.log(
              'Code Time: Error writing to the Software session file: ',
              err.message
          );
  });
}

module.exports = fileUtil;
