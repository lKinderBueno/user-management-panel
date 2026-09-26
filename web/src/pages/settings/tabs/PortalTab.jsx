import React from 'react';
import PlaylistPortalBranding from '../../PlaylistPortalBranding';

export default function PortalTab({
  playlists = [],
  notify,
}) {
  return (
    <PlaylistPortalBranding
      playlists={playlists}
      defaultTab="login"
      isEmbedded={true}
    />
  );
}
