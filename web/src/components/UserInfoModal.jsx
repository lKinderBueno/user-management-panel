import React from 'react';
import PlaylistInfoDialog from './PlaylistInfoDialog';

/**
 * UserInfoModal forwards directly to the modernized PlaylistInfoDialog,
 * supporting STB, Dreambox, Enigma2, Xtream, Web Player, Share/Export, and Live Streaming Sessions.
 */
export default function UserInfoModal(props) {
  return <PlaylistInfoDialog {...props} />;
}

export { PlaylistInfoDialog };
