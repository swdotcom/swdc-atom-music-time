'use babel';

import axios from 'axios';
import { api_endpoint } from '../Constants';

const utilMgr = require('../managers/UtilManager');
const fileUtil = require("../utils/FileUtil");

// build the axios api base url
const beApi = axios.create({
    baseURL: `${api_endpoint}`,
});

let initializedHeaders = false;

function initHeaders() {
    if (!initializedHeaders) {
        beApi.defaults.headers.common["X-SWDC-Plugin-Id"] = utilMgr.getPluginId();
        beApi.defaults.headers.common["X-SWDC-Plugin-Name"] = utilMgr.getPluginName();
        beApi.defaults.headers.common["X-SWDC-Plugin-Version"] = utilMgr.getVersion();
        beApi.defaults.headers.common["X-SWDC-Plugin-OS"] = utilMgr.getOs();
        beApi.defaults.headers.common[
            "X-SWDC-Plugin-TZ"
        ] = Intl.DateTimeFormat().resolvedOptions().timeZone;
        beApi.defaults.headers.common["X-SWDC-Plugin-Offset"] = utilMgr.getOffsetSeconds() / 60;
        beApi.defaults.headers.common["X-SWDC-Plugin-UUID"] = fileUtil.getPluginUuid();
        initializedHeaders = true
    }
}

/**
 * Response returns a paylod with the following...
 * data: <payload>, status: 200, statusText: "OK", config: Object
 * @param api
 * @param jwt
 */
export async function softwareGet(api, jwt) {
    if (jwt) {
        beApi.defaults.headers.common['Authorization'] = jwt;
    }
    initHeaders();

    return await beApi.get(api).catch(err => {
        console.log(`${err.message} for api ${api}`);
        return err;
    });
}

/**
 * perform a put request
 */
export async function softwarePut(api, payload, jwt) {
    // PUT the kpm to the PluginManager
    beApi.defaults.headers.common['Authorization'] = jwt;

    initHeaders();

    return await beApi
        .put(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(`${err.message} for api ${api}`);
            return err;
        });
}

/**
 * perform a post request
 */
export async function softwarePost(api, payload, jwt) {
    if (jwt) {
      // POST the kpm to the PluginManager
      beApi.defaults.headers.common['Authorization'] = jwt;
    }
    initHeaders();
    return beApi
        .post(api, payload)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(`${err.message} for api ${api}`);
            return err;
        });
}

/**
 * perform a delete request
 */
export async function softwareDelete(api, jwt) {
    beApi.defaults.headers.common['Authorization'] = jwt;
    initHeaders();
    return beApi
        .delete(api)
        .then(resp => {
            return resp;
        })
        .catch(err => {
            console.log(`${err.message} for api ${api}`);
            return err;
        });
}

/**
 * Check if the spotify response has an expired token
 * {"error": {"status": 401, "message": "The access token expired"}}
 */
export function hasTokenExpired(resp) {
    // when a token expires, we'll get the following error data
    // err.response.status === 401
    // err.response.statusText = "Unauthorized"
    if (
        resp &&
        resp.response &&
        resp.response.status &&
        resp.response.status === 401
    ) {
        return true;
    }
    return false;
}

/**
 * check if the reponse is ok or not
 * axios always sends the following
 * status:200
 * statusText:"OK"
 *
    code:"ENOTFOUND"
    config:Object {adapter: , transformRequest: Object, transformResponse: Object, …}
    errno:"ENOTFOUND"
    host:"api.spotify.com"
    hostname:"api.spotify.com"
    message:"getaddrinfo ENOTFOUND api.spotify.com api.spotify.com:443"
    port:443
 */
export function isResponseOk(resp) {
    let status = getResponseStatus(resp);
    if (status && resp && status < 300) {
        return true;
    }
    return false;
}

/**
 * get the response http status code
 * axios always sends the following
 * status:200
 * statusText:"OK"
 */
function getResponseStatus(resp) {
    let status = null;
    if (resp && resp.status) {
        status = resp.status;
    } else if (resp && resp.response && resp.response.status) {
        status = resp.response.status;
    }
    return status;
}

export function isTooManyRequestsError(result) {
    return getResponseStatus(result) === 429 ? true : false;
}

export function getResponseStatus(resp) {
    if (resp && resp.status) {
        return resp.status;
    } else if (resp && resp.data && resp.data.status) {
        return resp.data.status;
    } else if (
        resp &&
        resp.error &&
        resp.error.response &&
        resp.error.response.status
    ) {
        return resp.error.response.status;
    }
    return 200;
}
