'use babel';

import fileIt from 'file-it';

const utilMgr = require('./UtilManager');
const fileUtil = require("../utils/FileUtil");
const commonUtil = require("../utils/CommonUtil");

const fileChangeInfoSummaryDataMgr = {};

fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile = () => {
    let file = fileUtil.getSoftwareDir();
    if (commonUtil.isWindows()) {
        file += '\\fileChangeSummary.json';
    } else {
        file += '/fileChangeSummary.json';
    }
    return file;
};

fileChangeInfoSummaryDataMgr.clearFileChangeInfoSummaryData = () => {
    fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk({});
};

// returns a map of file change info
// {fileName => FileChangeInfo, fileName => FileChangeInfo}
fileChangeInfoSummaryDataMgr.getFileChangeSummaryAsJson = () => {
    const file = fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile();
    let fileChangeInfoMap = fileUtil.getJsonData(file);
    if (!fileChangeInfoMap) {
        fileChangeInfoMap = {};
    }
    return fileChangeInfoMap;
};

fileChangeInfoSummaryDataMgr.saveFileChangeInfoToDisk = fileChangeInfoData => {
    const file = fileChangeInfoSummaryDataMgr.getFileChangeSummaryFile();
    fileIt.writeJsonFileSync(file, fileChangeInfoData, {spaces: 4});
};

module.exports = fileChangeInfoSummaryDataMgr;
