'use babel';

import KpmMusicTimeStatusView from "../music/KpmMusicTimeStatusView";

let statusView = null;

export function getStatusView() {
  if (!statusView) {
    statusView = new KpmMusicTimeStatusView();
  }
  return statusView;
}
