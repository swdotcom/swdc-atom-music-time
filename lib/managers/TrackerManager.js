"use babel";

import swdcTracker from "swdc-tracker";
import { api_endpoint } from '../Constants';

const FileChangeInfo = require("../models/FileChangeInfo");
const repoMgr = require("./KpmRepoManager");
const utilMgr = require("./UtilManager");
const eventUtil = require("../utils/EventUtil");
const projectMgr = require("./ProjectManager");
const fileUtil = require('../utils/FileUtil');
const moment = require("moment-timezone");

const tracker = {};

let trackerReady = false;

tracker.init = async () => {
  jwtParams = getJwtParams();

  // initialize tracker with swdc api host, namespace, and appId
  const result = await swdcTracker.initialize(
    api_endpoint,
    "MusicTime",
    "swdc-atom"
  );

  if (result.status === 200) {
    trackerReady = true;
  }
};

tracker.trackCodeTimeEvent = async (item) => {
  if (!trackerReady) {
    return;
  }

  // extract the project info from the keystroke stats
  const projectInfo = {
    project_directory: item.project.directory,
    project_name: item.project.name,
  };

  const tzOffsetParams = getTzOffsetParams();

  // loop through the files in the keystroke stats "source"
  const fileKeys = Object.keys(item.source);
  for (let i = 0; i < fileKeys.length; i++) {
    const file = fileKeys[i];
    const fileData: FileChangeInfo = item.source[file];

    console.log("fileData: ", fileData);

    const codetime_entity = {
      keystrokes: fileData.keystrokes,
      lines_added: fileData.documentChangeInfo.linesAdded,
      lines_deleted: fileData.documentChangeInfo.linesDeleted,
      characters_added: fileData.documentChangeInfo.charactersAdded,
      characters_deleted: fileData.documentChangeInfo.charactersDeleted,
      single_deletes: fileData.documentChangeInfo.singleDeletes,
      multi_deletes: fileData.documentChangeInfo.multiDeletes,
      single_adds: fileData.documentChangeInfo.singleAdds,
      multi_adds: fileData.documentChangeInfo.multiAdds,
      auto_indents: fileData.documentChangeInfo.autoIndents,
      replacements: fileData.documentChangeInfo.replacements,
      start_time: moment.unix(fileData.start).utc().format(),
      end_time: moment.unix(fileData.end).utc().format()
    };

    const file_entity = {
      file_name: fileData.fsPath.split(fileData.projectDir)[1],
      file_path: fileData.fsPath,
      syntax: fileData.syntax,
      line_count: fileData.lines,
      character_count: fileData.length,
    };

    const repoParams = await getRepoParams(item.project.directory);

    const codetime_event = {
      ...codetime_entity,
      ...file_entity,
      ...projectInfo,
      ...repoParams,
      ...getPluginParams(),
      ...getTzOffsetParams(),
      ...getJwtParams(),
    };

    swdcTracker.trackCodeTimeEvent(codetime_event);
  }
};

/**
 * item should have the following:
 * {element_name, element_location, cta_text, color, icon_name}
 **/
tracker.trackUIInteraction = async (interactionType, uiElement) => {
  if (!trackerReady) {
    return;
  }

  const ui_interaction = {
    interaction_type: interactionType,
  };

  const ui_element = {
    ...uiElement
  };

  const ui_event = {
    ...ui_interaction,
    ...ui_element,
    ...getPluginParams(),
    ...getTzOffsetParams(),
    ...getJwtParams(),
  };

  swdcTracker.trackUIInteraction(ui_event);
};

tracker.trackEditorAction = async (entity, type, editor = null) => {
  if (!trackerReady) {
    return;
  }

  const projectParams = await getProjectParams();
  const repoParams = await getRepoParams(projectParams.project_directory);
  const fileParams = getFileParams(editor);

  const editor_event = {
    entity,
    type,
    ...projectParams,
    ...fileParams,
    ...repoParams,
    ...getPluginParams(),
    ...getTzOffsetParams(),
    ...getJwtParams(),
  };

  // send the event
  swdcTracker.trackEditorAction(editor_event);
};

function getJwtParams() {
  let jwt = fileUtil.getItem("jwt");
  return { jwt: jwt ? jwt.split("JWT ")[1] : null };
}

function getPluginParams() {
  return {
    plugin_id: utilMgr.getPluginId(),
    plugin_name: utilMgr.getPluginName(),
    plugin_version: utilMgr.getVersion()
  }
}

function getTzOffsetParams() {
  return {
    tz_offset_minutes: moment.parseZone(moment().local()).utcOffset()
  }
}

async function getProjectParams() {
  const dirNameInfo = projectMgr.getProjectDirectoryAndName();
  return {
    project_directory: dirNameInfo.directory,
    project_name: dirNameInfo.name
  };
}

async function getRepoParams(directory) {
  const resourceInfo = await repoMgr.getResourceInfo(directory);
  if (!resourceInfo || !resourceInfo.identifier) {
    // return empty data, no need to parse further
    return {
      identifier: "",
      org_name: "",
      repo_name: "",
      repo_identifier: "",
      git_branch: "",
      git_tag: "",
    };
  }

  // retrieve the git identifier info
  const gitIdentifiers = repoMgr.getRepoIdentifierInfo(resourceInfo.identifier);

  return {
    ...gitIdentifiers,
    repo_identifier: resourceInfo.identifier,
    git_branch: resourceInfo.branch,
    git_tag: resourceInfo.tag,
  };
}

function getFileParams(editor) {
  let fileParams = eventUtil.getFileInfo(editor);

  return {
    syntax: fileParams.syntax,
    file_name: fileParams.file_name,
    file_path: fileParams.full_file_name,
    line_count: fileParams.line_count,
    character_count: fileParams.character_count
  }
}

module.exports = tracker;
