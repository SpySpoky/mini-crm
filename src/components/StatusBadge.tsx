import { STATUS_COLORS, STATUS_LABELS } from "../lib/statuses";
import type { TaskStatus } from "../types";

// Colored label with the Russian status name.
export default function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="badge" style={{ backgroundColor: STATUS_COLORS[status] }}>
      {STATUS_LABELS[status]}
    </span>
  );
}
