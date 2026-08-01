"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";

// The downloaded topojson/geojson of Thailand
const geoUrl = "/thailand.json";

interface ThailandMapProps {
  locationCount: Record<string, number>;
}

export function ThailandMap({ locationCount }: ThailandMapProps) {
  const [tooltip, setTooltip] = useState("");

  const maxCases = Math.max(...Object.values(locationCount), 1);

  const colorScale = scaleLinear<string>()
    .domain([0, maxCases])
    .range(["var(--background-secondary, #f1f5f9)", "var(--accent-primary, #3b82f6)"]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 1800,
          center: [100.9925, 13.0384], // roughly center of Thailand
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              // Extract province name (depends on topojson property, e.g. "NAME_1" or "pro_th")
              // Handle common property names from various thailand json sources
              const nameEn = geo.properties.NAME_1 || geo.properties.name || geo.properties.pro_en || "";
              const nameTh = geo.properties.pro_th || geo.properties.NAME_1 || "";
              const count = locationCount[nameTh] || locationCount[`จังหวัด${nameTh}`] || locationCount[nameEn] || 0;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={() => setTooltip(`${nameTh || nameEn}: ${count} เรื่อง`)}
                  onMouseLeave={() => setTooltip("")}
                  style={{
                    default: {
                      fill: count > 0 ? colorScale(count) : "var(--surface-border, #e2e8f0)",
                      stroke: "#ffffff",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: "var(--accent-secondary, #6366f1)",
                      stroke: "#ffffff",
                      strokeWidth: 1,
                      outline: "none",
                    },
                    pressed: {
                      fill: "var(--accent-primary, #3b82f6)",
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      
      {tooltip && (
        <div style={{
          position: "absolute", 
          top: "10px", 
          right: "10px", 
          background: "var(--surface)", 
          padding: "8px 12px", 
          borderRadius: "8px", 
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          fontSize: "0.85rem",
          fontWeight: 500,
          border: "1px solid var(--surface-border)"
        }}>
          {tooltip}
        </div>
      )}
      
      <div style={{
        position: "absolute",
        bottom: "10px",
        left: "10px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "0.75rem",
        color: "var(--text-muted)"
      }}>
        <span>น้อย</span>
        <div style={{ width: "80px", height: "8px", background: `linear-gradient(to right, var(--surface-border, #e2e8f0), var(--accent-primary, #3b82f6))`, borderRadius: "4px" }} />
        <span>มาก</span>
      </div>
    </div>
  );
}
