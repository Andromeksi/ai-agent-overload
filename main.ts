// main.ts — postxgame entrypoint (Node 22, standard library only).
// Copies POST.json from the repo root into the harness output directory.
// The video URL in POST.json is replaced with the real X post URL after the
// user posts the video; this entrypoint just stages the file for the harness.
// Local test: mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const botDir = process.env.MAKEFUN_BOT_DIR ?? '.';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
copyFileSync(join(botDir, 'POST.json'), join(outDir, 'POST.json'));
