'use babel';
import { 
    api_endpoint,CLOSE_BOX
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
        closeButton.setAttribute('style', 'float:right;margin-bottom: 10px;cursor:pointer;');
        closeButton.setAttribute('id', 'closeChannel');
        closeButton.innerHTML =
            '<img alt="" src="'+CLOSE_BOX+'" />';
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


