import type { FormEvent } from "react";
import Icon from "./Icon.tsx";

interface VesselSearchProps {
  error: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  query: string;
  vesselCount: number;
}

export default function VesselSearch({
  error,
  onChange,
  onSubmit,
  query,
  vesselCount,
}: VesselSearchProps) {
  const hasError = Boolean(error);

  return (
    <section
      className={`map-card vessel-search-card ${hasError ? "vessel-search-card--error" : ""}`}
      aria-labelledby="vessel-search-title"
    >
      <form className="vessel-search-form" onSubmit={onSubmit} noValidate>
        <div className="vessel-search-heading">
          <div>
            <span className="panel-kicker">LOOKUP / VESSEL</span>
            <h2 id="vessel-search-title">Find by MMSI</h2>
          </div>
          <span className="vessel-search-count">
            {vesselCount.toLocaleString()} tracked
          </span>
        </div>
        <div className="vessel-search-controls">
          <div className="input-shell">
            <span className="input-prefix" aria-hidden="true">
              <Icon name="search" size={15} />
            </span>
            <input
              aria-describedby="vessel-search-help"
              aria-invalid={hasError}
              autoComplete="off"
              id="vessel-mmsi"
              inputMode="numeric"
              onChange={(event) => onChange(event.target.value)}
              placeholder="e.g. 525000000"
              spellCheck="false"
              type="search"
              value={query}
            />
          </div>
          <button className="button button--primary" type="submit">
            Find
          </button>
        </div>
        <p
          className={`vessel-search-help ${hasError ? "vessel-search-help--error" : ""}`}
          id="vessel-search-help"
          aria-live="polite"
        >
          {error || "Search vessels in the most recent database snapshot."}
        </p>
      </form>
    </section>
  );
}
