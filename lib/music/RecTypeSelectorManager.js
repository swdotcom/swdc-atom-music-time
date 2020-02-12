'use babel';
import fs from 'fs';
import $ from 'jquery';
import path from 'path';
// import { showQuickPick } from "../MenuManager";
import KpmMusicManager from './KpmMusicManager';

$(document).on('click', '#selectGenre', function() {
    let selectedGenre = $('#genre').val();
    const genres = getGenreSelections();
    KpmMusicManager.getInstance().updateRecommendations(
        selectedGenre,
        0,
        genres
    );
    console.log(selectedGenre);
});
let isGenrePromt = false;

export async function showGenreSelections() {
    // let menuOptions = {
    //     items: [],
    //     placeholder: "Select a genre"
    // };

    const genres = getGenreSelections();

    // get the available genres

    genres.sort();

    this.propmtBoxDiv = document.createElement('div');
    const htmlString = fs.readFileSync(
        path.join(__dirname, '../..', 'templates', 'genreSelect.html'),
        {
            encoding: 'utf-8',
        }
    );
    this.propmtBoxDiv.innerHTML = htmlString;

    atom.workspace.addModalPanel({
        item: this.propmtBoxDiv,
        visible: true,
        priority: 4,
    });
    // if (!isGenrePromt) {
        genres.forEach(genre => {
            let label = genre.replace(/[_-]/g, ' ');
            // capitalize the 1st character
            label = label.charAt(0).toUpperCase() + label.substring(1);


            var sel = document.getElementById('genre');

            // create new option element
            var opt = document.createElement('option');

            // create text node to add to option element (opt)
            opt.appendChild(document.createTextNode(label));

            // set value property of opt
            opt.value = label;

            // add opt to end of select box (sel)
            sel.appendChild(opt);
        });
        isGenrePromt = true;
   // }

    return null;
}

export async function showCategorySelections() {
    let menuOptions = {
        items: [],
        placeholder: 'Select a category',
    };

    // add the categories
    const categories = getCategorySelections();
    categories.forEach(cateogry => {
        menuOptions.items.push({
            label: cateogry.label,
            detail: cateogry.description,
            args: cateogry.args,
            command: 'musictime.updateRecommendations',
        });
    });

    // const pick = await showQuickPick(menuOptions);
    // if (pick && pick.label) {
    //     return pick.label;
    // }
    return null;
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
