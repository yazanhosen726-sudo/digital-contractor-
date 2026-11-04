import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { groupBySection, orderAfterItemMove, orderAfterSectionMove, type BoqIssue, type BoqLine } from "@/lib/boq";
import { TAKEOFF_UNIT_LABELS } from "@/lib/takeoff";

export function formatBoqNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function BoqLineList({ lines, issues, canWrite, onEdit, onMoveLine, onMoveSection }: {
  lines: BoqLine[];
  issues: BoqIssue[];
  canWrite: boolean;
  onEdit: (line: BoqLine) => void;
  onMoveLine: (lineId: string, direction: -1 | 1) => void;
  onMoveSection: (section: string, direction: -1 | 1) => void;
}) {
  const groups = groupBySection(lines);
  if (groups.length === 0) {
    return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No lines yet. Add a line, or generate the BOQ again from the takeoff.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map(group => {
        const canMoveUp = orderAfterSectionMove(lines, group.section, -1) !== null;
        const canMoveDown = orderAfterSectionMove(lines, group.section, 1) !== null;
        return (
          <section key={group.section} aria-label={`Section ${group.section}`}>
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <h3 className="min-w-0 break-words font-semibold">
                {group.section} <span className="text-sm font-normal text-muted-foreground">({group.lines.length})</span>
              </h3>
              {canWrite && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Move section ${group.section} up`} disabled={!canMoveUp} onClick={() => onMoveSection(group.section, -1)}><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Move section ${group.section} down`} disabled={!canMoveDown} onClick={() => onMoveSection(group.section, 1)}><ArrowDown className="size-4" /></Button>
                </div>
              )}
            </div>
            <ul className="mt-3 space-y-3">
              {group.lines.map(line => {
                const lineIssues = issues.filter(issue => issue.lineId === line.id);
                const canMoveUp = orderAfterItemMove(lines, line.id, -1) !== null;
                const canMoveDown = orderAfterItemMove(lines, line.id, 1) !== null;
                return (
                  <li key={line.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="tabular-nums">{line.itemNumber || "No number"}</span>
                          <Badge variant={line.basis === "calculated" ? "secondary" : "outline"}>
                            {line.basis === "calculated" ? "Calculated from measurements" : "Manual entry"}
                          </Badge>
                        </div>
                        <p className="mt-1 break-words font-medium">
                          {line.description?.trim() ? line.description : <span className="text-destructive">No description</span>}
                        </p>
                        {line.category && <p className="mt-1 text-xs text-muted-foreground">Category: {line.category}</p>}
                      </div>
                      <div className="text-right">
                        {line.quantity !== null && line.unit ? (
                          <p className="text-lg font-semibold tabular-nums">
                            {formatBoqNumber(line.quantity)} <span className="text-sm font-normal text-muted-foreground">{TAKEOFF_UNIT_LABELS[line.unit]}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-destructive">No quantity</p>
                        )}
                      </div>
                    </div>
                    {lineIssues.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {lineIssues.map((issue, index) => (
                          <li key={index} className={issue.severity === "error" ? "text-destructive" : "text-amber-800"}>
                            {issue.severity === "error" ? "Error: " : "Check: "}{issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                    {line.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{line.notes}</p>}
                    {canWrite && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(line)}><Pencil className="mr-2 size-4" />Edit</Button>
                        <Button variant="ghost" size="icon" aria-label={`Move ${line.description ?? "line"} up`} disabled={!canMoveUp} onClick={() => onMoveLine(line.id, -1)}><ArrowUp className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Move ${line.description ?? "line"} down`} disabled={!canMoveDown} onClick={() => onMoveLine(line.id, 1)}><ArrowDown className="size-4" /></Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
