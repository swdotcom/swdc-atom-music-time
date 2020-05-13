'use babel';

import $ from 'jquery';
import StructureView from './structure-view';
import {
    TIME_RELOAD,
    SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID,
    CLOSE_BOX,
} from '../Constants';
import KpmMusicManager from './KpmMusicManager';
let selectedGenre = '';
$(document).on('change', '#genre', async function() {
    selectedGenre = $(this).val();
    const genres = getGenreSelections();
    let filterGenre = genres.filter(genre => {
        return genre.replace(/[_-]/g, ' ') === selectedGenre.toLowerCase();
    });

    console.log("genre change, invoking update recommendations");

    await KpmMusicManager.getInstance().updateRecommendations(
        selectedGenre,
        0,
        filterGenre,
        {},
        0,
        false
    );
    closeCategory();

    const structureViewObj = new StructureView();
    structureViewObj.refreshTreeView();
});

$(document).on('change', '#category', async function() {
    selectedCategory = $(this).val();
    const categories = getCategorySelections();
    const filterCat = categories.filter(category => {
        return category.label === selectedCategory;
    })[0];

    console.log("category change, invoking update recommendations");

    await KpmMusicManager.getInstance().updateRecommendations(...filterCat.args);
    closeCategory();
    setTimeout(() => {
        $('[node-id=' + SPOTIFY_RECOMMENDATION_SONGS_PLAYLIST_ID + ']').attr(
            'title',
            filterCat.description
        );
    }, 2000);

    // refresh the tree
    const structureViewObj = new StructureView();
    structureViewObj.refreshTreeView()
});

$(document).on('click', '#closeCateory', function() {
    closeCategory();
});

$(document).on('click', '#refresh-recommendation', function() {
    $(this).attr('src', TIME_RELOAD);
    atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'Music-Time:refresh-recommend-treeview'
    );
});

export async function showGenreSelections() {
    const genres = getGenreSelections();

    // get the available genres

    genres.sort();

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
    genres.forEach(genre => {
        let label = genre.replace(/[_-]/g, ' ');
        // capitalize the 1st character
        label = label.charAt(0).toUpperCase() + label.substring(1);
        var option = document.createElement('option');
        option.value = label;
        option.text = label;
        selectList.appendChild(option);
    });

    atom.workspace.addModalPanel({
        item: myDiv,
        visible: true,
        priority: 4,
    });

    return null;
}

export async function showCategorySelections() {
    // add the categories
    const categories = getCategorySelections();
    var myDiv = document.createElement('div');
    var closeButton = document.createElement('span');
    closeButton.setAttribute(
        'style',
        'float:right;margin-bottom: 10px;cursor:pointer'
    );
    closeButton.setAttribute('id', 'closeCateory');
    closeButton.innerHTML = '<img alt="" src="' + CLOSE_BOX + '" />';
    var selectList = document.createElement('select');
    selectList.setAttribute('id', 'category');
    selectList.setAttribute(
        'style',
        ' width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;'
    );

    myDiv.appendChild(closeButton);
    myDiv.appendChild(selectList);
    var defaultOoption = document.createElement('option');
    defaultOoption.value = '';
    defaultOoption.text = 'Select mood';
    selectList.appendChild(defaultOoption);

    categories.forEach(element => {
        var option = document.createElement('option');
        option.value = element.label;
        option.text = element.label;
        selectList.appendChild(option);
    });

    atom.workspace.addModalPanel({
        item: myDiv,
        visible: true,
        priority: 4,
    });
}
function closeCategory() {
    var myDiv = document.createElement('div');
    atom.workspace.addModalPanel({
        item: myDiv,
        visible: false,
        priority: 4,
    });
}

function getCategorySelections() {
    // args example
    // args: ["Happy", 5, [], { min_valence: 0.6, target_valence: 1 }]
    const items = [
        // high valence
        {
            label: 'Happy',
            description:
                'Positive, uplifting, mood-boosting; good for any type of coding',
            args: [
                'Happy',
                5,
                [],
                { min_valence: 0.5, target_valence: 1 },
                0,
                true,
            ],
        },
        // high energy
        {
            label: 'Energetic',
            description:
                "Dynamic, loud, stimulating; grab a coffee and let's go",
            args: [
                'Energetic',
                5,
                [],
                { min_energy: 0.5, target_energy: 1 },
                0,
                true,
            ],
        },
        // high danceability
        {
            label: 'Danceable',
            description:
                'Songs with a stable beat and rhythm; good for fast-paced work',
            args: [
                'Danceable',
                5,
                [],
                { min_danceability: 0.5, target_danceability: 1 },
                0,
                true,
            ],
        },
        // Low speechiness
        {
            label: 'Instrumental',
            description: 'Good for complex work requiring maximum focus',
            args: [
                'Instrumental',
                5,
                [],
                { min_instrumentalness: 0.6, target_instrumentalness: 1 },
                0,
                true,
            ],
        },
        // Liked songs
        {
            label: 'Familiar',
            description:
                'similar to your Liked Songs, familiar songs helps you get into flow faster',
            args: ['Familiar', 5, [], {}, 0, true],
        },
        // Low loudness
        {
            label: 'Quiet music',
            description:
                'Songs that are soft and low energy, helping you stay focused',
            args: [
                'Quiet music',
                5,
                [],
                { max_loudness: -8, target_loudness: -60 },
                0,
                true,
            ],
        },
    ];

    return items;
}

function getGenreSelections() {
    const items = [
        'acoustic',
        'afrobeat',
        'alt-rock',
        'alternative',
        'ambient',
        'anime',
        'black-metal',
        'bluegrass',
        'blues',
        'bossanova',
        'brazil',
        'breakbeat',
        'british',
        'cantopop',
        'chicago-house',
        'children',
        'chill',
        'classical',
        'club',
        'comedy',
        'country',
        'dance',
        'dancehall',
        'death-metal',
        'deep-house',
        'detroit-techno',
        'disco',
        'disney',
        'drum-and-bass',
        'dub',
        'dubstep',
        'edm',
        'electro',
        'electronic',
        'emo',
        'folk',
        'forro',
        'french',
        'funk',
        'garage',
        'german',
        'gospel',
        'goth',
        'grindcore',
        'groove',
        'grunge',
        'guitar',
        'happy',
        'hard-rock',
        'hardcore',
        'hardstyle',
        'heavy-metal',
        'hip-hop',
        'holidays',
        'honky-tonk',
        'house',
        'idm',
        'indian',
        'indie',
        'indie-pop',
        'industrial',
        'iranian',
        'j-dance',
        'j-idol',
        'j-pop',
        'j-rock',
        'jazz',
        'k-pop',
        'kids',
        'latin',
        'latino',
        'malay',
        'mandopop',
        'metal',
        'metal-misc',
        'metalcore',
        'minimal-techno',
        'movies',
        'mpb',
        'new-age',
        'new-release',
        'opera',
        'pagode',
        'party',
        'philippines-opm',
        'piano',
        'pop',
        'pop-film',
        'post-dubstep',
        'power-pop',
        'progressive-house',
        'psych-rock',
        'punk',
        'punk-rock',
        'r-n-b',
        'rainy-day',
        'reggae',
        'reggaeton',
        'road-trip',
        'rock',
        'rock-n-roll',
        'rockabilly',
        'romance',
        'sad',
        'salsa',
        'samba',
        'sertanejo',
        'show-tunes',
        'singer-songwriter',
        'ska',
        'sleep',
        'songwriter',
        'soul',
        'soundtracks',
        'spanish',
        'study',
        'summer',
        'swedish',
        'synth-pop',
        'tango',
        'techno',
        'trance',
        'trip-hop',
        'turkish',
        'work-out',
        'world-music',
    ];

    return items;
}
