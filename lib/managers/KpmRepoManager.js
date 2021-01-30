'use babel';

import TeamMember from '../models/TeamMember';
import RepoContributor from '../models/RepoContributor';

const utilMgr = require('./UtilManager');
const fileUtil = require("../utils/FileUtil");
const execUtil = require("../utils/ExecUtil");

const resourceInfoMap = {};

let repoMgr = {};

repoMgr.getResourceInfo = async projectDir => {
  let resourceInfo = resourceInfoMap[projectDir];
  if (resourceInfo) {
    return resourceInfo;
  }

  let branch = await utilMgr.wrapExecPromise(
      'git symbolic-ref --short HEAD',
      projectDir
  );
  let identifier = await utilMgr.wrapExecPromise(
      'git config --get remote.origin.url',
      projectDir
  );
  let email = await utilMgr.wrapExecPromise(
      'git config user.email',
      projectDir
  );
  let tag = await utilMgr.wrapExecPromise('git describe --all', projectDir);

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

repoMgr.getRepoFileCount = async (fileName) => {
    const { project_directory } = fileUtil.getDirectoryAndNameForFile(fileName);
    if (!project_directory || !utilMgr.isGitProject(project_directory)) {
        return 0;
    }

    // windows doesn't support the wc -l so we'll just count the list
    let cmd = `git ls-files`;
    // get the author name and email
    let resultList = await execUtil.getCommandResultList(cmd, project_directory);
    if (!resultList) {
        // something went wrong, but don't try to parse a null or undefined str
        return 0;
    }

    return resultList.length;
};

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

repoMgr.getRepoContributorInfo = async (
    fileName,
    filterOutNonEmails = true
) => {
    const { project_directory } = fileUtil.getDirectoryAndNameForFile(fileName);
    if (!project_directory || !utilMgr.isGitProject(project_directory)) {
        return null;
    }

    let repoContributorInfo = new RepoContributor();

    // get the repo url, branch, and tag
    let resourceInfo = await repoMgr.getResourceInfo(project_directory);
    if (resourceInfo && resourceInfo.identifier) {
        repoContributorInfo.identifier = resourceInfo.identifier;
        repoContributorInfo.tag = resourceInfo.tag;
        repoContributorInfo.branch = resourceInfo.branch;

        // username, email
        let cmd = `git log --format='%an,%ae' | sort -u`;
        // get the author name and email
        let resultList = await execUtil.getCommandResultList(cmd, project_directory);
        if (!resultList) {
            // something went wrong, but don't try to parse a null or undefined str
            return repoContributorInfo;
        }

        let map = {};
        if (resultList && resultList.length > 0) {
            // count name email
            resultList.forEach((listInfo) => {
                const devInfo = listInfo.split(",");
                const name = devInfo[0];
                const email = utilMgr.normalizeGithubEmail(
                    devInfo[1],
                    filterOutNonEmails
                );
                if (email && !map[email]) {
                    const teamMember = new TeamMember();
                    teamMember.name = name;
                    teamMember.email = email;
                    teamMember.identifier = resourceInfo.identifier;
                    repoContributorInfo.members.push(teamMember);
                    map[email] = email;
                }
            });
        }
        repoContributorInfo.count = repoContributorInfo.members.length;
    }

    return repoContributorInfo;
};

repoMgr.getFileContributorCount = async (fileName) => {
  const fileType = utilMgr.getFileType(fileName);

  if (fileType === "git") {
      return 0;
  }

  const { project_directory } = fileUtil.getDirectoryAndNameForFile(fileName);
  if (!project_directory || !utilMgr.isGitProject(project_directory)) {
      return 0;
  }

  // all we need is the filename of the path
  const cmd = `git log --pretty="%an" ${fileName}`;

  // get the list of users that modified this file
  let resultList = await execUtil.getCommandResultList(cmd, project_directory);
  if (!resultList) {
      // something went wrong, but don't try to parse a null or undefined str
      return 0;
  }

  if (resultList.length) {
      const uniqueItems = Array.from(new Set(resultList));
      return uniqueItems.length;
  }
  return 0;
};

module.exports = repoMgr;
