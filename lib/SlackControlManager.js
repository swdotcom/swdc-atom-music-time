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
import $ from 'jquery';

var isSlackSharePlaylist = '0';
var selectedSharePlaylistTrackId = '';
$(document).on('change', '#selectChannel', function() {
    let selectedChannel = $(this).val();
    const socialShare = SocialShareManager.getInstance();

    const url = buildSpotifyLink(
        selectedSharePlaylistTrackId,
        isSlackSharePlaylist
    );
    socialShare.shareTextPrompt(url,selectedChannel,isSlackSharePlaylist);
    
});

export async function connectSlack() {
    // authorize the user for slack
    let jwt = utilMgr.getItem(
        'jwt'
    );
    // const endpoint = `${api_endpoint}/auth/slack?integrate=slack&plugin=musictime&token=${utilMgr.getItem(
    //     'jwt'
    // )}`;
    const encodedJwt = encodeURIComponent(jwt);
    const qryStr = `integrate=slack&plugin=musictime&token=${encodedJwt}`;

    // authorize the user for slack
    const endpoint = `${api_endpoint}/auth/slack?${qryStr}`;

    utilMgr.launchWebUrl(endpoint);
    utilMgr.refetchSlackConnectStatusLazily();
   
    
}

export async function showSlackChannelMenu(_selectedSharePlaylistTrackId,isPlaylist) {
    selectedSharePlaylistTrackId = _selectedSharePlaylistTrackId;
    let menuOptions = {
        items: [],
        placeholder: 'Select a channel',
    };
    isSlackSharePlaylist = isPlaylist;
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
            socialShare.shareTextPrompt(url,channel,isPlaylist);
            // console.log(channel);
        };
        channelButton.push(channelObj);
    });
    // utilMgr.notifyButton('Music Time', `Select Channel`, channelButton);

    var myDiv = document.createElement('div');
        var closeButton = document.createElement('span');
        closeButton.setAttribute('style', 'float:right;margin-bottom: 10px;');
        closeButton.setAttribute('id', 'closeChannel');
        closeButton.innerHTML =
            '<img alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" />';
        var selectList = document.createElement('select');
        selectList.setAttribute('id', 'selectChannel');
        selectList.setAttribute(
            'style',
            ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
        );

        myDiv.appendChild(closeButton);
        myDiv.appendChild(selectList);

        var defaultOoption = document.createElement('option');
        defaultOoption.value = '';
        defaultOoption.text = 'Select Channel';
        selectList.appendChild(defaultOoption);
        channelButton.forEach(channel => {
            
            var option = document.createElement('option');
            option.value = channel.text;
            option.text = channel.text;
            selectList.appendChild(option);
        });

        atom.workspace.addModalPanel({
            item: myDiv,
            visible: true,
            priority: 4,
        });
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
    const musicMgr = KpmMusicManager.getInstance();
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


