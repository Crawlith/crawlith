import { Command } from 'commander';
import chalk from '../utils/chalk.js';
import open from 'open';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { startServer } from '@crawlith/server';
import { getDb, SiteRepository, SnapshotRepository, PluginRegistry, UrlUtil } from '@crawlith/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'ui');

export const getUiCommand = (registry: PluginRegistry) => {
  const ui = new Command('ui')
    .description('Start the Crawlith UI Dashboard')
    .argument('[url]', 'Site URL or domain to visualize (optional; defaults to latest crawled site)')
    .option('--port [number]', 'Port to run server on', '23484')
    .option('--host [address]', 'Host to bind server to', '127.0.0.1');

  // Let plugins register their flags on this command
  registry.registerPlugins(ui);

  ui.action(async (siteUrl, options) => {
    try {
      const requestedPort = parseInt(options.port, 10);
      const host = options.host;

      console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith UI`));

      if (!fs.existsSync(distPath)) {
        console.error(chalk.red(`❌ Web build not found at ${distPath}.`));
        console.error(chalk.yellow('   Please run "pnpm --filter @crawlith/web build" first.'));
        process.exit(1);
      }

      // Resolve site/snapshot
      const db = getDb();
      const siteRepo = new SiteRepository(db);
      const snapshotRepo = new SnapshotRepository(db);
      const resolved = resolveSiteForUi(siteUrl, siteRepo, snapshotRepo);

      if (!resolved) {
        if (siteUrl) {
          const domain = UrlUtil.extractDomain(siteUrl);
          console.error(chalk.red(`❌ Site not found: ${domain}`));
          console.error(chalk.yellow(`   Run "crawlith crawl ${domain}" first to generate data.`));
        } else {
          console.error(chalk.red('❌ No crawled sites found.'));
          console.error(chalk.yellow('   Run "crawlith crawl <url>" first to generate data.'));
        }
        process.exit(1);
      }

      const { site, snapshot } = resolved;
      const domain = site.domain;
      console.log(chalk.gray(`   Resolving site: ${domain}`));

      if (!snapshot) {
        console.error(chalk.red(`❌ No completed snapshots found for site: ${domain}`));
        process.exit(1);
      }

      let finalPort = requestedPort;
      let startedHere = false;

      try {
        await startServer({
          port: requestedPort,
          host,
          staticPath: distPath,
          siteId: site.id,
          snapshotId: snapshot.id,
          plugins: registry.getPlugins()
        });
        startedHere = true;
      } catch (error: any) {
        if (error?.code !== 'EADDRINUSE') {
          throw error;
        }

        const existing = await isCrawlithServer(host, requestedPort);
        if (existing) {
          console.log(chalk.yellow(`⚠️ Crawlith UI is already running on port ${requestedPort}. Reusing existing server.`));
          finalPort = requestedPort;
        } else {
          const nextPort = await findAvailablePort(host, requestedPort + 1, requestedPort + 20);
          if (!nextPort) {
            throw new Error(
              `Port ${requestedPort} is busy and no free port found in range ${requestedPort + 1}-${requestedPort + 20}`,
              { cause: error }
            );
          }
          finalPort = nextPort;
          console.log(chalk.yellow(`⚠️ Port ${requestedPort} is busy. Starting UI on port ${finalPort}.`));

          await startServer({
            port: finalPort,
            host,
            staticPath: distPath,
            siteId: site.id,
            snapshotId: snapshot.id,
            plugins: registry.getPlugins()
          });
          startedHere = true;
        }
      }

      const displayHost = host === '0.0.0.0' ? 'localhost' : host;
      const dashboardUrl = `http://${displayHost}:${finalPort}/?siteId=${site.id}`;

      if (startedHere) {
        console.log(chalk.green(`\n✅ Dashboard ready at: ${chalk.underline(dashboardUrl)}`));
        console.log(chalk.gray('   Press Ctrl+C to stop.'));
      } else {
        console.log(chalk.green(`\n✅ Opening existing dashboard: ${chalk.underline(dashboardUrl)}`));
      }

      await open(dashboardUrl);
    } catch (error) {
      console.error(chalk.red('\n❌ Error starting UI:'), error);
      process.exit(1);
    }
  });

  return ui;
};

function resolveSiteForUi(
  siteUrl: string | undefined,
  siteRepo: SiteRepository,
  snapshotRepo: SnapshotRepository
): { site: { id: number; domain: string }; snapshot: { id: number; created_at: string } | undefined } | null {
  if (siteUrl) {
    const domain = UrlUtil.extractDomain(siteUrl);
    const site = siteRepo.getSite(domain);
    if (!site) return null;
    return {
      site,
      snapshot: snapshotRepo.getLatestSnapshot(site.id, 'completed') as any
    };
  }

  const sites = siteRepo.getAllSites();
  let best: { site: any; snapshot: any } | null = null;

  for (const site of sites) {
    const snap = snapshotRepo.getLatestSnapshot(site.id, 'completed');
    if (!snap) continue;

    if (!best) {
      best = { site, snapshot: snap };
      continue;
    }

    const bestTime = new Date(best.snapshot.created_at).getTime();
    const snapTime = new Date(snap.created_at).getTime();
    if (snapTime > bestTime) {
      best = { site, snapshot: snap };
    }
  }

  return best;
}

function isPortFree(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(host: string, from: number, to: number): Promise<number | null> {
  for (let p = from; p <= to; p += 1) {
    if (await isPortFree(host, p)) return p;
  }
  return null;
}

async function isCrawlithServer(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    const res = await fetch(`http://${displayHost}:${port}/api/context`, { signal: controller.signal });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null) as any;
    return !!(body && typeof body.siteId === 'number' && typeof body.domain === 'string');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
