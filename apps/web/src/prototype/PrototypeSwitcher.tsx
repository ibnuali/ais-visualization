import type { PrototypeVariant, VariantKey } from "../types.ts";

interface PrototypeSwitcherProps {
  variants: PrototypeVariant[];
  current: VariantKey;
  onChange: (key: VariantKey) => void;
}

export default function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: PrototypeSwitcherProps) {
  const currentIndex = variants.findIndex((variant) => variant.key === current);
  const goPrev = (): void => {
    const prev = (currentIndex - 1 + variants.length) % variants.length;
    onChange(variants[prev].key);
  };
  const goNext = (): void => {
    const next = (currentIndex + 1) % variants.length;
    onChange(variants[next].key);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "rgba(20,20,20,0.92)",
        color: "#fff",
        borderRadius: 999,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        userSelect: "none",
      }}
    >
      <button
        onClick={goPrev}
        type="button"
        style={{
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          borderRadius: "50%",
          width: 28,
          height: 28,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        ←
      </button>
      <span style={{ minWidth: 120, textAlign: "center" }}>
        {variants[currentIndex]?.label}
      </span>
      <button
        onClick={goNext}
        type="button"
        style={{
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          borderRadius: "50%",
          width: 28,
          height: 28,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        →
      </button>
    </div>
  );
}
