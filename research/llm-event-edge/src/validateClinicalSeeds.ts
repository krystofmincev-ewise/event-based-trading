import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseClinicalTrialSeeds } from "./clinicalTrialSeeds.js";
import { STUDY_ROOT } from "./io.js";

const path = resolve(STUDY_ROOT, "clinical-trials", "seed-events.json");
const seeds = parseClinicalTrialSeeds(
  JSON.parse(await readFile(path, "utf8")) as unknown,
);
const eligible = seeds.filter(
  ({ confirmatoryEligibility }) => confirmatoryEligibility === "eligible",
).length;
console.log(
  `Validated ${seeds.length} discovery seeds; ${eligible} are provisionally eligible pending blinded corpus adjudication.`,
);
