'use babel';

import { searchTracks } from 'cody-music';
import { MusicDataManager } from './MusicDataManager';
import $ from 'jquery';
import {
    CLOSE_BOX,
} from '../Constants';

const utilMgr = require('../managers/UtilManager');

let keywords = '';

$(document).on('change', '#search-input', function() {
    keywords = $(this).val();
});

$(document).on('click', '#search-button', function() {
    closeSearch();

    searchSongTracks(keywords);
});

async function searchSongTracks(keywords) {
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
            'Music-Time:refresh-search-songs-treeview'
        );
    } else {
        utilMgr.notify('Music Time', `No songs found matching '${keywords}'`);
    }
}

$(document).on('click', '#close-search', function(e) {
    closeSearch();
});

function closeSearch() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

const searchInputForm = `<div>
    <form>
        <div>
            <input
                type="text"
                id="search-input"
                class="native-key-bindings search-input"
                name="searchInput"
                value=""
                tab-index="-1"
            />
        </div>

        <button class="btn btn-primary search-button" id="search-button">Search</button>
    </form>
</div>`;

export async function showSearchInput() {
    // show the search input
    var myDiv = document.createElement('div');
    var closeButton = document.createElement('span');
    closeButton.setAttribute(
        'style',
        'float:right;margin-bottom: 10px;cursor:pointer'
    );
    closeButton.setAttribute('id', 'close-search');
    closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';

    var divTitle = document.createElement('div');
    divTitle.innerHTML = '<h2>Search for songs</h2>';

    const formDiv = document.createElement('div');
    formDiv.innerHTML = searchInputForm;

    myDiv.appendChild(closeButton);
    myDiv.appendChild(divTitle);
    myDiv.appendChild(formDiv);

    atom.workspace.addModalPanel({
        item: myDiv,
        visible: true,
        priority: 4,
    });
}
