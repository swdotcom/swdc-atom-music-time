'use babel';
// import { buildQueryString, launchWebUrl, getItem } from "../Util";
const utilMgr = require('../UtilManager');
import  KpmMusicControlManager  from "../music/KpmMusicControlManager";
import {
    showSlackChannelMenu,
    connectSlack
} from "../SlackControlManager";
const { WebClient } = require("@slack/web-api");

let musicId = "";
let title = "";
let spotifyLinkUrl = "";
let playlistSelected = false;

export default  class SocialShareManager {
    // private static instance;

    constructor() {
        this.musicControlMgr = new KpmMusicControlManager();
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
                shareUrl: "https://www.facebook.com/sharer/sharer.php",
                params: {
                    u: options["url"],
                    hashtag: options["hashtag"]
                }
            },
            // linkedin: {
            //     shareUrl: "https://www.linkedin.com/shareArticle",
            //     params: {
            //         url: options["url"],
            //         mini: true
            //     }
            // },
            twitter: {
                shareUrl: "https://twitter.com/intent/tweet/",
                params: {
                    text: options["title"],
                    url: options["url"],
                    hashtags: options["hashtags"],
                    via: options["via"]
                }
            },
            tumblr: {
                shareUrl: "http://tumblr.com/widgets/share/tool",
                params: {
                    canonicalUrl: options["url"],
                    content: options["url"],
                    posttype: "link",
                    title: options["title"],
                    caption: options["caption"],
                    tags: options["tags"]
                }
            },
            whatsapp: {
                shareUrl: "https://api.whatsapp.com/send",
                params: {
                    text: `${options["title"]}: ${options["url"]}`
                },
                isLink: true
            }
        };

        const sharerObj = sharers[sharer.toLowerCase()];
        const queryStr = utilMgr.buildQueryString(sharerObj.params);
        const shareUrl = `${sharerObj.shareUrl}${queryStr}`;
        return shareUrl;
    }


    copyLink() {
        musicControlMgr.copySpotifyLink(
            musicId,
            playlistSelected
        );
    }

    

    async showSlackMessageInputPrompt() {
        return await window.showInputBox({
            value: `${title}`,
            placeHolder: "Enter a message to appear in the selected channel",
            validateInput: text => {
                return !text
                    ? "Please enter a valid message to continue."
                    : null;
            }
        });
    }

    async validateMessage(name) {
        // ...validate...
        await new Promise(resolve => setTimeout(resolve, 1000));
        // return name === 'vscode' ? 'Name not unique' : undefined;
    }

    async shareSlack() {
        const selectedChannel = await showSlackChannelMenu();
        if (!selectedChannel) {
            return;
        }
        // !!! important, need to use the get instance as this
        // method may be called within a callback and "this" will be undefined !!!
        const message = await SocialShareManager.getInstance().showSlackMessageInputPrompt();
        if (!message) {
            return;
        }
        const slackAccessToken = getItem("slack_access_token");
        const msg = `${message}\n${spotifyLinkUrl}`;
        const web = new WebClient(slackAccessToken);
        await web.chat
            .postMessage({
                text: msg,
                channel: selectedChannel,
                as_user: true
            })
            .catch(err => {
                // try without sending "as_user"
                web.chat
                    .postMessage({
                        text: msg,
                        channel: selectedChannel
                    })
                    .catch(err => {
                        if (err.message) {
                            console.log(
                                "error posting slack message: ",
                                err.message
                            );
                        }
                    });
            });
    }
}
