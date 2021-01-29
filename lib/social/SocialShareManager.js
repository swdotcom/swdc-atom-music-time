'use babel';

import KpmMusicControlManager from '../music/KpmMusicControlManager';

const utilMgr = require('../managers/UtilManager');


let musicId = '';
let playlistSelected = false;

export async function shareIt(sharer, options) {
    let shareUrl = getShareUrl(sharer, options);
    utilMgr.launchWebUrl(shareUrl);
}

function getShareUrl(sharer, options) {
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

function copyLink() {
    KpmMusicControlManager.getInstance().copySpotifyLink(musicId, playlistSelected);
}

async function validateMessage(name) {
    // ...validate...
    await new Promise(resolve => setTimeout(resolve, 1000));
    // return name === 'vscode' ? 'Name not unique' : undefined;
}
