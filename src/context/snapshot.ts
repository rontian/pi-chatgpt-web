export interface SessionSnapshot {
  goal: string;
  cwd?: string;
  project?: string;
  relevantContext: string[];
  constraints: string[];
  unknowns: string[];
}
