'use babel';
import { 
    api_endpoint,
    DISCONNECT_SLACK_MENU_LABEL,
    DISCONNECT_SLACK_COMMAND_KEY,
    CONNECT_SLACK_MENU_LABEL
} from './Constants';
// import { getItem, launchWebUrl } from "../Util";
const utilMgr = require('./UtilManager');
const { WebClient } = require('@slack/web-api');
import SocialShareManager from './social/SocialShareManager';
import { buildSpotifyLink } from './music/KpmMusicControlManager';
import  KpmMusicManager  from './music/KpmMusicManager';
export async function connectSlack() {
    // authorize the user for slack
    const endpoint = `${api_endpoint}/auth/slack?integrate=slack&plugin=musictime&token=${utilMgr.getItem(
        'jwt'
    )}`;
    utilMgr.launchWebUrl(endpoint);
    utilMgr.refetchSlackConnectStatusLazily();
    utilMgr.removeMusicMenuItem(CONNECT_SLACK_MENU_LABEL);
    utilMgr.addMusicMenuItem(
        DISCONNECT_SLACK_MENU_LABEL,
        DISCONNECT_SLACK_COMMAND_KEY
    );
    utilMgr.clearNotification();
    setTimeout(() => {
        utilMgr.notify('Music Time', `Successfully connected to Slack`);
    }, 5000);
    
}

export async function showSlackChannelMenu(_selectedSharePlaylistTrackId,isPlaylist) {
    let menuOptions = {
        items: [],
        placeholder: 'Select a channel',
    };
    // let _self = this;

    // get the available channels
    const channelNames = await getChannelNames();
    channelNames.sort();

    channelNames.forEach(channelName => {
        menuOptions.items.push({
            label: channelName,
        });
    });

    // const pick = await showQuickPick(menuOptions);
    // if (pick && pick.label) {
    //     return pick.label;
    // }
    let channelButton = [];
    channelNames.forEach(channel => {
        let channelObj = {};
        channelObj['className'] = 'btn btn-info';
        channelObj['text'] = channel;
        channelObj['onDidClick'] = function() {
            // _self.selectChannel(channel)
            const socialShare = SocialShareManager.getInstance();

            const url = buildSpotifyLink(
                _selectedSharePlaylistTrackId,
                isPlaylist
            );
            socialShare.shareTextPrompt(url,channel);
            // console.log(channel);
        };
        channelButton.push(channelObj);
    });
    utilMgr.notifyButton('Music Time', `Select Channel`, channelButton);
    return null;
}
export function selectChannel(channel) {
    console.log(channel);
}

async function getChannels() {
    const slackAccessToken = utilMgr.getItem('slack_access_token');
    const web = new WebClient(slackAccessToken);
    const result = await web.channels
        .list({ exclude_archived: true, exclude_members: true })
        .catch(err => {
            console.log('Unable to retrieve slack channels: ', err.message);
            return [];
        });
    if (result && result.ok) {
        return result.channels;
    }
    return [];
}

async function getChannelNames() {
    const channels = await getChannels();
    if (channels && channels.length > 0) {
        return channels.map(channel => {
            return channel.name;
        });
    }
    return [];
}

export async function initializeSlack() {
    const musicMgr = new KpmMusicManager();
    const serverIsOnline = await utilMgr.serverIsAvailable();
    if (serverIsOnline) {
        const spotifyOauth = await utilMgr.getSlackOauth(serverIsOnline);
        if (spotifyOauth) {
            // update the CodyMusic credentials
            musicMgr.updateSlackAccessInfo(spotifyOauth);
        } else {
            utilMgr.setItem('slack_access_token', null);
        }
    }
}


