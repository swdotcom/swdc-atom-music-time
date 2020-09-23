'use babel';

import { api_endpoint, CLOSE_BOX } from '../Constants';
import { buildSpotifyLink } from '../music/KpmMusicControlManager';
import KpmMusicManager from '../music/KpmMusicManager';
import $ from 'jquery';
import fs from 'fs';
import path from 'path';

const fileIt = require("file-it");
const utilMgr = require('./UtilManager');
const fileUtil = require("../utils/FileUtil");
const { WebClient } = require('@slack/web-api');

let isSlackSharePlaylist = '0';
let selectedSharePlaylistTrackId = '';
let selectedChannel = "";
let isPlaylistShare = false;
let url = "";
let message = "";

$(document).on('click', '#close-search', function(e) {
    closeSlackInput();
});

$(document).on('change' , "#msgText" ,function() {
    message = $(this).val();
});

$(document).on('click', '#submitShareText', function() {
    message = message || "Check out this song";

    shareSlack(message);
    closeSlackInput();
});

function closeSlackInput() {
    const propmtBoxDiv = document.createElement('div');
    const filename = path.join(__dirname, '..', 'templates', 'slackSharePrompt.html');
    const htmlString = fileIt.readContentFileSync(filename);
    propmtBoxDiv.innerHTML = htmlString;
    atom.workspace.addModalPanel({
        item: propmtBoxDiv,
        visible: false,
        priority: 4,
    });
    message = '';
}

$(document).on('change', '#selectChannel', function() {
    selectedChannel = $(this).val();
    url = buildSpotifyLink(
        selectedSharePlaylistTrackId,
        isSlackSharePlaylist
    );

    // show the search input
    const propmtBoxDiv = document.createElement('div');
    const filename = path.join(__dirname, '..', 'templates', 'slackSharePrompt.html');
    const htmlString = fileIt.readContentFileSync(filename);
    propmtBoxDiv.innerHTML = htmlString;

    atom.workspace.addModalPanel({
        item: propmtBoxDiv,
        visible: true,
        priority: 4,
    });

    if (isPlaylistShare) {
        $("#msgText").val("Check out this playlist");
    }
});

$(document).on('click', '#closeChannel', function() {
    closeChannel();
});

export async function connectSlack() {
    utilMgr.clearNotification();

    // authorize the user for slack
    let jwt = fileUtil.getItem('jwt');

    const encodedJwt = encodeURIComponent(jwt);
    const qryStr = `integrate=slack&plugin=musictime&token=${encodedJwt}`;

    // authorize the user for slack
    const endpoint = `${api_endpoint}/auth/slack?${qryStr}`;

    utilMgr.launchWebUrl(endpoint);
    setTimeout(() => {
        utilMgr.refetchSlackConnectStatusLazily();
    }, 1000);
}

export async function showSlackChannelMenu(
    _selectedSharePlaylistTrackId,
    isPlaylist
) {
    isPlaylistShare = isPlaylist;
    selectedSharePlaylistTrackId = _selectedSharePlaylistTrackId;
    let menuOptions = {
        items: [],
        placeholder: 'Select a channel',
    };
    isSlackSharePlaylist = isPlaylist;

    // get the available channels
    const channelNames = await getChannelNames();
    channelNames.sort();

    channelNames.forEach(channelName => {
        menuOptions.items.push({
            label: channelName,
        });
    });

    let channelButton = [];
    channelNames.forEach(channel => {
        let channelObj = {};
        channelObj['className'] = 'btn btn-info';
        channelObj['text'] = channel;
        channelObj['onDidClick'] = function() {
            const url = buildSpotifyLink(
                _selectedSharePlaylistTrackId,
                isPlaylist
            );
        };
        channelButton.push(channelObj);
    });
    // utilMgr.notifyButton('Music Time', `Select Channel`, channelButton);

    var myDiv = document.createElement('div');
    var closeButton = document.createElement('span');
    closeButton.setAttribute(
        'style',
        'float:right;margin-bottom: 10px;cursor:pointer;'
    );
    closeButton.setAttribute('id', 'closeChannel');
    closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
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

function closeChannel() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

async function getChannels() {
    const slackAccessToken = fileUtil.getItem('slack_access_token');
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
    const spotifyOauth = await utilMgr.getSlackOauth();
    if (spotifyOauth) {
        // update the CodyMusic credentials
        musicMgr.updateSlackAccessInfo(spotifyOauth);
    } else {
        fileUtil.setItem('slack_access_token', null);
    }
}

async function shareSlack(message) {
    // const isSharePlaylist = localStorage.getItem('isSharePlaylist');
    const slackAccessToken = fileUtil.getItem('slack_access_token');
    const msg = `${message}\n${url}`;
    const web = new WebClient(slackAccessToken);
    await web.chat
        .postMessage({
            text: msg,
            channel: selectedChannel,
            as_user: true,
        })
        .catch(err => {
            // try without sending "as_user"
            web.chat
                .postMessage({
                    text: msg,
                    channel: this.selectedChannel,
                })
                .catch(err => {
                    if (err.message) {
                        console.log(
                            'error posting slack message: ',
                            err.message
                        );
                    }
                });


            // utilMgr.clearNotification();
        });
}
