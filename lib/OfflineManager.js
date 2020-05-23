'use babel';

const utilMgr = require('./UtilManager');
const fileUtil = require('./FileUtil');
const fs = require('fs');

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
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json';
    } else {
        file += '/sessionSummary.json';
    }
    return file;
};

offlineMgr.saveSessionSummaryToDisk = sessionSummaryData => {
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(sessionSummaryData, null, 4);
        fs.writeFileSync(offlineMgr.getSessionSummaryFile(), content, err => {
            if (err)
                console.log(
                    `Deployer: Error writing session summary data: ${err.message}`
                );
        });
    } catch (e) {
        //
    }
};

offlineMgr.getSessionSummaryFileAsJson = () => {
    let data = null;
    let file = offlineMgr.getSessionSummaryFile();
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            } catch (e) {
                console.log(`unable to read session info: ${e.message}`);
                // error trying to read the session file, delete it
                utilMgr.deleteFile(file);
                data = {};
            }
        }
    }
    return data ? data : {};
};

/**
 * Fetch the data rows of a given file
 * @param file
 */
offlineMgr.getDataRows = async file => {
    try {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
            // we're online so just delete the file
            utilMgr.deleteFile(file);
            if (content) {
                const payloads = content
                    .split(/\r?\n/)
                    .map(item => {
                        let obj = null;
                        if (item) {
                            try {
                                obj = JSON.parse(item);
                            } catch (e) {
                                //
                            }
                        }
                        if (obj) {
                            return obj;
                        }
                    })
                    .filter(item => item);
                return payloads;
            }
        }
    } catch (e) {
        utilMgr.logIt(`Unable to read data file ${file}: ${e.message}`);
    }
    return [];
};

offlineMgr.getCurrentPayloadFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (utilMgr.isWindows()) {
        file += '\\latestKeystrokes.json';
    } else {
        file += '/latestKeystrokes.json';
    }
    return file;
};

offlineMgr.getCurrentPayload = () => {
    let data = null;

    const file = offlineMgr.getCurrentPayloadFile();
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, {encoding: 'utf8'}).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            } catch (e) {
                logIt(`unable to read file info: ${e.message}`);
                data = {};
            }
        }
    }
    return data ? data : {};
};

module.exports = offlineMgr;
