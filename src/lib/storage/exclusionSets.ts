import { readJson, writeJson } from "./storage";

export interface ExclusionSet {
  id: string;
  name: string;
  numbers: number[];
  createdAt: string;
}

const KEY = "exclusionSets";

export async function getExclusionSets(): Promise<ExclusionSet[]> {
  return readJson<ExclusionSet[]>(KEY, []);
}

export async function saveExclusionSet(name: string, numbers: number[]): Promise<ExclusionSet> {
  const sets = await getExclusionSets();
  const set: ExclusionSet = {
    id: `set_${Date.now()}`,
    name,
    numbers: [...new Set(numbers)].sort((a, b) => a - b),
    createdAt: new Date().toISOString(),
  };
  await writeJson(KEY, [set, ...sets]);
  return set;
}

export async function deleteExclusionSet(id: string): Promise<void> {
  const sets = await getExclusionSets();
  await writeJson(
    KEY,
    sets.filter((s) => s.id !== id)
  );
}
