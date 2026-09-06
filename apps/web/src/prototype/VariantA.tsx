import type { PrototypeVariantProps } from "../types.ts";
import VesselMap from "./VesselMap.tsx";

export default function VariantA({
  vessels,
  selectedMmsi,
  onSelectVessel,
}: PrototypeVariantProps) {
  const selected = vessels.find((vessel) => vessel.mmsi === selectedMmsi);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <VesselMap
        vessels={vessels}
        selectedMmsi={selectedMmsi}
        onVesselClick={onSelectVessel}
      />

      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            maxWidth: 300,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            AIS Live Map
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            {vessels.length} vessels tracked · Click a vessel to see its track
          </p>
        </div>
      </div>

      {selected && (
        <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              minWidth: 280,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {selected.ship_name}
              </h3>
              <button
                onClick={() => onSelectVessel(null)}
                type="button"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#999",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 16px",
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ color: "#999" }}>MMSI</span>
                <br />
                <strong>{selected.mmsi}</strong>
              </div>
              <div>
                <span style={{ color: "#999" }}>Heading</span>
                <br />
                <strong>{selected.heading}°</strong>
              </div>
              <div>
                <span style={{ color: "#999" }}>Speed</span>
                <br />
                <strong>{selected.sog.toFixed(1)} kn</strong>
              </div>
              <div>
                <span style={{ color: "#999" }}>Status</span>
                <br />
                <strong>{selected.nav_status}</strong>
              </div>
              <div>
                <span style={{ color: "#999" }}>Position</span>
                <br />
                <strong>
                  {selected.latitude.toFixed(3)},{" "}
                  {selected.longitude.toFixed(3)}
                </strong>
              </div>
              <div>
                <span style={{ color: "#999" }}>Class</span>
                <br />
                <strong>Class {selected.vessel_class}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
