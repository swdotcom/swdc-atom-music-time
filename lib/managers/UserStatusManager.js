'use babel';

import { isResponseOk, softwareGet } from '../client/HttpClient';
import { updateSlackIntegrations } from "./IntegrationManager";
import { disconectAllSlackIntegrations } from "./SlackManager";

const fileUtil = require("../utils/FileUtil");
const utilMgr = require("./UtilManager");
const commonUtil = require("../utils/CommonUtil");
const { WebClient } = require("@slack/web-api");


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
    // each retry is 10 seconds long
    refetchUserStatusLazily(40);
}

export async function refetchUserStatusLazily(tryCountUntilFoundUser = 3) {
  const registrationState = await getUserRegistrationState(false /*isIntegration*/);
  if (!registrationState.connected) {
      // try again if the count is not zero
      if (tryCountUntilFoundUser > 0) {
          tryCountUntilFoundUser -= 1;
          setTimeout(() => {
            refetchUserStatusLazily(tryCountUntilFoundUser);
          }, 10000);
      } else {
          // clear the auth callback state
          fileUtil.setItem("switching_account", false);
          fileUtil.setAuthCallbackState(null);
      }
  } else {
    // clear the auth callback state
    fileUtil.setItem("switching_account", false);
    fileUtil.setAuthCallbackState(null);

    setTimeout(() => {
      atom.confirm({
        message: '',
        detailedMessage: 'Successfully registered.',
      });
    }, 0);

    // clear the slack integrations
    await disconectAllSlackIntegrations();

    // update integrations based on the new user
    updateSlackIntegrations(registrationState.user);

    // set the email and jwt
    updateUserInfoIfRegistered(registrationState.user);

    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:refresh-account'
    );
  }
}

export function updateUserInfoIfRegistered(user) {
  // set the email and jwt
  if (user && user.registered === 1) {
    if (user.plugin_jwt) {
      fileUtil.setItem("jwt", user.plugin_jwt);
    }
    fileUtil.setItem("name", user.email);
  }
}
