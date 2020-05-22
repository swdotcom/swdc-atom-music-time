const fs = require('fs');
const os = require('os');

const fileUtil = {};

/**
 * Get the .software directory path/name
 **/
fileUtil.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (fileUtil.isWindows()) {
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

fileUtil.isWindows = () => {
    return process.platform.indexOf('win32') !== -1;
};

fileUtil.isMac = () => {
    return process.platform.indexOf('darwin') !== -1;
};

/**
 * Get the .software/session.json path/name
 **/
fileUtil.getSoftwareSessionFile = (autoCreate = true) => {
    let file = fileUtil.getSoftwareDir(autoCreate);
    if (fileUtil.isWindows()) {
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
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = fileUtil.getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, err => {
        if (err)
            console.log(
                'Music Time: Error writing to the Software session file: ',
                err.message
            );
    });
};

fileUtil.getItem = key => {
    const jsonObj = fileUtil.getSoftwareSessionAsJson();

    return jsonObj[key] || null;
};

module.exports = fileUtil;
