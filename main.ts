// Vice Cover Studio — the program that hands the entry in (Node 22, standard
// library only). It copies this repository's app/ and screenshots/ into the
// output directory and writes /output/dossier.json, the summary the judge
// reads, using the vendored make.fun library. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Fails the run unless `dir` holds at most `maxFiles` entries in total. */
function checkTreeSize(dir: string, maxFiles: number): void {
  let count = 0;
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      count += 1;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
    }
  };
  walk(dir);
  if (count > maxFiles) throw new Error(`${dir} holds ${count} entries, over the ${maxFiles} cap`);
}

mkdirSync(outDir, { recursive: true });
checkTreeSize(join(repoRoot, 'app'), 993);
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: the dossier text is capped at 160 KiB; the other
// numbers refuse an entry the scorer would refuse (more than 4 screenshots
// or one over 256 KiB; more than 993 files or 48 MiB in app/).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
