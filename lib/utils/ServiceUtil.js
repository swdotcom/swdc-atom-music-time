'use babel';


import {
    isResponseOk,
    softwareGet,
    softwarePost
} from '../client/HttpClient';

const execUtil = require('./ExecUtil');
const utilMgr = require('../managers/UtilManager');
const fileUtil = require("./FileUtil");

const serviceUtil = {};

let lastOnlineCheck = 0;

/**
 * create an anonymous user
 */
serviceUtil.createAnonymousUser = async (ignoreJwt = false) => {
  const jwt = fileUtil.getItem("jwt");
    // check one more time before creating the anon user
    if (!jwt || ignoreJwt) {
        // this should not be undefined if its an account reset
        let plugin_uuid = fileUtil.getPluginUuid();
        let auth_callback_state = fileUtil.getAuthCallbackState();
        const username = await execUtil.getOsUsername();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hostname = await execUtil.getHostname();

        const resp = await softwarePost(
            "/plugins/onboard",
            {
                timezone,
                username,
                plugin_uuid,
                hostname,
                auth_callback_state
            }
        );
        if (isResponseOk(resp) && resp.data && resp.data.jwt) {
            fileUtil.setItem("jwt", resp.data.jwt);
            if (!resp.data.user.registered) {
                fileUtil.setItem("name", null);
            }
            fileUtil.setAuthCallbackState(null);
            return resp.data.jwt;
        }
    }

    return null;
};

serviceUtil.serverIsAvailable = async () => {
    let nowInSec = utilMgr.nowInSecs();
    let pastThreshold = nowInSec - lastOnlineCheck > 60;
    if (pastThreshold) {
        isOnline = await softwareGet('/ping', null)
            .then((result) => {
                return isResponseOk(result);
            })
            .catch((e) => {
                return false;
            });
    }
    return isOnline;
};

serviceUtil.initializePreferences = async () => {
    const jwt = fileUtil.getItem('jwt');

    if (jwt) {
        const api = '/users/me';
        const resp = await softwareGet(api, jwt);
        if (isResponseOk(resp)) {
            if (
                resp &&
                resp.data &&
                resp.data.data &&
                resp.data.data.preferences
            ) {
                const prefs = resp.data.data.preferences;
                const { disableGitData } = prefs;

                await fileUtil.setItem('disableGitData', !!disableGitData);

                return prefs;
            }
        }
        return {};
    }
    return {};
};

serviceUtil.getUser = async (jwt) => {
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

module.exports = serviceUtil;
