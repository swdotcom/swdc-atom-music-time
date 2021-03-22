'use babel';

const { WebClient } = require("@slack/web-api");
const fileUtil = require("../utils/FileUtil");

export async function updateSlackIntegrations(user) {
  if (user && user.integrations) {
    return await updateIntegrations(user, "slack");
  }
  return false;
}

export async function updateSpotifyIntegrations(user) {
  if (user && user.integrations) {
    return await updateIntegrations(user, "spotify");
  }
  return false;
}

export function getSpotifyIntegration() {
  const spotifyIntegrations = fileUtil.getIntegrations().filter(
    (n) => n.name.toLowerCase() === "spotify" && n.status.toLowerCase() === "active"
  );
  if (spotifyIntegrations.length) {
    // get the last one in case we have more than one.
    // the last one is the the latest one created.
    return spotifyIntegrations[spotifyIntegrations.length - 1];
  }
  return null;
}

export function requiresSpotifyAccess() {
  return getSpotifyIntegration() ? false : true;
}

export async function updateIntegrations(user, name) {
  let foundNewIntegration: boolean = false;
  let currentIntegrations = fileUtil.getIntegrations();
  const integrations = [];
  for (const integration of user.integrations) {
    const isActive = !!(integration.name.toLowerCase() === name && integration.status.toLowerCase() === "active" && integration.access_token);
    // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
    if (isActive) {
      const isFound = currentIntegrations.length ? currentIntegrations.find((n) => n.authId === integration.authId) : null;
      // get the team domain and name if this is a slack integration
      if (!isFound) {
        if (name === "slack") {
          // get the workspace domain using the authId
          const web = new WebClient(integration.access_token);
          try {
            const usersIdentify = await web.users.identity();

            // usersIdentity returns
            // {team: {id, name, domain, image_102, image_132, ....}...}
            // set the domain
            if (usersIdentify) {
              integration["team_domain"] = usersIdentify.team ? usersIdentify.team.domain : "";
              integration["team_name"] = usersIdentify.team ? usersIdentify.team.name : "";
              integration["integration_id"] = usersIdentify.user ? usersIdentify.user.id : "";
              foundNewIntegration = true;
            }
          } catch (e) {
            console.error("slack users identity error: ", e.message);
          }
        } else {
          foundNewIntegration = true;
        }
      }
      // add it
      integrations.push(integration);
    }
  }

  fileUtil.syncIntegrations(integrations);

  return foundNewIntegration;
}

export function clearSpotifyIntegrations() {
  const newIntegrations = fileUtil.getIntegrations().filter((n) => n.name.toLowerCase() !== "spotify");
  fileUtil.syncIntegrations(newIntegrations);
}
