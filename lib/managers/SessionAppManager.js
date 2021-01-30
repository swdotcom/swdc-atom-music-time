'use babel';
import {
    isResponseOk,
    softwareGet
} from '../client/HttpClient';

const fileUtil = require("../utils/FileUtil");
const fileDataMgr = require('./FileDataManager');
const { updateSessionFromSummaryApi } = require('./TimeDataManager');

const sessionAppMgr = {};

// update the sessionSummary.json data from the server
sessionAppMgr.updateSessionSummaryFromServer = async () => {
    const jwt = fileUtil.getItem('jwt');
    const result = await softwareGet(
        `/sessions/summary?refresh=true`,
        jwt
    );
    if (isResponseOk(result) && result.data) {
        const data = result.data;

        // update the session summary data
        const summary = fileDataMgr.getSessionSummaryData();
        Object.keys(data).forEach(key => {
            const val = data[key];
            if (val !== null && val !== undefined) {
                summary[key] = val;
            }
        });

        // if the summary.currentDayMinutes is greater than the wall
        // clock time then it means the plugin was installed on a
        // different computer or the session was deleted
        updateSessionFromSummaryApi(summary.currentDayMinutes);

        fileDataMgr.saveSessionSummaryToDisk(summary);
    }
};

module.exports = sessionAppMgr;
