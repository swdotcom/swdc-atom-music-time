'use babel';

import { app_endpoint } from '../Constants';
import { isResponseOk, softwareGet } from "../client/HttpClient";
import { setConfig, CodyConfig, getUserProfile } from 'cody-music';
import StructureView from '../music/structure-view';

const queryString = require("query-string");
const serviceUtil = require("../utils/ServiceUtil");
const fileUtil = require("../utils/FileUtil");
const utilMgr = require("./UtilManager");
const commonUtil = require("../utils/CommonUtil");

let spotifyUser = null;
let spotifyClientId = "";
let spotifyClientSecret = "";

export async function getCachedSpotifyIntegration() {
  const currentUser = await serviceUtil.getCachedUser();
  if (currentUser.integration_connections && currentUser.integration_connections.length) {
    const spotifyIntegrations = currentUser.integration_connections.filter(
      (integration) => integration.status === 'ACTIVE' && (integration.integration_type_id === 12));
    if (spotifyIntegrations && spotifyIntegrations.length) {
      return spotifyIntegrations[spotifyIntegrations.length - 1];
    }
  }
  return null;
}

export async function requiresSpotifyAccess() {
  return await getCachedSpotifyIntegration() ? false : true;
}

export function hasSpotifyUser() {
  return !!(spotifyUser && spotifyUser.product);
}

export function isPremiumUser() {
  return !!(spotifyUser && spotifyUser.product === "premium");
}

export function getSpotifyUser() {
  return spotifyUser;
}

export async function connectSpotify() {
  const auth_callback_state = fileUtil.getAuthCallbackState(true);
  const qryStr = queryString.stringify({
    plugin_uuid: fileUtil.getPluginUuid(),
    plugin_id: utilMgr.getPluginId(),
    pluginVersion: utilMgr.getVersion(),
    auth_callback_state
  });

  const url = `${app_endpoint}/data_sources/integration_types/spotify}?${qryStr}`;
  utilMgr.launchWebUrl(url);
}

export async function populateSpotifyUser(hardRefresh = false) {
  const spotifyIntegration = await getCachedSpotifyIntegration();
  if (spotifyIntegration && (hardRefresh || !spotifyUser || !spotifyUser.id)) {
    // get the user
    spotifyUser = await getUserProfile();
  }
}

export function removeSpotifyIntegration() {
  // clear the tokens from cody config
  updateCodyConfig();

  // update the spotify user to null
  spotifyUser = null;
}

export async function disconnectSpotify() {
  utilMgr.launchWebUrl(`${app_endpoint}/data_sources/integration_types/spotify`);
}

export async function updateSpotifyClientInfo() {
  const resp = await softwareGet("/auth/spotify/clientInfo");
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
  const spotifyIntegration = await getCachedSpotifyIntegration();

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

    if (!await requiresSpotifyAccess()) {
      await utilMgr.loadPlaylists();
    }

    utilMgr.updateStatus();

    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:refresh-treeview'
    );

    setTimeout(async () => {
      const hasSpotifyIntegration = !!(await getCachedSpotifyIntegration());
      utilMgr.updateLoginPreference(hasSpotifyIntegration);
    }, 5000);
}
