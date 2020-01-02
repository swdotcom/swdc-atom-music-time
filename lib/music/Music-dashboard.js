'use babel';

import $ from 'jquery';

const utilMgr = require('../UtilManager');
const fs = require('fs');
import path from 'path';
export default class MusicDashboard {
    constructor(htmlString) {
 
        let file = utilMgr.getMusicTimeMarkdownFile();
        // const htmlString = fs.readFileSync(
        //    file,
        //     {
        //         encoding: 'utf-8',
        //     }
        // );
        // const htmlString = fs.readFileSync(
        //     path.join(__dirname, '../..', 'templates', 'structure-view.html'),
        //     {
        //         encoding: 'utf-8',
        //     }
        // );$(htmlString).get(0)
        let obj = document.createElement('div');
        // this.element = obj;
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
