'use babel';

const fileUtil = require("../FileUtil");

const slackClient = {};

slackClient.updateSlackAccessInfo = async (slackOauth) => {
    /**
     * {access_token, refresh_token}
     */
    if (slackOauth) {
        fileUtil.setItem('slack_access_token', slackOauth.access_token);
    } else {
        fileUtil.setItem('slack_access_token', null);
    }
};

module.exports = slackClient;
