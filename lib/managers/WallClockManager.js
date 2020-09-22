"use babel";

const utilMgr = require("./UtilManager");
const moment = require("moment-timezone");

const wallClockMgr = {};

wallClockMgr.init = async () => {
};

wallClockMgr.getHumanizedWcTime = () => {
    return utilMgr.humanizeMinutes(_wctime / 60);
};


module.exports = wallClockMgr;
