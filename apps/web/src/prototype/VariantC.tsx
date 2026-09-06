import { useState } from "react";
import type { PrototypeVariantProps } from "../types.ts";
import VesselMap from "./VesselMap.tsx";

export default function VariantC({
  vessels,
  selectedMmsi,
  onSelectVessel,
}: PrototypeVariantProps) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const selected = vessels.find((vessel) => vessel.mmsi === selectedMmsi);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <VesselMap
          vessels={vessels}
          selectedMmsi={selectedMmsi}
          onVesselClick={onSelectVessel}
        />
      </div>

      <div
        style={{
          background: "#fff",
          borderTop: "1px solid #e0e0e0",
          height: drawerOpen ? "40%" : 48,
          flexShrink: 0,
          transition: "height 0.2s",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setDrawerOpen((isOpen) => !isOpen)}
          type="button"
          style={{
            width: "100%",
            padding: "12px 20px",
            border: "none",
            background: "none",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span>
            {selected
              ? selected.ship_name
              : `${vessels.length} vessels tracked`}
          </span>
          <span>{drawerOpen ? "▼" : "▲"}</span>
        </button>

        {drawerOpen && (
          <div
            style={{
              display: "flex",
              height: "calc(100% - 48px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "50%",
                overflow: "auto",
                borderRight: "1px solid #f0f0f0",
              }}
            >
              {vessels.map((vessel) => (
                <div
                  key={vessel.mmsi}
                  onClick={() => onSelectVessel(vessel.mmsi)}
                  style={{
                    padding: "10px 20px",
                    borderBottom: "1px solid #f0f0f0",
                    cursor: "pointer",
                    background:
                      selectedMmsi === vessel.mmsi ? "#f0f7ff" : "transparent",
                    fontSize: 13,
                  }}
                >
                  <strong>{vessel.ship_name}</strong>
                  <span style={{ color: "#999", marginLeft: 8 }}>
                    {vessel.heading}° · {vessel.sog.toFixed(1)} kn
                  </span>
                </div>
              ))}
            </div>

            <div style={{ width: "50%", overflow: "auto", padding: 20 }}>
              {selected ? (
                <div
                  style={{
                    fontSize: 13,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
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
              ) : (
                <p style={{ color: "#999", fontSize: 13 }}>
                  Select a vessel to see details
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
