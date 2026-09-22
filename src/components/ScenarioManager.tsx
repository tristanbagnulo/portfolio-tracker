import { Scenario } from "../types";
import { scenarioColor } from "./ProjectionChart";

export function ScenarioManager({
  scenarios,
  onEdit,
  onDelete,
  onAdd,
  onClose,
}: {
  scenarios: Scenario[];
  onEdit: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Manage scenarios</h2>
        {scenarios.map((s, i) => (
          <div className="scenario-list-row" key={s.id}>
            <span className="dot" style={{ background: scenarioColor(i) }} />
            <span className="name">{s.name}</span>
            <span className="acts">
              <button onClick={() => onEdit(s)}>Edit</button>
              {scenarios.length > 1 && (
                <button className="danger" onClick={() => onDelete(s.id)}>
                  Delete
                </button>
              )}
            </span>
          </div>
        ))}
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button className="primary" onClick={onAdd}>
            + New scenario
          </button>
        </div>
      </div>
    </div>
  );
}
