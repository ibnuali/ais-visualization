import { WORKER_IDS, type BoundingBox, type WorkerId } from "./models.ts";

export { WORKER_IDS, type WorkerId } from "./models.ts";

export interface WorkerRegion {
  readonly id: WorkerId;
  readonly name: string;
  readonly description: string;
  readonly boundingBoxes: readonly BoundingBox[];
}

// The shared longitude boundaries keep the three subscriptions geographically
// distinct while covering the same latitude range as the original subscription.
export const WORKER_REGIONS: readonly WorkerRegion[] = [
  {
    id: "west",
    name: "Indonesia West",
    description: "Indian Ocean to western Java",
    boundingBoxes: [
      [
        [-11, 95],
        [6, 110],
      ],
    ],
  },
  {
    id: "central",
    name: "Indonesia Central",
    description: "Java Sea to the central archipelago",
    boundingBoxes: [
      [
        [-11, 110],
        [6, 126],
      ],
    ],
  },
  {
    id: "east",
    name: "Indonesia East",
    description: "Eastern archipelago to Papua",
    boundingBoxes: [
      [
        [-11, 126],
        [6, 141],
      ],
    ],
  },
];

export const DEFAULT_WORKER_ID: WorkerId = "west";

export function isWorkerId(value: string | undefined): value is WorkerId {
  return typeof value === "string" && WORKER_IDS.includes(value as WorkerId);
}

export function getWorkerRegion(workerId: WorkerId): WorkerRegion {
  const region = WORKER_REGIONS.find((candidate) => candidate.id === workerId);
  if (!region) {
    throw new Error(`Unknown AIS worker region: ${workerId}`);
  }

  return region;
}
