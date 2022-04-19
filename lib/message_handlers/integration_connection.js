'use babel';

import { initializeSpotify, updateCodyConfig } from "../managers/SpotifyManager";

const serviceUtil = require("../utils/ServiceUtil");
const fileUtil = require("../utils/FileUtil");
const utilMgr = require("../managers/UtilManager");

export async function handleIntegrationConnectionSocketEvent(body) {
  // integration_type_id = 14 (slack)
  // action = add, update, remove
  const { integration_type_id, integration_type, action } = body;

  await serviceUtil.getUser();

  if (integration_type_id === 14) {
    // clear the auth callback state
    fileUtil.setAuthCallbackState(null);

    // refresh the slack integrations
    atom.notifications.addInfo("Slack connect", { detail: "Successfully connected to Slack", dismissable: true });

    utilMgr.removeMusicMenuItem(WEB_SLACK_LABEL);
    utilMgr.addMusicMenuItem(
        DISCONNECT_SLACK_MENU_LABEL,
        DISCONNECT_SLACK_COMMAND_KEY
    );
    setTimeout(() => {
        utilMgr.notify('Music Time', `Successfully connected to Slack`);
        utilMgr.clearNotification();
    }, 5000);

    // refresh the tree view
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:toggle-slack-workspaces'
    );
  } else if (integration_type_id === 12) {
    // clear the auth callback state
    fileUtil.setAuthCallbackState(null);

    // update the login status
    atom.notifications.addInfo("Spotify connect", { detail: "Successfully connected to Spotify. Loading playlists...", dismissable: true });

    updateCodyConfig();

    // initialize spotify and playlists
    initializeSpotify();

    setTimeout(() => {
      utilMgr.clearNotification();
    }, 2000);
  }
}
