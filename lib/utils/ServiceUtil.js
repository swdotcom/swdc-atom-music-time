'use babel';


import {
    isResponseOk,
    appPost,
    appGet
} from '../client/HttpClient';

const execUtil = require('./ExecUtil');
const fileUtil = require("./FileUtil");

const serviceUtil = {};

let currentUser = null;

/**
 * create an anonymous user
 */
serviceUtil.createAnonymousUser = async () => {
  const jwt = fileUtil.getItem("jwt");
    // check one more time before creating the anon user
    if (!jwt) {
        // this should not be undefined if its an account reset
        let plugin_uuid = fileUtil.getPluginUuid();
        let auth_callback_state = fileUtil.getAuthCallbackState();
        const username = await execUtil.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await execUtil.getHostname();

        const resp = await appPost(
            "/api/v1/anonymous_user",
            {
                timezone,
                username,
                plugin_uuid,
                hostname,
                auth_callback_state
            }
        );
        if (isResponseOk(resp) && resp.data) {
            fileUtil.setItem("jwt", resp.data.plugin_jwt);
            if (!resp.data.user.registered) {
                fileUtil.setItem("name", null);
            }
            fileUtil.setAuthCallbackState(null);
            fileUtil.setItem('switching_account', false);
            return resp.data.jwt;
        }
    }

    return null;
};

serviceUtil.getCachedUser = async () => {
  if (!currentUser) {
    await serviceUtil.getUser();
  }
  return currentUser;
}

serviceUtil.updateCachedUser = (user) => {
  if (currentUser && currentUser.integraion_conections) {
    currentUser = user;
  }
}

serviceUtil.getUser = async () => {
  const nowMillis = new Date().getTime();
  if (currentUser && nowMillis - lastUserFetch < 2000) {
    return currentUser;
  }
  const resp = await appGet('/api/v1/user');
  if (isResponseOk(resp) && resp.data) {
    currentUser = resp.data;
    lastUserFetch = nowMillis;
  }
  return currentUser;
};

module.exports = serviceUtil;
