'use babel';

import { app_endpoint } from '../Constants';

const utilMgr = require('./UtilManager');
const {
  initiateSignupFlow,
  showSlackMessageInputPrompt,
  showSlackStatusUpdateOptions,
  showSlackChannelMenuOptions,
  showSlackWorkspaceMenuOptions } = require("../utils/PopupUtil");
const { WebClient } = require("@slack/web-api");
const fileUtil = require("../utils/FileUtil");
const serviceUtil = require("../utils/ServiceUtil");


let current_slack_status = "";
let shareMessage = "";
let shareLink = "";
let selectedToken = "";

// -------------------------------------------
// - public methods
// -------------------------------------------

export async function getSlackWorkspaces() {
  const currentUser = await serviceUtil.getCachedUser();
  if (currentUser && currentUser.integration_connections && currentUser.integration_connections.length) {
    return currentUser.integration_connections.filter(
      (integration) => integration.status === 'ACTIVE' && (integration.integration_type_id === 14));
  }
  return [];
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

  const url = `${app_endpoint}/data_sources/integration_types/slack`;

  // authorize the user for slack
  utilMgr.launchWebUrl(url);
}

export function disconnectSlackWorkspace() {
  utilMgr.launchWebUrl(`${app_endpoint}/data_sources/integration_types/slack`);
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
  const integrations = await getSlackWorkspaces();
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

  const integrations = await getSlackWorkspaces();
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
