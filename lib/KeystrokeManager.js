'use babel';

const utilMgr = require('./UtilManager')
let keystrokeMgr = null;
const sessionMgr = require('./SessionManager');
export default class KeystrokeManager {
    constructor(projectName, projectDirectory) {
        this.keystrokeCount = new KeystrokeCount(projectName, projectDirectory);
    }

    // Returns an object that can be retrieved
    // when package is activated
    serialize() {}

    hasDirectory() {
        let defaultName = utilMgr.getDefaultProjectName();
        if (
            this.keystrokeCount &&
            this.keystrokeCount.project &&
            this.keystrokeCount.project.directory &&
            this.keystrokeCount.project.directory !== '' &&
            this.keystrokeCount.project.directory !== defaultName
        ) {
            return true;
        } else {
            return false;
        }
    }

    // Tear down any state and detach.
    destroy() {
        this.keystrokeCount.remove();
    }

    getKeystrokeCount() {
        return this.keystrokeCount;
    }

    incrementKeystrokeCount() {
        this.keystrokeCount.keystrokes += 1;
    }



    getFileInfoByKey(fileName, property) {
        const keystrokeCount = this.keystrokeCount;
        if (!keystrokeCount) {
            return;
        }

        // add it, it's not in the current set
        let fileInfo = this.findFileInfoInSource(
            keystrokeCount.source,
            fileName
        );
        if (!fileInfo) {
            // "add" = additive keystrokes
            // "netkeys" = add - delete
            // "keys" = add + delete
            // "delete" = delete keystrokes
            // initialize and add it
            fileInfo = {
                paste: 0,
                open: 0,
                close: 0,
                length: 0,
                delete: 0,
                lines: 0,
                add: 0,
                netkeys: 0,
                linesAdded: 0,
                linesRemoved: 0,
                syntax: '',
            };
            keystrokeCount.source[fileName] = fileInfo;
        }
        return fileInfo[property];
    }

    updateProjectInfo(projectName, projectDirectory) {
        if (this.keystrokeCount && this.keystrokeCount.project) {
            this.keystrokeCount.project.name = projectName;
            this.keystrokeCount.project.directory = projectDirectory;
        }
    }

    updateFileInfoData(fileName, data, propertyToUpdate) {
        const keystrokeCount = this.keystrokeCount;
        if (!keystrokeCount) {
            return;
        }
        if (keystrokeCount.source) {
            Object.keys(keystrokeCount.source).forEach(key => {
                if (key !== fileName) {
                    // ending a file session that doesn't match the incoming file
                    const end =
                        parseInt(keystrokeCount.source[key]['end'], 10) || 0;
                    if (end === 0) {
                        // set the end time for this file event
                        let nowTimes = utilMgr.getNowTimes();
                        keystrokeCount.source[key]['end'] = nowTimes.now_in_sec;
                        keystrokeCount.source[key]['local_end'] =
                            nowTimes.local_now_in_sec;
                    }
                } else {
                    // they're working on this file again, zero out the end
                    keystrokeCount.source[key]['end'] = 0;
                    keystrokeCount.source[key]['local_end'] = 0;
                }
            });
        }

        // add it, it's not in the current set
        let fileInfo = this.findFileInfoInSource(
            keystrokeCount.source,
            fileName
        );
        if (!fileInfo) {
            const nowTimes = utilMgr.getNowTimes();
            // "add" = additive keystrokes
            // "netkeys" = add - delete
            // "keys" = add + delete
            // "delete" = delete keystrokes
            // initialize and add it
            fileInfo = {
                paste: 0,
                open: 0,
                close: 0,
                length: 0,
                delete: 0,
                lines: 0,
                add: 0,
                netkeys: 0,
                linesAdded: 0,
                linesRemoved: 0,
                start: nowTimes.now_in_sec,
                local_start: nowTimes.local_now_in_sec,
                syntax: '',
            };
            keystrokeCount.source[fileName] = fileInfo;
        }
        // update the data for this fileInfo keys count....
        if (propertyToUpdate === 'lines' || propertyToUpdate === 'syntax') {
            fileInfo[propertyToUpdate] = data;
        } else {
            fileInfo[propertyToUpdate] = fileInfo[propertyToUpdate] + data;
        }

        if (
            propertyToUpdate === 'add' ||
            propertyToUpdate === 'delete' ||
            propertyToUpdate === 'paste' ||
            propertyToUpdate === 'linesAdded' ||
            propertyToUpdate === 'linesRemoved'
        ) {
            // update the netkeys and the keys
            // "netkeys" = add - delete
            // "keys" = add + delete
            fileInfo['netkeys'] = fileInfo['add'] - fileInfo['delete'];
            fileInfo['keys'] = fileInfo['add'] + fileInfo['delete'];
        }
    }

    reset() {
        this.keystrokeCount.reset();
    }

    /**
     * check if there's a payload to save.
     **/
    hasData() {
        let foundKpmData = this.keystrokeCount > 0 ? true : false;
        if (
            !foundKpmData &&
            this.keystrokeCount &&
            this.keystrokeCount.source
        ) {
            for (const fileName of Object.keys(this.keystrokeCount.source)) {
                const fileInfoData = this.keystrokeCount.source[fileName];
                // check if any of the metric values has data,
                // but don't check the 'length' attribute
                if (
                    fileInfoData &&
                    (fileInfoData.add > 0 ||
                        fileInfoData.paste > 0 ||
                        fileInfoData.open > 0 ||
                        fileInfoData.close > 0 ||
                        fileInfoData.delete > 0 ||
                        fileInfoData.linesAdded > 0 ||
                        fileInfoData.linesRemoved > 0)
                ) {
                    foundKpmData = true;
                } else {
                    // delete any files from the source object that don't have kpm metrics
                    delete this.keystrokeCount.source[fileName];
                }
            }
        }

        return foundKpmData;
    }

    /**
     * Find source objects matching the fileName
     **/
    findFileInfoInSource(source, filenameToMatch) {
        if (
            source[filenameToMatch] !== undefined &&
            source[filenameToMatch] !== null
        ) {
            return source[filenameToMatch];
        }
        return null;
    }
    initializeKeystrokeMgr() {
        if (keystrokeMgr && keystrokeMgr.hasDirectory()) {
            
            return keystrokeMgr = new KeystrokeManager(projectName, rootPath);;
        }
    
        const rootPath =
            atom.workspace.project &&
            atom.workspace.project.rootDirectories[0] &&
            atom.workspace.project.rootDirectories[0].path;
    
        if (!rootPath) {
            if (!keystrokeMgr) {
                let defaultName = utilMgr.getDefaultProjectName();
                keystrokeMgr = new KeystrokeManager(defaultName, defaultName);
            }
            return keystrokeMgr;
        }
    
        // Keystroke Manager keeps the keystroke count and project class.
        // We'll load the project name and directory into the project class
        // using the keystroke manager constructor
        const lastSlashIdx = rootPath ? rootPath.lastIndexOf('/') : -1;
        const projectName =
            lastSlashIdx !== -1
                ? rootPath.substring(rootPath.lastIndexOf('/') + 1)
                : rootPath;
    
        if (rootPath && keystrokeMgr && !keystrokeMgr.hasDirectory()) {
            // update the project name and directory
            keystrokeMgr.updateProjectInfo(projectName, rootPath);
        } else if (!keystrokeMgr) {
            keystrokeMgr = new KeystrokeManager(projectName, rootPath);
        }
        return keystrokeMgr;
    }
    
    // send the keystroke data
    sendKeystrokeData() {
        if (
            !keystrokeMgr ||
            !keystrokeMgr.keystrokeCount ||
            !keystrokeMgr.hasData() ||
            !utilMgr.getItem('isSpotifyConnected')
        ) {
            return;
        }
    
        const nowTimes = utilMgr.getNowTimes();
        keystrokeMgr.keystrokeCount.end = nowTimes.now_in_sec;
        keystrokeMgr.keystrokeCount.local_end = nowTimes.local_now_in_sec;
        Object.keys(keystrokeMgr.keystrokeCount.source).forEach(key => {
            // ensure there is an end time
            const end =
                parseInt(keystrokeMgr.keystrokeCount.source[key]['end'], 10) || 0;
            if (end === 0) {
                // set the end time for this file event
                let nowTimes = utilMgr.getNowTimes();
                keystrokeMgr.keystrokeCount.source[key]['end'] =
                    nowTimes.now_in_sec;
                keystrokeMgr.keystrokeCount.source[key]['local_end'] =
                    nowTimes.local_now_in_sec;
            }
        });
    
        // make sure the data sum value goes out as a string
        keystrokeMgr.keystrokeCount.keystrokes = String(
            keystrokeMgr.keystrokeCount.keystrokes
        );
        keystrokeMgr.keystrokeCount.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const payload = JSON.parse(JSON.stringify(keystrokeMgr.keystrokeCount));
        utilMgr.storeKpmDataForMusic(payload);
        // turn data into a string value
        payload.keystrokes = String(payload.keystrokes);
    
        console.log(
            `Code Time: processing code time metrics: ${JSON.stringify(payload)}`
        );
        sessionMgr.storePayload(payload);
        // reset the data
        keystrokeMgr.reset();
    }
}

export class KeystrokeCount {
    constructor(projectName, projectDirectory) {
        this.reset();
        // project object containing project name and directory
        this.project = new Project(projectName, projectDirectory);
        this.version = utilMgr.getVersion();
        this.os = utilMgr.getOs();
    }

    /**
     * The reset ensures every variable has a defined non-null value
     **/
    reset() {
        let d = new Date();
        d = new Date(d.getTime() - 1000 * 60);
        let offset_sec = d.getTimezoneOffset() * 60;
        // sublime = 1, vscode = 2, eclipse = 3, intelliJ = 4,
        // visual studio = 6, atom = 7
        this.pluginId = utilMgr.getPluginId();
        // the value that goes with this object, which is a Number
        // but kept as a String
        this.keystrokes = 0;
        // unique set of file names
        this.source = {};
        // start time in seconds
        this.start = Math.round(Date.now() / 1000);
        // end time in seconds
        this.local_start = this.start - offset_sec;
        // setting a default, but this will be set within the constructor
        this.version = '';
        this.os = '';
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let defaultName = utilMgr.getDefaultProjectName();
        this.project = new Project(defaultName, defaultName);
    }


}

export class Project {
    constructor(projectName, projectDirectory) {
        this.name = projectName;
        this.directory = projectDirectory;
        this.resource = {};
        this.identifier = '';
    }
}
