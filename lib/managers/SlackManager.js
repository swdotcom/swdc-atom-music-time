'use babel';

import { api_endpoint } from '../Constants';
import {
    softwarePut
} from '../client/HttpClient';
import { updateSlackIntegrations } from './IntegrationManager';
import { getUserRegistrationState } from "./UserStatusManager";

const utilMgr = require('./UtilManager');
const queryString = require("query-string");
const {
  initiateSignupFlow,
  showSlackMessageInputPrompt,
  showSlackStatusUpdateOptions,
  showSlackChannelMenuOptions,
  showSlackWorkspaceMenuOptions } = require("../utils/PopupUtil");
const { WebClient } = require("@slack/web-api");
const fileUtil = require("../utils/FileUtil");


let current_slack_status = "";
let current_slack_presence = "";
let shareMessage = "";
let shareLink = "";
let selectedToken = "";

// -------------------------------------------
// - public methods
// -------------------------------------------

// get saved slack integrations
export function getSlackWorkspaces() {
  const integrations = fileUtil.getIntegrations();
  if (!integrations) {
    return [];
  }
  return fileUtil.getIntegrations().filter((n) => n.name.toLowerCase() === "slack" && n.status.toLowerCase() === "active");
}

export function hasSlackWorkspaces() {
  return !!getSlackWorkspaces().length;
}

export function slackWorkspaceSelectCallback(selectedTeamDomain) {
  if (selectedTeamDomain) {
    return getWorkspaceAccessToken(selectedTeamDomain);
  }
  return null;
}

// connect slack flow
export function connectSlackWorkspace() {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  const qryStr = queryString.stringify({
    plugin: utilMgr.getPluginType(),
    plugin_uuid: fileUtil.getPluginUuid(),
    pluginVersion: utilMgr.getVersion(),
    plugin_id: utilMgr.getPluginId(),
    auth_callback_state: fileUtil.getAuthCallbackState(),
    integrate: "slack",
    plugin_token: fileUtil.getItem("jwt")
  });

  const url = `${api_endpoint}/auth/slack?${qryStr}`;

  // authorize the user for slack
  utilMgr.launchWebUrl(url);
  // lazily check if the user has completed the slack authentication
  setTimeout(() => {
    refetchSlackConnectStatusLazily(40);
  }, 13000);
}

export async function disconectAllSlackIntegrations() {
  const workspaces = getSlackWorkspaces();
  if (workspaces) {
    // atom doesn't like "for await". It complains its an unexpected token
    // using normal for loop
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      await disconnectSlackAuth(workspace.authId);
    }
  }
}

export function disconnectSlackWorkspace(authId = "") {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  if (!authId) {
    showSlackWorkspaceSelection(disconnectSlackWorkspaceCallback);
  } else {
    disconnectSlackAuth(authId);
  }
}

function disconnectSlackWorkspaceCallback(selectedWorkspace) {
  if (!selectedWorkspace) {
    return;
  } else if (selectedWorkspace.value === "musictime.connect-slack") {
    // call the connect slack workflow
    connectSlackWorkspace();
    return;
  }

  disconnectSlackAuth(selectedWorkspace.authId);
}

// disconnect slack flow
export function disconnectSlackAuth(authId) {
  // get the domain
  const integration = getSlackWorkspaces().find((n) => n.authId === authId);
  if (!integration) {
    atom.notifications.addInfo("Disconnect Slack", { detail: "Unable to find selected workspace to disconnect", dismissable: true });
    return;
  }

  atom.confirm({
      message: `Are you sure you would like to disconnect the '${integration.team_domain}' Slack workspace?`,
      detailedMessage: "",
      buttons: ["Disconnect", "Cancel"]
  }, async (resp) => {
      if (resp === 0) {
        await softwarePut(`/auth/slack/disconnect`, { authId }, fileUtil.getItem("jwt"));
        // disconnected, remove it from the integrations
        removeSlackIntegration(authId);
      }
  });
}

// pause notification on all slack integrations
export async function pauseSlackNotifications() {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  const integrations = getSlackWorkspaces();
  if (integrations.length === 0) {
    promptSlackConnect();
    return;
  }

  let enabled = false;
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    const result = await web.dnd.setSnooze({ num_minutes: 120 }).catch((err) => {
      console.log("Unable to activate do not disturb: ", err.message);
      return [];
    });
    if (result && result.ok) {
      enabled = true;
    }
  }

  if (enabled) {
    atom.notifications.addInfo("Pause notifications", { detail: "Slack notifications are paused for 2 hours", dismissable: true });
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

// enable notifications on all slack integrations
export async function enableSlackNotifications() {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  const integrations = getSlackWorkspaces();
  if (integrations.length === 0) {
    promptSlackConnect();
    return;
  }

  let enabled = false;
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    const result = await web.dnd.endSnooze().catch((err) => {
      console.log("error ending slack snooze: ", err.message);
      return [];
    });
    if (result && result.ok) {
      enabled = true;
    }
  }

  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'Code-Time:refresh-code-time-metrics'
  );
}

/**
 * check if snooze is enabled for a slack workspace
 * @param domain
 * @returns {dnd_enabled (bool), next_dnd_end_ts (unix), next_dnd_start_ts (unix), snooze_endtime (unix), ok (bool), snooze_enabled (bool)}
 * ts is in unix seconds
 */
export async function getSlackDnDInfo() {
  const integrations = getSlackWorkspaces();
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const dndInfo = await getSlackDnDInfoPerDomain(integration.team_domain);
    if (dndInfo) {
      return dndInfo;
    }
  }
  return null;
}

// set the slack profile status
export function setProfileStatus() {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  // if there's a status already set, show the "clear" or "update" list selector
  if (current_slack_status) {
    showStatusUpdateOptions();
  } else {
    setProfileStatusCallback("update");
  }
}

export function setProfileStatusCallback(decision) {
  if (!decision) {
    return;
  }

  let status = {
    status_text: "",
    status_emoji: "",
  };
  if (decision === "update") {
    setTimeout(() => {
      showMessageInputPrompt();
    }, 1000);
  } else {
    updateSlackStatusProfileCallback(status);
  }
}

async function updateSlackStatusProfileCallback(statusObject) {
  const integrations = getSlackWorkspaces();
  // example:
  // { status_text: message, status_emoji: ":mountain_railway:", status_expiration: 0 }
  let updatedStatus = false;
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    await web.users.profile
      .set({ profile: statusObject })
      .then(() => {
        updatedStatus = true;
      })
      .catch((e) => {
        console.error("error setting profile status: ", e.message);
      });
  }
  if (updatedStatus) {
    atom.notifications.addInfo("Status update", { detail: "Slack profile status updated", dismissable: true });
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );
  }
}

// Get the users slack status
export async function getSlackStatus() {
  const registered = checkRegistration(false);
  if (!registered) {
    return null;
  }
  const integrations = getSlackWorkspaces();
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    // {profile: {avatar_hash, display_name, display_name_normalized, email, first_name,
    //  image_1024, image_192, etc., last_name, is_custom_image, phone, real_name, real_name_normalized,
    //  status_text, status_emoji, skype, status_expireation, status_text_canonical, title } }
    const data = await web.users.profile.get().catch((e) => {
      console.error("error fetching slack profile: ", e.message);
    });
    // set the cached var and return it
    current_slack_status = data && data.profile ? data.profile.status_text : "";
    return current_slack_status;
  }
  return null;
}

/**
 * Return the users presence:
 * {auto_away (bool), connection_count (int), last_activity (unix), manual_away (bool), ok (bool), online (bool), presence: ['active'|'away']}
 */
export async function getSlackPresence() {
  const registered = checkRegistration(false);
  if (!registered) {
    return null;
  }
  // return the 1st one
  const integrations = getSlackWorkspaces();
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    // ok: true, presence: "active", online: true, auto_away: false, manual_away: false, connection_count: 1, last_activity: 1609959319
    const data = await web.users.getPresence().catch((e) => {
      console.error("error fetching slack presence: ", e.message);
    });
    // set the cached var and return it
    current_slack_presence = data && data.presence ? data.presence : "active";
    return current_slack_presence;
  }
  return null;
}

export async function toggleSlackPresence() {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }

  const integrations = getSlackWorkspaces();
  if (integrations.length === 0) {
    promptSlackConnect();
    return;
  }

  // presence val can be either: auto or away
  current_slack_presence = current_slack_presence === "active" ? "away" : "auto";
  let updatedPresence = false;
  for (let i = 0; i < integrations.length; i++) {
    const integration = integrations[i];
    const web = new WebClient(integration.access_token);
    const presenceUpdate = { presence: current_slack_presence };
    await web.users
      .setPresence({ presence: current_slack_presence })
      .then(() => {
        updatedPresence = true;
      })
      .catch((e) => {
        console.error("error updating slack presence: ", e.message);
      });
  }
  if (updatedPresence) {
    atom.notifications.addInfo("Presence update", { detail: "Slack presence updated", dismissable: true });
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Code-Time:refresh-code-time-metrics'
    );
  }
}

export async function shareSlackSongOrPlaylist(selectedSharePlaylistTrackId, isPlaylist) {

  const registered = checkRegistration(false);
  if (!registered) {
    return null;
  }

  shareLink = buildSpotifyLink(
      selectedSharePlaylistTrackId,
      isPlaylist
  );
  shareMessage = `Check out this song`;
  showSlackWorkspaceSelection(showChannelsToPostShareCallback);
}

export function shareSlackMessage(message) {
  const registered = checkRegistration();
  if (!registered) {
    return;
  }
  shareMessage = message;
  showSlackWorkspaceSelection(showChannelsToPostShareCallback);
}

export async function showChannelsToPostShareCallback(selectedWorkspace) {
  if (!selectedWorkspace) {
    return;
  } else if (selectedWorkspace === "Music-Time:connect-slack") {
    // call the connect slack workflow
    connectSlackWorkspace();
    return;
  }
  // show the channel to select
  let channels = await getChannels(selectedWorkspace);
  showSlackChannelMenuOptions(shareSlackMessageCallback, channels);
}

export function shareSlackMessageCallback(selected_channel, access_token) {
  if (!selected_channel) {
    return;
  }
  selectedToken = access_token;
  selectedChannel = selected_channel;
  showSlackMessageInputPrompt(shareSlackMessageCompletionCallback, shareMessage);
}

export function shareSlackMessageCompletionCallback(text) {
  if (!text) {
    return;
  }
  let messagePost = text
  if (shareLink) {
    messagePost += `\n${shareLink}`;
  }
  postMessage(selectedChannel, selectedToken, messagePost);
}

// -------------------------------------------
// - private methods
// -------------------------------------------

async function showSlackWorkspaceSelection(callback) {
  let items = [];

  const integrations = getSlackWorkspaces();
  integrations.forEach((integration) => {
    items.push({
      text: integration.team_domain,
      value: integration,
    });
  });

  items.push({
    text: "Connect a Slack workspace",
    value: "Music-Time:connect-slack",
  });

  showSlackWorkspaceMenuOptions(callback, items);
}

function showMessageInputPrompt() {
  showSlackMessageInputPrompt(showMessageInputPromptCallback);
}

function showMessageInputPromptCallback(text) {
  if (!text) {
    return "Please enter a valid message to continue.";
  }
  if (text.length > 100) {
    return "The Slack status must be 100 characters or less.";
  }
  let status = {
    status_text: text,
    status_expiration: 0
  }
  updateSlackStatusProfileCallback(status);
}

function getWorkspaceAccessToken(team_domain) {
  const integration = getSlackWorkspaces().find((n) => n.team_domain === team_domain);
  if (integration) {
    return integration.access_token;
  }
  return null;
}

async function getChannels(selectedWorkspace) {
  if (!selectedWorkspace) {
    return [];
  }
  const access_token = selectedWorkspace.access_token;

  const web = new WebClient(access_token);
  const result = await web.conversations.list({ exclude_archived: true }).catch((err) => {
    console.log("Unable to retrieve slack channels: ", err.message);
    return [];
  });
  if (result && result.ok) {
    /**
    created:1493157509
    creator:'U54G1N6LC'
    id:'C53QCUUKS'
    is_archived:false
    is_channel:true
    is_ext_shared:false
    is_general:true
    is_group:false
    is_im:false
    is_member:true
    is_mpim:false
    is_org_shared:false
    is_pending_ext_shared:false
    is_private:false
    is_shared:false
    name:'company-announcements'
    name_normalized:'company-announcements'
    num_members:20
    */
    // update the channel objects to contain value and text
    const channels = result.channels.map(n => {
        return {
          ...n,
          value: n.id,
          text: n.name_normalized,
          token: access_token
        };
    });

    channels.sort(compareLabels);
    return channels;
  }
  return [];
}

export async function getSlackAuth() {
  const { user } = await getUserRegistrationState();
  return await updateSlackIntegrations(user);
}

/**
 * Recursive function to determine slack connection
 * @param tryCountUntilFoundUser
 */
async function refetchSlackConnectStatusLazily(tryCountUntilFoundUser) {
  const slackAuth = await getSlackAuth();
  if (!slackAuth) {
    // try again if the count is not zero
    if (tryCountUntilFoundUser > 0) {
      tryCountUntilFoundUser -= 1;
      setTimeout(() => {
        refetchSlackConnectStatusLazily(tryCountUntilFoundUser);
      }, 10000);
    } else {
      // clear the auth callback state
      fileUtil.setAuthCallbackState(null);
    }
  } else {
    // clear the auth callback state
    fileUtil.setAuthCallbackState(null);
    atom.notifications.addInfo("Slack connect", { detail: "Successfully connected to Slack", dismissable: true });

    // refresh the tree view
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'Music-Time:toggle-slack-workspaces'
    );
  }
}


/**
 * Post the message to the slack channel
 * @param selectedChannel
 * @param message
 */
async function postMessage(selectedChannel, access_token, message, isCodeBlock = false) {
  if (isCodeBlock) {
    message = "```" + message + "```";
  }
  const web = new WebClient(access_token);
  web.chat.postMessage({
      text: message,
      channel: selectedChannel,
      as_user: true,
    })
    .catch((err) => {
      if (err.message) {
        console.log("error posting slack message: ", err.message);
      }
    });
}

/**
 * Remove an integration from the local copy
 * @param authId
 */
function removeSlackIntegration(authId) {
  const currentIntegrations = getSlackWorkspaces();

  const newIntegrations = currentIntegrations.filter((n) => n.authId !== authId);
  fileUtil.syncIntegrations(newIntegrations);
}

function checkRegistration(showSignup = true) {
  if (!fileUtil.getItem("name")) {
    if (showSignup) {
      atom.confirm({
          message: "Connecting Slack requires a registered account. Sign up or log in to continue.",
          detailedMessage: "",
          buttons: ["Sign up", "Cancel"]
      }, (resp) => {
          if (resp === 0) {
            initiateSignupFlow();
          }
      });
    }
    return false;
  }
  return true;
}

function promptSlackConnect() {
  atom.confirm({
      message: "To update your status on Slack, please connect your account.",
      detailedMessage: "",
      buttons: ["Connect", "Cancel"]
  }, (resp) => {
      if (resp === 0) {
        connectSlackWorkspace();
      }
  });
}

/**
 * Show the list of channels in the command palette
 */
async function showStatusUpdateOptions() {
  showSlackStatusUpdateOptions(setProfileStatusCallback);
}

// get the slack do not disturb info
async function getSlackDnDInfoPerDomain(team_domain) {
  let dndInfo = null;
  const accessToken = getWorkspaceAccessToken(team_domain);
  if (accessToken) {
    const web = new WebClient(accessToken);
    dndInfo = await web.dnd.info().catch((e) => {
      console.error("Error fetching slack do not disturb info: ", e.message);
      return null;
    });
  }
  return dndInfo;
}

function compareLabels(a, b) {
  if (a.name > b.name) return 1;
  if (b.name > a.name) return -1;

  return 0;
}

function buildSpotifyLink(id, isPlaylist) {
    let link = '';
    id = createSpotifyIdFromUri(id);
    if (isPlaylist == '1') {
        link = `https://open.spotify.com/playlist/${id}`;
    } else {
        link = `https://open.spotify.com/track/${id}`;
    }

    return link;
}

function createSpotifyIdFromUri(id) {
  if (id && id.indexOf('spotify:') === 0) {
      return id.substring(id.lastIndexOf(':') + 1);
  }
  return id;
}
