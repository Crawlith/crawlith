/* global console, process */
import express from 'express';
import path from 'path';
import chalk from 'chalk';
export function startServer(options) {
    return new Promise((resolve, reject) => {
        const { port, host = '127.0.0.1', staticPath, siteName } = options;
        const resolvedStaticPath = path.resolve(staticPath);
        const app = express();
        // Serve static files
        app.use(express.static(resolvedStaticPath));
        // SPA fallback
        app.get('*', (req, res) => {
            res.sendFile(path.join(resolvedStaticPath, 'index.html'));
        });
        const server = app.listen(port, host, () => {
            const displayHost = host === '0.0.0.0' ? 'localhost' : host;
            console.log(chalk.green(`\n✅ Crawlith UI Server started at http://${displayHost}:${port}`));
            if (siteName) {
                console.log(chalk.gray(`   Viewing site: ${siteName}`));
            }
            resolve();
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(chalk.red(`❌ Port ${port} is already in use.`));
                reject(err);
            }
            else {
                reject(err);
            }
        });
        const shutdown = () => {
            console.log(chalk.yellow('\nShutting down server...'));
            server.close(() => {
                console.log(chalk.green('Server stopped.'));
                process.exit(0);
            });
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    });
}
