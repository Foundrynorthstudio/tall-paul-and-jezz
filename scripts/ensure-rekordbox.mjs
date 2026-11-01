import { existsSync, writeFileSync } from "node:fs";

const OUT = "src/data/rekordbox.json";
if (!existsSync(OUT)) writeFileSync(OUT, "{}\n");
