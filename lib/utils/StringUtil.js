'use babel';

const stringUtil = {};

stringUtil.text_truncate = (str, length, ending = null) => {
    if (length == null) {
        length = 100;
    }
    if (ending == null) {
        ending = '...';
    }
    if (str && str.length > length) {
        return str.substring(0, length - ending.length) + ending;
    } else {
        return str;
    }
};

module.exports = stringUtil;
