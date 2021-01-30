'use babel';

const utilMgr = require('../managers/UtilManager');

export default class MusicDashboard {
    constructor(htmlString) {
        let file = utilMgr.getMusicTimeMarkdownFile();
        let obj = document.createElement('div');
        obj.setAttribute('style','height: 100%; overflow: scroll;')
        obj.innerHTML = htmlString;
        this.element = obj;
        this.viewType = 'Music Dashboard';
    }

    serialize() {}

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    getTitle() {
        return 'Music Time Dashboard' ;
    }
}
