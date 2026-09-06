import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import PrototypeSwitcher from "./PrototypeSwitcher.tsx";
import VariantA from "./VariantA.tsx";
import VariantB from "./VariantB.tsx";
import VariantC from "./VariantC.tsx";
import { generateMockVessels, tickVessels } from "./mockData.ts";
import type {
  PrototypeVariant,
  PrototypeVariantProps,
  VariantKey,
  MockVessel,
} from "../types.ts";

const VARIANTS: PrototypeVariant[] = [
  { key: "A", label: "A — Fullscreen + floating panels", Component: VariantA },
  { key: "B", label: "B — Split dashboard", Component: VariantB },
  { key: "C", label: "C — Map + bottom drawer", Component: VariantC },
];

function isVariantKey(value: string | null): value is VariantKey {
  return value === "A" || value === "B" || value === "C";
}

function getInitialVariantKey(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("variant");
  return isVariantKey(value) ? value : "A";
}

export default function MapPrototype() {
  const [variantKey, setVariantKey] =
    useState<VariantKey>(getInitialVariantKey);
  const [vessels, setVessels] = useState<MockVessel[]>(generateMockVessels);
  const [selectedMmsi, setSelectedMmsi] = useState<number | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVessels((previousVessels) => tickVessels(previousVessels));
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  const handleVariantChange = (key: VariantKey): void => {
    const params = new URLSearchParams(window.location.search);
    params.set("variant", key);
    window.history.replaceState(null, "", `?${params.toString()}`);
    setVariantKey(key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      const currentIndex = VARIANTS.findIndex(
        (variant) => variant.key === variantKey,
      );
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const nextIndex =
        (currentIndex + direction + VARIANTS.length) % VARIANTS.length;
      handleVariantChange(VARIANTS[nextIndex].key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variantKey]);

  const variant =
    VARIANTS.find((candidate) => candidate.key === variantKey) ?? VARIANTS[0];
  const VariantComponent: ComponentType<PrototypeVariantProps> =
    variant.Component;

  return (
    <>
      <VariantComponent
        vessels={vessels}
        selectedMmsi={selectedMmsi}
        onSelectVessel={setSelectedMmsi}
      />
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variantKey}
        onChange={handleVariantChange}
      />
    </>
  );
}
