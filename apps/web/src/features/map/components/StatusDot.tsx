import type { StatusTone } from "../../../types.ts";

interface StatusDotProps {
  state: StatusTone;
}

export default function StatusDot({ state }: StatusDotProps) {
  return (
    <span aria-hidden="true" className={`status-dot status-dot--${state}`} />
  );
}
