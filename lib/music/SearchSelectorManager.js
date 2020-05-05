import { window, commands } from 'vscode';
import { searchTracks } from 'cody-music';
import { MusicDataManager } from './MusicDataManager';

const utilMgr = require('../UtilManager');

export async function showSearchInput() {
    if (utilMgr.requiresSpotifyAccess()) {
        window.confirm(`Spotify connection required`);
        return;
    }
    // const keywords = await window.showInputBox({
    //     value: '',
    //     placeHolder: 'Search',
    //     prompt: 'Search for songs',
    //     validateInput: text => {
    //         return !text
    //             ? 'Please enter one more more keywords to continue.'
    //             : null;
    //     },
    // });
    getSearchPopup();
    return;

    if (!keywords) {
        return;
    }
    // the default limit is 50, so just send in the keywords
    const result = await searchTracks(keywords);

    if (
        result &&
        result.tracks &&
        result.tracks.items &&
        result.tracks.items.length
    ) {
        const dataMgr: MusicDataManager = MusicDataManager.getInstance();
        // populate the recommendation section with these results

        // set the manager's recommendation tracks
        dataMgr.recommendationTracks = result.tracks.items;
        dataMgr.recommendationLabel = 'Top Results';

        // refresh the rec tree
        atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'Music-Time:refresh-recommend-treeview'
        );
    } else {
        utilMgr.showErrorStatus(`No songs found matching '${keywords}'`);
    }
}

export async function getSearchPopup() {
    var myDiv = document.createElement('div');
    var closeButton = document.createElement('span');
    closeButton.setAttribute(
        'style',
        'float:right;margin-bottom: 10px;cursor:pointer'
    );
    closeButton.setAttribute('id', 'closeCateory');
    closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
    var selectList = document.createElement('select');
    selectList.setAttribute('id', 'genre');
    selectList.setAttribute(
        'style',
        ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
    );

    myDiv.appendChild(closeButton);
    myDiv.appendChild(selectList);

    var defaultOoption = document.createElement('option');
    defaultOoption.value = '';
    defaultOoption.text = 'Select Genre';
    selectList.appendChild(defaultOoption);

    atom.workspace.addModalPanel({
        item: myDiv,
        visible: true,
        priority: 4,
    });

    return null;
}
