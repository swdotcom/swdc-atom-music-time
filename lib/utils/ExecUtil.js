'use babel';

import { execCmd } from "../managers/ExecManager";

const os = require('os');

const execUtil = {};

execUtil.getHostname = async () => {
    const hostname = execCmd('hostname');
    return hostname;
};

execUtil.getOsUsername = async () => {
    let username = os.userInfo().username;
    if (!username || username.trim() === '') {
        username = execCmd('whoami');
    }
    return username;
};

module.exports = execUtil;
