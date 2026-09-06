import type {
  PlaybackPosition,
  TrackState,
  TrackStatus,
  VesselRecord,
} from "../../../types.ts";
import { formatNumber, formatTimestamp } from "../utils.ts";
import Icon from "./Icon.tsx";

interface VesselDetailCardProps {
  isTrackPlaying: boolean;
  onClear: () => void;
  onPauseTrack: () => void;
  onPlayTrack: () => void;
  onSeekTrack: (value: string | number) => void;
  playbackIndex: number;
  playbackPosition: PlaybackPosition | null;
  selected: VesselRecord | null;
  trackState: TrackState;
}

export default function VesselDetailCard({
  isTrackPlaying,
  onClear,
  onPauseTrack,
  onPlayTrack,
  onSeekTrack,
  playbackIndex,
  playbackPosition,
  selected,
  trackState,
}: VesselDetailCardProps) {
  if (!selected) {
    return null;
  }

  const hasTrackPlayback =
    trackState.status === "ready" && trackState.points > 1;
  let playbackLabel = "Play";
  if (isTrackPlaying) {
    playbackLabel = "Pause";
  } else if (playbackIndex >= trackState.points - 1) {
    playbackLabel = "Replay";
  }

  const trackStatusMessages: Record<TrackStatus, string> = {
    loading: "Loading the last 24 hours…",
    error: trackState.error,
    ready: `${trackState.points.toLocaleString()} positions · last 24 hours`,
    idle: "Loading track",
  };

  return (
    <section
      className="map-card vessel-detail-card"
      aria-labelledby="vessel-detail-title"
    >
      <div className="map-card__header">
        <div>
          <span className="panel-kicker">VESSEL DETAIL</span>
          <h2 id="vessel-detail-title">
            {selected.ship_name || "Unknown vessel"}
          </h2>
        </div>
        <button
          aria-label="Clear selected vessel"
          className="panel-close"
          onClick={onClear}
          type="button"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>MMSI</dt>
          <dd>{selected.mmsi}</dd>
        </div>
        <div>
          <dt>Class</dt>
          <dd>
            {selected.vessel_class ? `Class ${selected.vessel_class}` : "—"}
          </dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {formatNumber(selected.latitude, 3)},{" "}
            {formatNumber(selected.longitude, 3)}
          </dd>
        </div>
        <div>
          <dt>SOG</dt>
          <dd>{formatNumber(selected.sog)} kn</dd>
        </div>
        <div>
          <dt>COG</dt>
          <dd>{formatNumber(selected.cog, 0)}°</dd>
        </div>
        <div>
          <dt>Heading</dt>
          <dd>{formatNumber(selected.heading, 0)}°</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{selected.nav_status || "—"}</dd>
        </div>
      </dl>
      {hasTrackPlayback && (
        <div className="track-playback">
          <div className="track-playback__header">
            <div className="track-playback__copy">
              <span className="panel-kicker">TRACK PLAYBACK</span>
              <strong>
                {playbackPosition
                  ? `${formatTimestamp(playbackPosition.timestamp)} · point ${playbackIndex + 1} of ${trackState.points}`
                  : "Ready to replay the route"}
              </strong>
            </div>
            <button
              aria-label={`${playbackLabel} vessel track`}
              className="button button--quiet track-playback__button"
              onClick={isTrackPlaying ? onPauseTrack : onPlayTrack}
              type="button"
            >
              <Icon name={isTrackPlaying ? "pause" : "play"} size={14} />
              {playbackLabel}
            </button>
          </div>
          <input
            aria-label="Scrub vessel track playback"
            className="track-playback__range"
            max={trackState.points - 1}
            min="0"
            onChange={(event) => onSeekTrack(event.target.value)}
            step="1"
            type="range"
            value={playbackIndex}
          />
        </div>
      )}
      <div
        className={`track-status track-status--${trackState.status}`}
        aria-live="polite"
      >
        <span className="track-status__icon">
          <Icon
            name={trackState.status === "error" ? "alert" : "route"}
            size={15}
          />
        </span>
        <span>{trackStatusMessages[trackState.status]}</span>
        <button className="track-clear" onClick={onClear} type="button">
          Clear
        </button>
      </div>
    </section>
  );
}
