import 'dotenv/config';

import { startMcpServer } from './index';

type CliOptions = {
    host: string;
    port: number;
    roots: string[];
    enableFs: boolean;
    corsAllowAll: boolean;
    corsOrigins: string[];
    janitorExit: boolean;
};

function parseArgs(argv: string[]): CliOptions {
    const opts: CliOptions = {
        host: process.env.HOST ?? '127.0.0.1',
        port: process.env.PORT ? Number(process.env.PORT) : 3000,
        roots: [],
        enableFs: false,
        corsAllowAll: false,
        corsOrigins: process.env.MCP_ALLOWED_ORIGIN ? [process.env.MCP_ALLOWED_ORIGIN] : [],
        janitorExit: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--host') {
            const value = argv[i + 1];
            if (!value) throw new Error('--host requires a value');
            opts.host = value;
            i++;
            continue;
        }

        if (arg === '--port') {
            const value = argv[i + 1];
            if (!value) throw new Error('--port requires a value');
            opts.port = Number(value);
            i++;
            continue;
        }

        if (arg === '--root') {
            const value = argv[i + 1];
            if (!value) throw new Error('--root requires a value');
            opts.roots.push(value);
            i++;
            continue;
        }

        if (arg === '--enable-fs') {
            opts.enableFs = true;
            continue;
        }

        if (arg === '--cors-allow-all') {
            opts.corsAllowAll = true;
            continue;
        }

        if (arg === '--cors-origin') {
            const value = argv[i + 1];
            if (!value) throw new Error('--cors-origin requires a value');
            opts.corsOrigins.push(value);
            i++;
            continue;
        }

        if (arg === '--janitor-exit') {
            opts.janitorExit = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            const helpText = [
                'mcp-server-ref',
                '',
                'Options:',
                '  --host <host>           Host to bind (default: 127.0.0.1 or HOST env)',
                '  --port <port>           Port to listen on (default: 3000 or PORT env)',
                '  --enable-fs             Enable filesystem tools (fs/ls, fs/read_file)',
                '  --root <path>           Allowed root (repeatable). Defaults to CWD if --enable-fs and no roots given.',
                '  --cors-origin <origin>  Allowed CORS origin (repeatable). If unset, no CORS headers are sent.',
                '  --cors-allow-all        Allow all CORS origins (insecure; demo only)',
                '  --janitor-exit          Exit process when health turns red (demo mode)',
            ].join('\n');
            process.stdout.write(helpText + '\n');
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!Number.isFinite(opts.port) || opts.port <= 0) {
        throw new Error(`Invalid --port: ${opts.port}`);
    }

    return opts;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    const roots = opts.enableFs && opts.roots.length === 0 ? [process.cwd()] : opts.roots;

    // Build options object
    const serverOptions: any = {
        host: opts.host,
        port: opts.port,
        roots,
        enableFsTools: opts.enableFs,
        janitorExitOnRed: opts.janitorExit,
    };

    // Only set CORS if explicitly configured via CLI flags
    if (opts.corsAllowAll || opts.corsOrigins.length > 0) {
        serverOptions.cors = {
            allowAll: opts.corsAllowAll,
            origins: opts.corsOrigins,
        };
    }

    const { server } = startMcpServer(serverOptions);

    const shutdown = (signal: string) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
        
        // Force close after 10s
        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message + '\n');
    process.exitCode = 1;
});
