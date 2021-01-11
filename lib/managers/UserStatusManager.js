'use babel';

import {
    isResponseOk,
    softwarePut,
    softwareGet
} from '../client/HttpClient';
const fileUtil = require("../utils/FileUtil");
const utilMgr = require("../managers/UtilManager");
const codyMusicMgr = require('../managers/CodyMusicManager');
const { WebClient } = require("@slack/web-api");
const spotifyClient = require("../music/SpotifyClient");

const userStatusManager = {};

userStatusManager.getUserRegistrationState = async (isIntegration = false) => {
  const jwt = fileUtil.getItem("jwt");
  const auth_callback_state = fileUtil.getAuthCallbackState(false /*autoCreate*/);
  const authType = fileUtil.getItem("authType");

  const api = "/users/plugin/state";

  const token = (auth_callback_state) ? auth_callback_state : jwt;

  let resp = await softwareGet(api, token);

  let foundUser = !!(isResponseOk(resp) && resp.data && resp.data.user);
  let state = (foundUser) ? resp.data.state : "UNKNOWN";

  // Use the JWT to check if the user is available (tmp until server uses auth_callback_state for email accounts)
  const isEmailAuth = (authType === "software" || authType === "email");
  if (state !== "OK" && isEmailAuth) {
      // use the jwt
      resp = await softwareGet(api, jwt);
      foundUser = !!(isResponseOk(resp) && resp.data && resp.data.user);
      state = (foundUser) ? resp.data.state : "UNKNOWN";
  }

  if (foundUser) {
      // set the jwt, name (email), and use the registration flag
      // to determine if they're logged in or not
      const user = resp.data.user;

      let foundSpotifyAuth = false;

      if (user.auths && user.auths.length) {
          for (let i = 0; i < user.auths.length; i++) {
              const auth = user.auths[i];
              // update the spotify access info if the auth matches
              if (auth.type === 'spotify' && auth.access_token) {
                  fileUtil.setItem("requiresSpotifyReAuth", false);
                  foundSpotifyAuth = true;
                  // update spotify access info
                  spotifyClient.updateSpotifyAccessInfo(auth);
              }
          }
      }

      // update the slack auth if the user has any integrations
      const foundNewIntegration = await userStatusManager.updateSlackIntegrations(user);

      if (!isIntegration || !fileUtil.getItem("jwt")) {
        if (user.plugin_jwt) {
          fileUtil.setItem("jwt", user.plugin_jwt);
        }
        if (user.registered) {
          fileUtil.setItem("name", user.email);
        }
      }

      const currentAuthType = fileUtil.getItem("authType");
      if (!currentAuthType) {
        fileUtil.setItem("authType", "software");
      }

      fileUtil.setItem("switching_account", false);
      fileUtil.setAuthCallbackState(null);

      // if we need the user it's "resp.data.user"
      return { loggedOn: foundSpotifyAuth, state, user, foundNewIntegration };
  }

  // all else fails, set false and UNKNOWN
  return { loggedOn: false, state, user: null, foundNewIntegration: false };
};

userStatusManager.updateSlackIntegrations = async (user) => {
  let foundNewIntegration = false;
  let currentIntegrations = utilMgr.getSlackWorkspaces();
  if (user && user.registered === 1 && user.integrations) {

    // find the slack auth
    for (const integration of user.integrations) {
      // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
      if (integration.name.toLowerCase() === "slack" && integration.status.toLowerCase() === "active") {
        // check if it exists
        const foundIntegration = currentIntegrations.find((n) => n.authId === integration.authId);
        if (!foundIntegration) {
          // get the workspace domain using the authId
          const web = new WebClient(integration.access_token);
          const usersIdentify = await web.users.identity().catch((e) => {
            console.log("error fetching slack team info: ", e.message);
            return null;
          });
          if (usersIdentify) {
            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            integration["team_domain"] = usersIdentify.team ? usersIdentify.team.domain : "";
            integration["team_name"] = usersIdentify.team ? usersIdentify.team.name : "";
            // add it
            currentIntegrations.push(integration);

            foundNewIntegration = true;
          }
        }
      }
    }
  } else {
    // no user or they are not registered
    currentIntegrations = [];
  }
  fileUtil.syncIntegrations(currentIntegrations);
  return foundNewIntegration;
}

userStatusManager.updateSpotifyAccessInfo = (spotifyOauth) => {
    if (spotifyOauth) {
        // update the CodyMusic credentials
        codyMusicMgr.updateCodyConfig(
            spotifyOauth.access_token,
            spotifyOauth.refresh_token
        );

        fileUtil.setItem("requiresSpotifyReAuth", false);

        if (!spotifyUser || !spotifyUser.uri) {
            spotifyClient.populateSpotifyUserProfile();
        }
    } else {
        spotifyClient.clearSpotifyAccessInfo();
    }
};

module.exports = userStatusManager;
