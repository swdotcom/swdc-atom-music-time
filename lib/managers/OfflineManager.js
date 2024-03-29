'use babel';

const fileUtil = require('../utils/FileUtil');
const commonUtil = require("../utils/CommonUtil");

const fileIt = require("file-it");

/**
 * Handles the offline calculation update.
 **/
let offlineMgr = {};

let sessionSummaryData = {
    currentDayMinutes: 0,
    averageDailyMinutes: 0,
    averageDailyKeystrokes: 0,
    currentDayKeystrokes: 0,
    liveshareMinutes: 0,
};

offlineMgr.clearSessionSummaryData = () => {
    sessionSummaryData = {
        currentDayMinutes: 0,
        averageDailyMinutes: 0,
        averageDailyKeystrokes: 0,
        currentDayKeystrokes: 0,
        liveshareMinutes: 0,
    };

    offlineMgr.saveSessionSummaryToDisk(offlineMgr.getSessionSummaryData());
};

offlineMgr.setSessionSummaryLiveshareMinutes = minutes => {
    sessionSummaryData.liveshareMinutes = minutes;
};

offlineMgr.incrementSessionSummaryData = (minutes, keystrokes) => {
    sessionSummaryData.currentDayMinutes += minutes;
    sessionSummaryData.currentDayKeystrokes += keystrokes;
};

offlineMgr.updateStatusBarWithSummaryData = () => {
    // update the session summary data with what is found in the sessionSummary.json

    sessionSummaryData = offlineMgr.getSessionSummaryFileAsJson();
};

offlineMgr.getSessionSummaryData = () => {
    return sessionSummaryData;
};

offlineMgr.getSessionSummaryFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

offlineMgr.saveSessionSummaryToDisk = sessionSummaryData => {
  fileIt.writeJsonFileSync(offlineMgr.getSessionSummaryFile(), sessionSummaryData);
};

offlineMgr.getSessionSummaryFileAsJson = () => {
    let data = fileIt.readJsonFileSync(offlineMgr.getSessionSummaryFile());
    return data ? data : {};
};

offlineMgr.getCurrentPayloadFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
        file += '\\latestKeystrokes.json';
    } else {
        file += '/latestKeystrokes.json';
    }
    return file;
};

offlineMgr.getCurrentPayload = () => {
    let data = fileIt.readJsonFileSync(offlineMgr.getCurrentPayloadFile());
    return data ? data : {};
};

module.exports = offlineMgr;
