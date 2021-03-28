'use babel';

import { isResponseOk, softwareGet } from '../client/HttpClient';
import { updateSlackIntegrations, updateSpotifyIntegrations } from "./IntegrationManager";
import { initializeSpotify, updateCodyConfig } from "./SpotifyManager";
import { clearAllSlackIntegrations } from "./SlackManager";
import { initializeWebsockets } from '../websockets';

const fileUtil = require("../utils/FileUtil");
const utilMgr = require("./UtilManager");
const commonUtil = require("../utils/CommonUtil");


export async function getUserRegistrationState(isIntegration = true) {
  const auth_callback_state = fileUtil.getAuthCallbackState(false /*autoCreate*/);
  const jwt = fileUtil.getItem("jwt");

  const token = auth_callback_state || jwt;
  if (token) {
    let resp = await softwareGet("/users/plugin/state", token);
    if (isResponseOk(resp) && resp.data) {
      let user = resp.data.user;
      if (!user && auth_callback_state && isIntegration) {
        // try with the jwt
        resp = await softwareGet("/users/plugin/state", jwt);
        user = (isResponseOk(resp) && resp.data) ? resp.data.user : null;
      }
      // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
      if (user) {
        // clear the auth callback state
        fileUtil.setAuthCallbackState(null);

        return { connected: true, state: "OK", user };
      }
    }
  }

  // all else fails, set false and UNKNOWN
  return { connected: false, state: "UNKNOWN", user: null };
}

export async function launchLoginUrl(type, switching_account = false) {
  commonUtil.launchUrl(utilMgr.getLoginUrl(type, switching_account));
}

export async function authenticationCompleteHandler(user) {
  // clear the auth callback state
  fileUtil.setItem("switching_account", false);
  fileUtil.setAuthCallbackState(null);

  const registered = user.registered;

  if (registered === 1) {
    if (user.plugin_jwt) {
      fileUtil.setItem("jwt", user.plugin_jwt);
    }
    const currName = fileUtil.getItem("name");
    if (currName != user.email) {

      fileUtil.setItem("name", user.email);

      // clear the slack integrations
      await clearAllSlackIntegrations();

      setTimeout(() => {
        atom.confirm({
          message: '',
          detailedMessage: 'Successfully registered.',
        });
      }, 0);

      try {
        initializeWebsockets();
      } catch (e) {
        console.error("Failed to initialize codetime websockets", e);
      }
    }
  }

  const currentAuthType = fileUtil.getItem("authType");
  if (!currentAuthType) {
    fileUtil.setItem("authType", "software");
  }

  // update integrations based on the new user
  const hasNewSlackIntegrtations = await updateSlackIntegrations(user);

  const hasNewSpotifyIntegrations = await updateSpotifyIntegrations(user);

  if (hasNewSpotifyIntegrations) {
    updateCodyConfig();

    // initialize spotify and playlists
    initializeSpotify();
  } else if (hasNewSlackIntegrtations) {
    // refresh the tree view
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:toggle-slack-workspaces'
    );
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Music-Time:refresh-account'
  );
}
