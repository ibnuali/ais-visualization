import type { ReactNode } from "react";
import type { IconName } from "../../../types.ts";

const ICON_PATHS: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h3l2-7 4 14 2-7h5" />,
  alert: <path d="M12 3 2.8 20h18.4L12 3Z M12 9v4m0 3h.01" />,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  command: (
    <path d="M9 9V7a3 3 0 1 0-3 3h2m1-1h6V7a3 3 0 1 1 3 3h-2M9 9h6v6H9zM9 15v2a3 3 0 1 1-3-3h2m1 1h6v2a3 3 0 1 0 3-3h-2" />
  ),
  locate: (
    <path d="M12 5V2m0 20v-3M5 12H2m20 0h-3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="m8 5 11 7-11 7V5Z" />,
  refresh: (
    <path d="M20 11a8 8 0 0 0-14.6-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.6 4L21 14M21 19v-5h-5" />
  ),
  route: (
    <path d="M5 18a2 2 0 1 0 0 .01M19 6a2 2 0 1 0 0 .01M7 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4" />
  ),
  search: (
    <path d="M17.6 17.6 21 21m-3.4-10.2a6.8 6.8 0 1 1-13.6 0 6.8 6.8 0 0 1 13.6 0Z" />
  ),
  trash: <path d="M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14" />,
};

interface IconProps {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 18 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
