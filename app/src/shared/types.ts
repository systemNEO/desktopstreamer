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

// OBS-Lifecycle-Status
export type OBSStatus =
  | { state: 'detecting' }
  | { state: 'not-installed' }
  | { state: 'installing'; progress: number; message: string }
  | { state: 'install-failed'; error: string }
  | { state: 'starting' }
  | { state: 'ready'; obsVersion: string }
  | { state: 'disconnected'; error: string };

export interface InstallProgress {
  step: 'fetching-release' | 'downloading' | 'installing' | 'done';
  percent: number;       // 0..100
  message: string;
}
