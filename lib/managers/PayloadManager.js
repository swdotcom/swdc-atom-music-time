'use babel';

const utilMgr = require('./UtilManager');
const sessionAppMgr = require('./SessionAppManager');
const serviceUtil = require('../utils/ServiceUtil');
const fs = require('fs');

// batch offline payloads in 50
const batch_limit = 50;

let latestPayload = null;
let lastSavedKeystrokeStats = null;

const payloadMgr = {};

payloadMgr.clearLastSavedKeystrokeStats = () => {
    lastSavedKeystrokeStats = null;
};

/**
 * Update the last keystrokes payload
 **/
payloadMgr.getLastSavedKeystrokeStats = () => {
    const dataFile = utilMgr.getSoftwareDataStoreFile();
    const currentPayloads = utilMgr.getFileDataPayloadsAsJson(dataFile);
    if (currentPayloads && currentPayloads.length) {
        // sort in descending order
        currentPayloads.sort((a, b) => b.start - a.start);
        lastSavedKeystrokeStats = currentPayloads[0];
    }
    return lastSavedKeystrokeStats;
};

module.exports = payloadMgr;
