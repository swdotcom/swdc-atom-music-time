const os = require('os');
const fs = require('fs');
const cp = require('child_process');
const open = require('open');

const commonUtil = {};

commonUtil.isLinux = () => {
    if (!commonUtil.isWindows() && !commonUtil.isMac()) {
        return true;
    }
    return false;
};

// process.platform return the following...
//   -> 'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
commonUtil.isWindows = () => {
    return process.platform.indexOf('win32') !== -1;
};

commonUtil.isMac = () => {
    return process.platform.indexOf('darwin') !== -1;
};

commonUtil.launchUrl = url => {
    open(url, {wait: true});
};

// error.response.data.error has...
// {message, reason, status}
commonUtil.handlePlaybackError = (resp) => {
    if (
        resp &&
        resp.error &&
        resp.error.response &&
        resp.error.response.data &&
        resp.error.response.data.error
    ) {
        const error = resp.error.response.data.error;

        atom.notifications.getNotifications().forEach(notification => {
            notification.dismiss();
        });

        atom.notifications.clear();

        atom.notifications.addInfo('Music Time', {
            detail: error.message,
            dismissable: true,
        });
    }
};

module.exports = commonUtil;
