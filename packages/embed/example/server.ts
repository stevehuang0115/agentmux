/**
 * Start the @crewly/embed demo host.
 *
 *   EMBED_ID=emb_… EMBED_SECRET=… PORT=4600 npx tsx example/server.ts
 *
 * Optional: EMBED_ROLES (default `admin,teacher`), EMBED_SCRIPT_URL.
 *
 * `npx tsx example/server.ts --mint-host-token <sub>` prints a host token as
 * Cloud would mint it, to call the ops API by hand with curl.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { signHostToken } from '../src/server/index.js';
import { createDemoApp, type DemoConfig } from './demo-app.js';

const DEFAULT_PORT = 4600;
const DEFAULT_ROLES = 'admin,teacher';

/** Parsed environment for the demo. */
export interface DemoEnv extends DemoConfig {
  port: number;
}

/**
 * Read the demo's configuration from environment variables.
 *
 * @param env - Environment (usually `process.env`)
 * @returns Config with defaults applied
 * @throws Error when PORT is not a valid port number
 */
export function readDemoEnv(env: Record<string, string | undefined>): DemoEnv {
  const port = env.PORT ? Number(env.PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid PORT: ${env.PORT}`);
  const roles = (env.EMBED_ROLES ?? DEFAULT_ROLES)
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return {
    port,
    embedId: env.EMBED_ID ?? '',
    secret: env.EMBED_SECRET ?? '',
    roles,
    ...(env.EMBED_SCRIPT_URL ? { scriptUrl: env.EMBED_SCRIPT_URL } : {}),
  };
}

/**
 * Entry point: mint a token, or start the server.
 *
 * @param argv - Command-line arguments after the script name
 */
async function main(argv: string[]): Promise<void> {
  const config = readDemoEnv(process.env);
  if (argv[0] === '--mint-host-token') {
    if (!config.embedId || !config.secret || !argv[1]) {
      console.error('Usage: EMBED_ID=… EMBED_SECRET=… tsx example/server.ts --mint-host-token <sub>');
      process.exitCode = 1;
      return;
    }
    console.log(await signHostToken({ embedId: config.embedId, secret: config.secret, sub: argv[1] }));
    return;
  }
  if (!config.embedId || !config.secret) {
    console.warn('EMBED_ID / EMBED_SECRET not set: the token route will answer 204 and no panel will show.');
  }
  const { listener } = createDemoApp(config);
  createServer((req, res) => {
    listener(req, res).catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  }).listen(config.port, () => {
    console.log(`Demo host on http://localhost:${config.port} (embed ${config.embedId || 'unset'}, roles ${config.roles.join(',')})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main(process.argv.slice(2));
}
