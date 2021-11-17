'use babel';


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
}
