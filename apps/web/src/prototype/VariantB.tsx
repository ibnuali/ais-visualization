import type { PrototypeVariantProps } from "../types.ts";
import VesselMap from "./VesselMap.tsx";

export default function VariantB({
  vessels,
  selectedMmsi,
  onSelectVessel,
}: PrototypeVariantProps) {
  const selected = vessels.find((vessel) => vessel.mmsi === selectedMmsi);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <VesselMap
          vessels={vessels}
          selectedMmsi={selectedMmsi}
          onVesselClick={onSelectVessel}
        />
      </div>

      <div
        style={{
          width: 360,
          flexShrink: 0,
          background: "#fff",
          borderLeft: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{ padding: "16px 20px", borderBottom: "1px solid #e0e0e0" }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Vessel List
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>
            {vessels.length} vessels
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {vessels.map((vessel) => (
            <div
              key={vessel.mmsi}
              onClick={() => onSelectVessel(vessel.mmsi)}
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
                background:
                  selectedMmsi === vessel.mmsi ? "#f0f7ff" : "transparent",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {vessel.ship_name}
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                MMSI {vessel.mmsi} · {vessel.heading}° · {vessel.sog.toFixed(1)}{" "}
                kn
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div
            style={{
              padding: 20,
              borderTop: "1px solid #e0e0e0",
              background: "#fafafa",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
              {selected.ship_name}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
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
        )}
      </div>
    </div>
  );
}
