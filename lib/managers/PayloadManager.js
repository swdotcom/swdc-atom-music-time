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

/**
 * send the offline data
 */
payloadMgr.sendOfflineData = async () => {
    payloadMgr.batchSendData('/data/batch', utilMgr.getSoftwareDataStoreFile());
};

/**
 * batch send array data
 * @param api
 * @param file
 */
payloadMgr.batchSendArrayData = async (api, file) => {
    let isonline = await serviceUtil.serverIsAvailable();
    if (!isonline) {
        return;
    }
    if (fs.existsSync(file)) {
        const payloads = utilMgr.getFileDataArray(file);
        payloadMgr.batchSendPayloadData(api, file, payloads);
    }
};

payloadMgr.batchSendData = async (api, file) => {
    let isonline = await serviceUtil.serverIsAvailable();
    if (!isonline) {
        return;
    }
    if (fs.existsSync(file)) {
        const payloads = utilMgr.getFileDataPayloadsAsJson(file);
        payloadMgr.batchSendPayloadData(api, file, payloads);
    }
};

payloadMgr.batchSendPayloadData = async (api, file, payloads) => {
    if (payloads && payloads.length > 0) {
        console.log(`sending batch payloads: ${JSON.stringify(payloads)}`);

        // send batch_limit at a time
        let batch = [];
        for (let i = 0; i < payloads.length; i++) {
            if (batch.length >= batch_limit) {
                const resp = await utilMgr.sendBatchPayload(api, batch);
                if (!serviceUtil.isResponseOk(resp)) {
                    return;
                }
                batch = [];
            }
            batch.push(payloads[i]);
        }
        // send the remaining
        if (batch.length > 0) {
            const resp = await utilMgr.sendBatchPayload(api, batch);
            if (!serviceUtil.isResponseOk(resp)) {
                return;
            }
        }
    }
    // we've made it past the send without errors, delete the file
    utilMgr.deleteFile(file);
};

payloadMgr.postBootstrapPayload = async payload => {
    const batch = [payload];
    await utilMgr.sendBatchPayload('/data/batch', batch);
};

module.exports = payloadMgr;
