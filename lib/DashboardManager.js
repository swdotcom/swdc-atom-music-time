'use babel';

import {
    isResponseOk,
    softwareGet,
    softwarePut,
    softwareDelete,
    softwarePost,
} from './HttpClient';

const utilMgr = require('./UtilManager');
const fileUtil = require("./FileUtil");
const offlineMgr = require('./OfflineManager');
const fs = require('fs');
const moment = require('moment-timezone');

let dashboardMgr = {};

let lastDashboardFetchTime = 0;
let day_in_sec = 60 * 60 * 24;

const SERVICE_NOT_AVAIL =
    'Our service is temporarily unavailable.\n\nPlease try again later.\n';

dashboardMgr.sendOfflineData = () => {
    const dataStoreFile = utilMgr.getSoftwareDataStoreFile();
    if (fs.existsSync(dataStoreFile)) {
        const content = fs.readFileSync(dataStoreFile, {encoding: 'utf8'}).toString();
        if (content) {
            console.log(`Music Time: sending batch payloads: ${content}`);
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

            // POST the kpm to the PluginManager
            return softwarePost(
                '/data/batch',
                payloads,
                fileUtil.getItem('jwt')
            ).then(resp => {
                if (isResponseOk(resp)) {
                    // everything is fine, delete the offline data file
                    utilMgr.deleteFile(dataStoreFile);
                    offlineMgr.clearSessionSummaryData();
                }
            });
        }
    }
};

dashboardMgr.fetchDailyKpmSessionInfo = async (forceRefresh = false) => {
    let sessionSummaryData = offlineMgr.getSessionSummaryData();
    if (sessionSummaryData.currentDayMinutes === 0 || forceRefresh) {
        let start = new Date();
        // set it to the beginning of the day
        start.setHours(0, 0, 0, 0);
        const fromSeconds = Math.round(start.getTime() / 1000);

        softwareGet(`/sessions/summary`, fileUtil.getItem('jwt'))
            .then(resp => {
                if (isResponseOk(resp)) {
                    // everything is fine, delete the offline data file
                    sessionSummaryData = resp.data;

                    // update the file
                    offlineMgr.saveSessionSummaryToDisk(sessionSummaryData);
                    // update the status bar
                    offlineMgr.updateStatusBarWithSummaryData();

                    dashboardMgr.fetchCodeTimeMetricsDashboard(
                        sessionSummaryData
                    );
                }
            })
            .catch(err => {
                // update the status bar
                offlineMgr.updateStatusBarWithSummaryData();
                console.log(
                    `Unable to get session summary response, error: ${err.message}`
                );
            });
    } else {
        offlineMgr.updateStatusBarWithSummaryData();
        dashboardMgr.fetchCodeTimeMetricsDashboard(sessionSummaryData);
    }
};

dashboardMgr.fetchCodeTimeMetricsDashboard = async summary => {
    let summaryInfoFile = utilMgr.getSummaryInfoFile();

    let nowSec = utilMgr.nowInSecs();
    let diff = nowSec - lastDashboardFetchTime;
    if (lastDashboardFetchTime === 0 || diff >= day_in_sec) {
        lastDashboardFetchTime = utilMgr.nowInSecs();

        let showGitMetrics = atom.config.get('code-time.showGitMetrics');

        let api = `/dashboard?showGit=${showGitMetrics}&linux=${utilMgr.isLinux()}&showToday=false`;
        const dashboardSummary = await softwareGet(api, fileUtil.getItem('jwt'));

        let summaryContent = '';

        if (isResponseOk(dashboardSummary)) {
            // get the content
            summaryContent += dashboardSummary.data;
        } else {
            summaryContent = SERVICE_NOT_AVAIL;
        }

        fs.writeFileSync(summaryInfoFile, summaryContent, err => {
            if (err) {
                console.log(
                    `Error writing to the music time summary content file: ${err.message}`
                );
            }
        });
    }

    // concat summary info with the dashboard file
    let dashboardFile = utilMgr.getDashboardFile();
    let dashboardContent = '';
    const formattedDate = moment().format('ddd, MMM Do h:mma');
    dashboardContent = `Music Time          (Last updated on ${formattedDate})`;
    dashboardContent += '\n\n';

    const todayStr = moment().format('ddd, MMM Do');
    dashboardContent += utilMgr.getSectionHeader(`Today (${todayStr})`);

    if (summary) {
        let averageTime = utilMgr.humanizeMinutes(summary.averageDailyMinutes);
        let hoursCodedToday = utilMgr.humanizeMinutes(
            summary.currentDayMinutes
        );
        let liveshareTime = null;
        if (summary.liveshareMinutes) {
            liveshareTime = utilMgr.humanizeMinutes(summary.liveshareMinutes);
        }
        dashboardContent += utilMgr.getDashboardRow(
            'Hours coded today',
            hoursCodedToday
        );
        dashboardContent += utilMgr.getDashboardRow('90-day avg', averageTime);
        if (liveshareTime) {
            dashboardContent += utilMgr.getDashboardRow(
                'Live Share',
                liveshareTime
            );
        }
        dashboardContent += '\n';
    }

    if (fs.existsSync(summaryInfoFile)) {
        const summaryContent = fs.readFileSync(summaryInfoFile, {encoding: 'utf8'}).toString();

        // create the dashboard file
        dashboardContent += summaryContent;
    }

    fs.writeFileSync(dashboardFile, dashboardContent, err => {
        if (err) {
            console.log(
                `Error writing to the Music Time dashboard content file: ${err.message}`
            );
        }
    });
};

module.exports = dashboardMgr;
