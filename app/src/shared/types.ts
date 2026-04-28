// Source-Modelle
export type SourceKind = 'screen' | 'window' | 'audio';

export interface Source {
  id: string;            // libobs-source-id (Plan B2 füllt das)
  kind: SourceKind;
  label: string;         // human-readable
  thumbnailDataUrl?: string;  // optional preview, base64
}

// Destination-Modelle
export type DestinationKind = 'twitch' | 'local' | 'custom';

export interface CustomRtmpDestination {
  kind: 'custom';
  rtmpUrl: string;
  streamKey: string;
  outputUrl: string;     // für VRChat-URL-Anzeige; rein kosmetisch
}

export interface TwitchDestination {
  kind: 'twitch';
  // gefüllt nach OAuth-Flow in Plan B3
}

export interface LocalDestination {
  kind: 'local';
  externalAccess: boolean;  // Cloudflare-Tunnel an/aus
}

export type Destination =
  | CustomRtmpDestination
  | TwitchDestination
  | LocalDestination;

// Audio-Settings
export interface AudioSettings {
  systemAudioEnabled: boolean;
  microphoneEnabled: boolean;
}

// Stream-Stats (Live-Anzeige)
export interface StreamStats {
  bitrateKbps: number;
  droppedFrames: number;
  uptimeSeconds: number;
}

// Persistente Settings (im electron-store)
export interface AppConfig {
  selectedSourceId: string | null;
  audio: AudioSettings;
  selectedDestinationKind: DestinationKind;
  customRtmp: CustomRtmpDestination | null;
}
