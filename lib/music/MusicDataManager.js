'use babel';

import {
    isResponseOk,
    softwareGet,
    softwarePut,
    softwareDelete,
} from '../client/HttpClient';

const fileUtil = require("../utils/FileUtil");

export class MusicDataManager {
    constructor() {
        this.prevRecTrackMap = {};
        this.recommendationTracks = [];
        this.recommendationPlaylist = {};
        this.spotifyPlaylists = [];
        this.trackIdsForRecommendations = [];
        this.allRecommendationTracks = [];
        this.currentRecMeta = {};
        this.currentRecMeta['features'] = {};
        this.currentRecMeta['seed_genres'] = {};
        this.spotifyLikedSongs = [];
        this._runningTrack = {};
        this._buildingPlaylist = false;
    }
    static getInstance() {
        if (!MusicDataManager.instance) {
            MusicDataManager.instance = new MusicDataManager();
        }

        return MusicDataManager.instance;
    }

    get runningTrack() {
        return this._runningTrack;
    }

    set runningTrack(track) {
        this._runningTrack = track;
    }

    get buildingPlaylist() {
        return this._buildingPlaylist;
    }

    set buildingPlaylist(id) {
        this._buildingPlaylist = id;
    }

    removeTrackFromRecommendations(trackId) {
        let foundIdx = -1;
        for (let i = 0; i < this.recommendationTracks.length; i++) {
            if (this.recommendationTracks[i].id === trackId) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx > -1) {
            // splice it out
            this.recommendationTracks.splice(foundIdx, 1);
        }

        if (this.recommendationTracks.length < 2) {
            // refresh
            atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'Music-Time:refresh-recommend-treeview'
            );
        }
    }

    isLikedTrack(trackId) {
        const foundSong = this.spotifyLikedSongs
            ? this.spotifyLikedSongs.find(n => n.id === trackId)
            : null;
        return foundSong ? true : false;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    getMusicTimePlaylistByTypeId(playlistTypeId) {
        const pItem = this.generatedPlaylists.find(
            e => e.playlistTypeId === playlistTypeId
        );
        return pItem;
    }

    async fetchSavedPlaylists() {
        let playlists = [];

        const response = await softwareGet(
            '/music/playlist/generated',
            fileUtil.getItem('jwt')
        );

        if (isResponseOk(response)) {
            // only return the non-deleted playlists
            for (let i = 0; i < response.data.length; i++) {
                const savedPlaylist = response.data[i];
                if (savedPlaylist && savedPlaylist['deleted'] !== 1) {
                    savedPlaylist.id = savedPlaylist.playlist_id;
                    savedPlaylist.playlistTypeId = savedPlaylist.playlistTypeId;
                    playlists.push(savedPlaylist);
                }
            }
        }

        this.savedPlaylists = playlists;
    }

    /**
     * Checks if the user's spotify playlists contains either
     * the global top 40 or the user's coding favorites playlist.
     * The playlistTypeId is used to match the set ID from music time
     * app. 1 = user's coding favorites, 2 = global top 40
     */
    populateGeneratedPlaylists() {
        this.generatedPlaylists = [];
        if (this.savedPlaylists.length > 0 && this.rawPlaylists.length > 0) {
            this.savedPlaylists.forEach(savedPlaylist => {
                const savedPlaylistTypeId = savedPlaylist.playlistTypeId;

                const rawIdx = this.rawPlaylists.findIndex(
                    n => n.id === savedPlaylist.id
                );
                const origRawPlaylistOrderIdx = this.origRawPlaylistOrder.findIndex(
                    n => n.id === savedPlaylist.id
                );
                if (rawIdx !== -1) {
                    const playlist = this.rawPlaylists[rawIdx];
                    playlist.playlistTypeId = savedPlaylistTypeId;
                    playlist.tag = 'paw';
                    this.generatedPlaylists.push(playlist);

                    this.rawPlaylists.splice(rawIdx, 1);
                }
                if (origRawPlaylistOrderIdx !== -1) {
                    this.origRawPlaylistOrder.splice(
                        origRawPlaylistOrderIdx,
                        1
                    );
                }
            });
        }
    }

    // reconcile. meaning the user may have deleted the lists our 2 buttons created;
    // global and custom.  We'll remove them from our db if we're unable to find a matching
    // playlist_id we have saved.
    async reconcilePlaylists() {
        if (
            this.savedPlaylists &&
            this.savedPlaylists.length &&
            this.generatedPlaylists &&
            this.generatedPlaylists.length
        ) {
            for (let i = 0; i < this.savedPlaylists.length; i++) {
                const savedPlaylist = this.savedPlaylists[i];
                const foundPlaylist = this.generatedPlaylists.find(
                    p => (p.id = savedPlaylist.id)
                );

                if (!foundPlaylist) {
                    // no longer found, delete it
                    await softwareDelete(
                        `/music/playlist/generated/${savedPlaylist.id}`,
                        fileUtil.getItem('jwt')
                    );
                } else if (foundPlaylist.name !== savedPlaylist.name) {
                    // update the name on the music time app
                    const payload = {
                        name: foundPlaylist.name,
                    };
                    await softwarePut(
                        `/music/playlist/generated/${savedPlaylist.id}`,
                        payload,
                        fileUtil.getItem('jwt')
                    );
                }
            }
        }
    }
}
