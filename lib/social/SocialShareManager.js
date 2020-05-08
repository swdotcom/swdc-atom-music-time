'use babel';
// import { buildQueryString, launchWebUrl, getItem } from "../Util";
import fs from 'fs';
import $ from 'jquery';
import path from 'path';
const utilMgr = require('../UtilManager');
import KpmMusicControlManager from '../music/KpmMusicControlManager';

const { WebClient } = require('@slack/web-api');
// const socialInstance = new SocialShareManager();
let musicId = '';
let title = '';
let playlistSelected = false;
let message = '';
$(document).on('click', '#closePrompt', function() {
    const socialInstance = SocialShareManager.getInstance();
    socialInstance.closeShareTextPrompt();
});
$(document).on('change' , "#msgText" ,function() {
    message = $(this).val();
});

$(document).on('keypress' , "#msgText" ,function() {
    $('#slack-error').hide();
});

$(document).on('click', '#submitShareText', function() {
    const socialInstance = SocialShareManager.getInstance();
    // message = $('#msgText').val();

    // message = $(this).val();
    if(message) {
        console.log(message);
        socialInstance.shareSlack(message);
    } else {
        $('#slack-error').show();
        // utilMgr.notifyWarn('Music Time','Message field is required');
    }

});

export default class SocialShareManager {
    // private static instance;

    constructor() {
        this.musicControlMgr = KpmMusicControlManager.getInstance();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new SocialShareManager();
        }

        return this.instance;
    }

    shareIt(sharer, options) {
        let shareUrl = this.getShareUrl(sharer, options);
        utilMgr.launchWebUrl(shareUrl);
    }

    getShareUrl(sharer, options) {
        const sharers = {
            facebook: {
                shareUrl: 'https://www.facebook.com/sharer/sharer.php',
                params: {
                    u: options['url'],
                    hashtag: options['hashtag'],
                },
            },
            // linkedin: {
            //     shareUrl: "https://www.linkedin.com/shareArticle",
            //     params: {
            //         url: options["url"],
            //         mini: true
            //     }
            // },
            twitter: {
                shareUrl: 'https://twitter.com/intent/tweet/',
                params: {
                    text: options['title'],
                    url: options['url'],
                    hashtags: options['hashtags'],
                    via: options['via'],
                },
            },
            tumblr: {
                shareUrl: 'http://tumblr.com/widgets/share/tool',
                params: {
                    canonicalUrl: options['url'],
                    content: options['url'],
                    posttype: 'link',
                    title: options['title'],
                    caption: options['caption'],
                    tags: options['tags'],
                },
            },
            whatsapp: {
                shareUrl: 'https://api.whatsapp.com/send',
                params: {
                    text: `${options['title']}: ${options['url']}`,
                },
                isLink: true,
            },
        };

        const sharerObj = sharers[sharer.toLowerCase()];
        const queryStr = utilMgr.buildQueryString(sharerObj.params);
        const shareUrl = `${sharerObj.shareUrl}${queryStr}`;
        return shareUrl;
    }

    copyLink() {
        musicControlMgr.copySpotifyLink(musicId, playlistSelected);
    }



    async validateMessage(name) {
        // ...validate...
        await new Promise(resolve => setTimeout(resolve, 1000));
        // return name === 'vscode' ? 'Name not unique' : undefined;
    }

    closeShareTextPrompt() {
        const propmtBoxDiv = document.createElement('div');
        const htmlString = fs.readFileSync(
            path.join(__dirname, '../..', 'templates', 'slackSharePrompt.html'),
            {
                encoding: 'utf-8',
            }
        );
        propmtBoxDiv.innerHTML = htmlString;
        atom.workspace.addModalPanel({
            item: propmtBoxDiv,
            visible: false,
            priority: 4,
        });
        message = '';
    }

    shareTextPrompt(spotifyLinkUrl, selectedChannel, isPlaylist) {
        if(isPlaylist == '1') {
            message = 'Checkout this playlist';
        } else {
            message = 'Checkout this song';
        }
        // const isSharePlaylist = localStorage.getItem('isSharePlaylist');
        utilMgr.clearNotification();
        // atom.notifications.clear();
        this._spotifyLinkUrl = spotifyLinkUrl;
        this._selectedChannel = selectedChannel;
        if (!selectedChannel) {
            return;
        }
        // this.propmtBoxDiv = document.createElement('div');
        // const htmlString = fs.readFileSync(
        //     path.join(__dirname, '../..', 'templates', 'slackSharePrompt.html'),
        //     {
        //         encoding: 'utf-8',
        //     }
        // );
        // this.propmtBoxDiv.innerHTML = htmlString;

        // atom.workspace.addModalPanel({
        //     item: this.propmtBoxDiv,
        //     visible: true,
        //     priority: 4,
        // });
        this.shareSlack(message)

    }

    async shareSlack(message) {
        // const isSharePlaylist = localStorage.getItem('isSharePlaylist');
        const slackAccessToken = utilMgr.getItem('slack_access_token');
        const msg = `${message}\n${this._spotifyLinkUrl}`;
        const web = new WebClient(slackAccessToken);
        await web.chat
            .postMessage({
                text: msg,
                channel: this._selectedChannel,
                as_user: true,
            })
            .catch(err => {
                // try without sending "as_user"
                web.chat
                    .postMessage({
                        text: msg,
                        channel: this._selectedChannel,
                    })
                    .catch(err => {
                        if (err.message) {
                            console.log(
                                'error posting slack message: ',
                                err.message
                            );
                        }
                    });
                this.closeShareTextPrompt();

                utilMgr.clearNotification();
            });
    }
}
