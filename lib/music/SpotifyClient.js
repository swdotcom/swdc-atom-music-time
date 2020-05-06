'use babel';

const spotifyClient = {};

/**
 * Used to execute any spotify function with arguments (if provided)
 **/
spotifyClient.runSpotifyCommand = async (fnc, args = null) => {
    let result = null;
    if (args && args.length) {
        result = await fnc(...args);
    } else {
        result = await fnc();
    }
    if (isTooManyRequestsError(result)) {
        return { status: 429 };
    }
    return result;
};

function isTooManyRequestsError(result) {
    return result &&
        result.error &&
        result.error.response &&
        result.error.response.status === 429
        ? true
        : false;
}

module.exports = spotifyClient;
