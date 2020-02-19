'use babel';

import $ from 'jquery';
import {
    TIME_RELOAD
} from '../Constants';

import KpmMusicManager from './KpmMusicManager';
let selectedGenre = "";
$(document).on('change', '#genre', function() {
    selectedGenre = $(this).val();
    const genres = getGenreSelections();
    KpmMusicManager.getInstance().updateRecommendations(
        selectedGenre,
        0,
        genres
    );
    closeCategory();
    // console.log(selectedGenre);
});

$(document).on('change', '#category', function() {
    selectedCategory = $(this).val();
    const categories = getCategorySelections();
    let filterCat = categories.filter(category => {
        return category.label === selectedCategory;
    })[0];
    KpmMusicManager.getInstance().updateRecommendations(...filterCat.args);
    closeCategory();
    // console.log(selectedCategory);
});
$(document).on('click','#closeCateory', function() {
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
    closeButton.setAttribute('style','float:right;margin-bottom: 10px;');
    closeButton.setAttribute('id','closeCateory');
    closeButton.innerHTML = '<img alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" />';
    var selectList = document.createElement("select");
    selectList.setAttribute("id", "genre"); 
    selectList.setAttribute("style", " width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;"); 

    
    myDiv.appendChild(closeButton);
    myDiv.appendChild(selectList);
    genres.forEach(genre => {
        let label = genre.replace(/[_-]/g, ' ');
            // capitalize the 1st character
            label = label.charAt(0).toUpperCase() + label.substring(1);
        var option = document.createElement("option");
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
    closeButton.setAttribute('style','float:right;margin-bottom: 10px;');
    closeButton.setAttribute('id','closeCateory');
    closeButton.innerHTML = '<img alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMWVtIiBoZWlnaHQ9IjFlbSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgbWVldCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgc3R5bGU9Ii1tcy10cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7Ij48cGF0aCBkPSJNNjg1LjQgMzU0LjhjMC00LjQtMy42LTgtOC04bC02NiAuM0w1MTIgNDY1LjZsLTk5LjMtMTE4LjRsLTY2LjEtLjNjLTQuNCAwLTggMy41LTggOGMwIDEuOS43IDMuNyAxLjkgNS4ybDEzMC4xIDE1NUwzNDAuNSA2NzBhOC4zMiA4LjMyIDAgMCAwLTEuOSA1LjJjMCA0LjQgMy42IDggOCA4bDY2LjEtLjNMNTEyIDU2NC40bDk5LjMgMTE4LjRsNjYgLjNjNC40IDAgOC0zLjUgOC04YzAtMS45LS43LTMuNy0xLjktNS4yTDU1My41IDUxNWwxMzAuMS0xNTVjMS4yLTEuNCAxLjgtMy4zIDEuOC01LjJ6IiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik01MTIgNjVDMjY0LjYgNjUgNjQgMjY1LjYgNjQgNTEzczIwMC42IDQ0OCA0NDggNDQ4czQ0OC0yMDAuNiA0NDgtNDQ4Uzc1OS40IDY1IDUxMiA2NXptMCA4MjBjLTIwNS40IDAtMzcyLTE2Ni42LTM3Mi0zNzJzMTY2LjYtMzcyIDM3Mi0zNzJzMzcyIDE2Ni42IDM3MiAzNzJzLTE2Ni42IDM3Mi0zNzIgMzcyeiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" />';
    var selectList = document.createElement("select");
    selectList.setAttribute("id", "category"); 
    selectList.setAttribute("style", " width: 100%; display: flex;color: black;height: 30px; margin-bottom: 10px;"); 

    
    myDiv.appendChild(closeButton);
    myDiv.appendChild(selectList);
    categories.forEach(element => {
           
        var option = document.createElement("option");
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
                'positive, uplifting, mood-boosting; good for any type of coding',
            args: ['Happy', 5, [], { min_valence: 0.6, target_valence: 1 }],
        },
        // high energy
        {
            label: 'Energetic',
            description:
                "dynamic, loud, stimulating; grab a coffee and let's go",
            args: ['Energetic', 5, [], { min_energy: 0.6, target_energy: 1 }],
        },
        // high danceability
        {
            label: 'Danceable',
            description:
                'songs with a stable beat and rhythm; good for fast-paced work',
            args: [
                'Danceable',
                5,
                [],
                { min_danceability: 0.6, target_danceability: 1 },
            ],
        },
        // Low speechiness
        {
            label: 'No lyrics',
            description: 'good for complex work requiring maximum focus',
            args: [
                'No lyrics',
                5,
                [],
                { max_speechiness: 0.4, target_speechiness: 0 },
            ],
        },
        // Liked songs
        {
            label: 'Familiar',
            description:
                'similar to your Liked Songs, familiar songs helps you get into flow faster',
            args: ['Similar to Liked Songs', 5],
        },
        // Low loudness
        {
            label: 'Quiet music',
            description:
                'songs that are soft and low energy, helping you stay focused',
            args: [
                'Quiet music',
                5,
                [],
                { max_loudness: 0.4, target_loudness: 0 },
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
