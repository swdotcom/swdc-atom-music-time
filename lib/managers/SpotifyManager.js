'use babel';

import {
  getSpotifyIntegration,
  updateSpotifyIntegrations,
  clearSpotifyIntegrations,
  updateSlackIntegrations } from "./IntegrationManager";
import { api_endpoint } from '../Constants';
import { isResponseOk, softwareGet, softwarePut } from "../client/HttpClient";
import { setConfig, CodyConfig, getUserProfile } from 'cody-music';
import StructureView from '../music/structure-view';
import $ from 'jquery';

const queryString = require("query-string");
const fileUtil = require("../utils/FileUtil");
const utilMgr = require("./UtilManager");
const commonUtil = require("../utils/CommonUtil");

let spotifyUser = null;
let spotifyClientId = "";
let spotifyClientSecret = "";

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export function isPremiumUser() {
  return !!(spotifyUser && spotifyUser.product === "premium");
}

export function getSpotifyUser() {
  return spotifyUser;
}

export async function connectSpotify(checkExistingIntegration = true) {
  // check if they're already connected, if so then ask if they would
  // like to continue as we'll need to disconnect the current connection
  const spotifyIntegration = getSpotifyIntegration();
  if (spotifyIntegration) {

    // disconnect Spotify confirm first
    atom.confirm({
      message: "Connect with a different Spotify account?",
      detailedMessage: "",
      buttons: ["Yes", "Cancel"]
    }, async (resp) => {
      if (resp === 0) {
        // already confirmed, initiate the disconnect
        await disconnectSpotify(false);
        connectSpotify(false);
      }
    });
  } else {

    const auth_callback_state = fileUtil.getAuthCallbackState(true);

    let queryStr = queryString.stringify({
        plugin: utilMgr.getPluginType(),
        plugin_uuid: fileUtil.getPluginUuid(),
        pluginVersion: utilMgr.getVersion(),
        plugin_id: utilMgr.getPluginId(),
        mac: commonUtil.isMac(),
        auth_callback_state,
        plugin_token: fileUtil.getItem("jwt")
    });

    const endpoint = `${api_endpoint}/auth/spotify?${queryStr}`;

    utilMgr.launchWebUrl(endpoint);
  }
}

export async function populateSpotifyUser(hardRefresh = false) {
  const spotifyIntegration = getSpotifyIntegration();
  if (spotifyIntegration && (hardRefresh || !spotifyUser || !spotifyUser.id)) {
    // get the user
    spotifyUser = await getUserProfile();
  }
}

export function removeSpotifyIntegration() {
  clearSpotifyIntegrations();

  // clear the tokens from cody config
  updateCodyConfig();

  // update the spotify user to null
  spotifyUser = null;
}

export async function disconnectSpotify(confirmDisconnect = true) {
  if (confirmDisconnect) {
    atom.confirm({
      message: "Are you sure you would like to disconnect Spotify?",
      detailedMessage: "",
      buttons: ["Yes", "Cancel"]
    }, async (resp) => {
      if (resp === 0) {
        disconnectSpotify(false);
      }
    });
  } else {

    const structureViewObj = StructureView.getInstance();
    structureViewObj.showLoader(false, true);

    await softwarePut(`/auth/spotify/disconnect`, {}, fileUtil.getItem("jwt"));

    // remove the integration
    removeSpotifyIntegration();

    updateCodyConfig();

    structureViewObj.hideLoader();

    const connectLabel = fileUtil.requiresSpotifyReAuthentication() ? "Reconnect Spotify" : "Connect Spotify";

    $('#spotify-disconnect').hide();
    $('#spotify-connect').text(connectLabel);
    $('#spotify-connect').show();
    $('#spotify-status').hide();
    $('#spotify-refresh-playlist').hide();
    $('#account-status-href').hide();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:clearTreeView'
    );
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:clearFooterStatus'
    );

    setTimeout(() => {
      utilMgr.updateLoginPreference(false);
    }, 5000);

    utilMgr.clearNotification();

    structureViewObj.toggleDeviceStatus(true);
    structureViewObj.toggleRefreshTreeview(true);
    structureViewObj.toggleSortDev(true);
    structureViewObj.toggleLikeButton(true);
    $('loaderdiv');
    $('.divider').hide();

    utilMgr.updateStatus();
  }
}

export async function updateSpotifyClientInfo() {
  const resp = await softwareGet("/auth/spotify/clientInfo", fileUtil.getItem("jwt"));
  if (isResponseOk(resp) && resp.data) {
    // get the clientId and clientSecret
    spotifyClientId = resp.data.clientId;
    spotifyClientSecret = resp.data.clientSecret;
  }
}

/**
 * Update the cody config settings for cody-music
 */
export async function updateCodyConfig() {
  const spotifyIntegration = getSpotifyIntegration();

  if (!spotifyIntegration) {
    spotifyUser = null;
  }

  const codyConfig = new CodyConfig();
  codyConfig.enableItunesDesktop = false;
  codyConfig.enableItunesDesktopSongTracking = commonUtil.isMac();
  codyConfig.enableSpotifyDesktop = commonUtil.isMac();
  codyConfig.spotifyClientId = spotifyClientId;
  codyConfig.spotifyAccessToken = spotifyIntegration ? spotifyIntegration.access_token : null;
  codyConfig.spotifyRefreshToken = spotifyIntegration ? spotifyIntegration.refresh_token : null;
  codyConfig.spotifyClientSecret = spotifyClientSecret;
  setConfig(codyConfig);
}

export async function migrateAccessInfo() {
  if (!getSpotifyIntegration()) {
    const legacyAccessToken = fileUtil.getItem("spotify_access_token");
    if (legacyAccessToken) {
      // get the user
      const user = await utilMgr.getUser(fileUtil.getItem("jwt"));
      if (user) {
        // update the integrations
        await updateSpotifyIntegrations(user);
        updateCodyConfig();
      }
    }
  }
}

export async function populateSpotifyUserProfile() {
    spotifyUser = await getUserProfile();

    return spotifyUser;
};

export async function initializeSpotify() {

    localStorage.setItem('_selectedPlaylistId', '');

    // initialize cody music
    if (!spotifyClientId) {
      await updateSpotifyClientInfo();
    }
    updateCodyConfig();

    const structureViewObj = StructureView.getInstance();
    structureViewObj.preInitialize();

    // initialize the user and devices
    await populateSpotifyUserProfile();

    utilMgr.updateStatus();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:refresh-treeview'
    );

    setTimeout(() => {
      const hasSpotifyIntegration = !!(getSpotifyIntegration());
      utilMgr.updateLoginPreference(hasSpotifyIntegration);
    }, 5000);
}
