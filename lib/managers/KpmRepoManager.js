'use babel';

import TeamMember from '../models/TeamMember';
import RepoContributor from '../models/RepoContributor';
import { execCmd } from "./ExecManager";
const utilMgr = require('./UtilManager');
const fileUtil = require("../utils/FileUtil");
const execUtil = require("../utils/ExecUtil");

const resourceInfoMap = {};

let repoMgr = {};

repoMgr.getResourceInfo = async projectDir => {
  if (!projectDir || !utilMgr.isGitProject(projectDir)) {
    return null;
  }

  let resourceInfo = resourceInfoMap[projectDir];
  if (resourceInfo) {
    return resourceInfo;
  }

  let branch = execCmd(
      'git symbolic-ref --short HEAD',
      projectDir
  );
  let identifier = execCmd(
      'git config --get remote.origin.url',
      projectDir
  );
  let email = execCmd(
      'git config user.email',
      projectDir
  );
  let tag = execCmd('git describe --all', projectDir);

  // both should be valid to return the resource info
  if (branch && identifier && email) {
    resourceInfo = { branch, identifier, email, tag };
    resourceInfoMap[projectDir] = resourceInfo;
    return resourceInfo;
  }
  // we don't have git info, return an empty object
  return {};
};

function buildRepoKey(identifier, branch, tag) {
    return `${identifier}_${branch}_${tag}`;
}

function stripOutSlashes(str) {
  var parts = str.split("//");
  return parts.length === 2 ? parts[1] : str;
}

function stripOutAtSign(str) {
  var parts = str.split("@");
  return parts.length === 2 ? parts[1] : str;
}

function replaceColonWithSlash(str) {
  return str.replace(":", "/");
}

function normalizeRepoIdentifier(identifier) {
  if (identifier) {
    // repos['standardId'] = repos['identifier']
    // repos['standardId'] = repos['standardId'].str.split('\//').str[-1].str.strip()
    // repos['standardId'] = repos['standardId'].str.split('\@').str[-1].str.strip()
    // repos['standardId'] = repos['standardId'].str.replace(':', "/")
    identifier = stripOutSlashes(identifier);
    identifier = stripOutAtSign(identifier);
    identifier = replaceColonWithSlash(identifier);
  }

  return identifier || "";
}

/**
 * Retrieve the github org name and repo name from the identifier
 * i.e. https://github.com\\swdotcom\\swdc-codemetrics-service.git
 * would return "swdotcom"
 * Returns: {identifier, org_name, repo_name}
 */
repoMgr.getRepoIdentifierInfo = (identifier) => {
  identifier = normalizeRepoIdentifier(identifier);

  if (!identifier) {
    // no identifier to pull out info
    return { identifier: "", org_name: "", repo_name: "" };
  }

  // split the identifier into parts
  const parts = identifier.split(/[\\/]/);

  // it needs to have at least 3 parts
  // for example, this shouldn't return an org "github.com//string.git"
  let owner_id = "";
  const gitMatch = parts[0].match(/.*github.com/i);
  if (parts && parts.length > 2 && gitMatch) {
    // return the 2nd part
    owner_id = parts[1];
  }

  let repo_name = "";
  if (parts && parts.length > 2 && identifier.indexOf(".git") !== -1) {
    // https://github.com/swdotcom/swdc-atom.git
    // this will return "swdc-atom"
    repo_name = identifier.split("/").slice(-1)[0].split(".git")[0];
  }

  return { identifier, owner_id, repo_name };
};

module.exports = repoMgr;
