'use babel';


import StructureView from './structure-view';

const treeViewManager = {};

let structureViewObj;

treeViewManager.setStructureView = (view) => {
    structureViewObj = view;
}

treeViewManager.getStructureView = () => {
    return structureViewObj;
}

module.exports = treeViewManager;
