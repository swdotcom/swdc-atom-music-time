'use babel';

const { WebClient } = require("@slack/web-api");
const fileUtil = require("../utils/FileUtil");

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

export async function updateSpotifyIntegrations(user) {
  const existingSpotifyIntegrations = fileUtil.getIntegrations().filter((n) => n.name.toLowerCase() === "spotify");
  const existingSpotifyIntegration = existingSpotifyIntegrations.length ? existingSpotifyIntegrations[existingSpotifyIntegrations.length - 1] : null;
  if (user && user.integrations && user.integrations.length) {
    const spotifyIntegrations = user.integrations.filter(
      (n) => n.name.toLowerCase() === "spotify" && n.status.toLowerCase() === "active" && n.access_token
    );
    if (spotifyIntegrations.length) {
      // sort by updatedAt desc
      const sortedActivities = spotifyIntegrations.sort((a, b) => {
        const aDate = new Date(a.updatedAt).getTime();
        const bDate = new Date(b.updatedAt).getTime();
        if (aDate > bDate) return 1;
        if (aDate < bDate) return -1;
        return 0;
      });
      const spotifyIntegration = sortedActivities[0];
      fileUtil.syncSpotifyIntegrations(spotifyIntegration);
      return true;
    }
  }
  return false;
}

export async function updateSlackIntegrations(user) {
    let foundNewIntegration = false;
    const slackIntegrations = [];
    if (user && user.registered === 1 && user.integrations) {
      let currentIntegrations = fileUtil.getIntegrations();
        // find the slack auth
        for (const integration of user.integrations) {
            // {access_token, name, plugin_uuid, scopes, pluginId, authId, refresh_token, scopes}
            if (
                integration.name.toLowerCase() === 'slack' &&
                integration.status.toLowerCase() === 'active' &&
                integration.access_token
            ) {
                // check if it exists
                const currentIntegration = currentIntegrations.find(
                    (n) => n.authId === integration.authId
                );
                if (!currentIntegration || !currentIntegration.team_domain) {
                    // get the workspace domain using the authId
                    const web = new WebClient(integration.access_token);
                    delete web['axios'].defaults.headers['User-Agent'];
                    const usersIdentify = await web.users
                        .identity()
                        .catch((e) => {
                            console.log(
                                'error fetching slack team info: ',
                                e.message
                            );
                            return null;
                        });
                    if (usersIdentify) {
                        // usersIdentity returns
                        // {team: {id, name, domain, image_102, image_132, ....}...}
                        // set the domain
                        integration['team_domain'] = usersIdentify.team
                            ? usersIdentify.team.domain
                            : '';
                        integration['team_name'] = usersIdentify.team
                            ? usersIdentify.team.name
                            : '';
                        integration['integration_id'] = usersIdentify.user
                            ? usersIdentify.user.id
                            : '';
                        // add it
                        slackIntegrations.push(integration);
                        foundNewIntegration = true;
                    } else {
                      slackIntegrations.push(currentIntegration);
                    }
                }
            }
        }
    }
    fileUtil.syncSlackIntegrations(slackIntegrations);
    return foundNewIntegration;
}

export function clearSpotifyIntegrations() {
  const newIntegrations = fileUtil.getIntegrations().filter((n) => n.name.toLowerCase() !== "spotify");
  fileUtil.syncIntegrations(newIntegrations);
}
