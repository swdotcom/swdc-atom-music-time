'use babel';

import { v4 as uuidv4 } from "uuid";
import fileIt from 'file-it';
import { NO_PROJ_NAME, UNTITLED, SOFTWARE_DIR } from '../Constants';

const fs = require('fs');
const os = require('os');
const commonUtil = require("./CommonUtil");
const path = require("path");

const fileUtil = {};

fileUtil.getJsonData = (filename) => {
  return fileIt.readJsonFileSync(filename);
};

fileUtil.storeJsonData = (filename, data) => {
  fileIt.writeJsonFileSync(filename, data);
};

fileUtil.getLastSavedKeystrokesStats = (fileName) => {
    return fileIt.findSortedJsonElement(fileName, "start", "desc");
};

/**
 * returns
 * {project_directory, name, file_name, file_path}
 **/
fileUtil.getDirectoryAndNameForFile = (file) => {
  const dirInfo = {
    project_directory: UNTITLED,
    project_name: NO_PROJ_NAME,
    file_name: file,
    file_path: file ? path.dirname(file) : "",
    full_file_name: file
  };

  if (
      file &&
      atom.workspace.project &&
      atom.workspace.project.rootDirectories.length
  ) {
      const rootDirs = atom.workspace.project.rootDirectories;
      if (rootDirs && rootDirs.length) {
        for (let i = 0; i < rootDirs.length; i++) {
            const projectDirectory = rootDirs[i].path;
            if (file.indexOf(projectDirectory) !== -1) {
              // found the project directory, return it
              const projectName = path.basename(projectDirectory);
              dirInfo.file_name = file.split(projectDirectory)[1];
              dirInfo.project_name = projectName;
              dirInfo.project_directory = projectDirectory;
              break;
            }
        }
      }
  }

  return dirInfo;
}

fileUtil.isLoggedIn = () => {
  return (fileUtil.getItem("name")) ? true : false;
};

fileUtil.getFile = (name) => {
  const file_path = `${fileUtil.getSoftwareDir(true)}${getSeparator(name)}`;
  return file_path;
}

function getSeparator(name) {
  if (commonUtil.isWindows()) {
    return `\\${name}`;
  }
  return `/${name}`;
}

/**
 * Get the .software directory path/name
 **/
fileUtil.getSoftwareDir = (autoCreate = true) => {
    const homedir = os.homedir();
    let softwareDataDir = commonUtil.isWindows() ? `${homedir}\\${SOFTWARE_DIR}` : `${homedir}/${SOFTWARE_DIR}`;

    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
};

/**
 * Get the .software/session.json path/name
 **/
fileUtil.getSoftwareSessionFile = () => {
  return fileUtil.getFile("session.json");
};

fileUtil.getDeviceFile = () => {
  return fileUtil.getFile("device.json");
};

fileUtil.getIntegrationsFile = () => {
  return fileUtil.getFile("integrations.json");
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

fileUtil.getAuthCallbackState = (autoCreate = true) => {
  let auth_callback_state = fileIt.getJsonValue(fileUtil.getDeviceFile(), "auth_callback_state");
  if (!auth_callback_state && autoCreate) {
      // set it for the 1st and only time
      auth_callback_state = uuidv4();
      fileIt.setJsonValue(fileUtil.getDeviceFile(), "auth_callback_state", auth_callback_state);
  }
  return auth_callback_state;
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

fileUtil.getIntegrations = () => {
  let integrations = fileIt.readJsonFileSync(fileUtil.getIntegrationsFile());
  if (!integrations) {
    integrations = [];
    fileUtil.syncIntegrations(integrations);
  }
  const integrationsLen = integrations.length;
  // check to see if there are any [] values and remove them
  integrations = integrations.filter((n) => n && n.authId);
  if (integrations.length !== integrationsLen) {
    // update the file with the latest
    fileIt.writeJsonFileSync(fileUtil.getIntegrationsFile(), integrations);
  }
  return integrations;
}

fileUtil.syncSlackIntegrations = (integrations) => {
  const nonSlackIntegrations = fileUtil.getIntegrations().filter((integration) => integration.name.toLowerCase() != "slack");
  integrations = integrations.length ? [...integrations, ...nonSlackIntegrations] : nonSlackIntegrations;
  fileIt.writeJsonFileSync(fileUtil.getIntegrationsFile(), integrations);
}

fileUtil.syncSpotifyIntegrations = (integration) => {
  const nonSpotifyIntegrations = fileUtil.getIntegrations().filter(integration => integration.name.toLowerCase() != "spotify");
  const integrations = integration ? [...nonSpotifyIntegrations, integration] : nonSpotifyIntegrations;
  fileIt.writeJsonFileSync(fileUtil.getIntegrationsFile(), integrations);
}

fileUtil.syncIntegrations = (integrations) => {
  fileIt.writeJsonFileSync(fileUtil.getIntegrationsFile(), integrations);
}

module.exports = fileUtil;
