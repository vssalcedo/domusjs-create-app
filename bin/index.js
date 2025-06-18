#!/usr/bin/env node

import prompts from 'prompts';
import chalk from 'chalk';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';


console.log(chalk.cyanBright('\n🛠️  Create DomusJS App\n'));


const response = await prompts([
    {
        type: 'text',
        name: 'projectName',
        message: chalk.green('📝 Project name:'),
        validate: name => name ? true : 'Project name is required'
    },
    {
        type: 'text',
        name: 'typescriptVersion',
        message: chalk.green('🧪 TypeScript version:'),
        initial: '5.2.2',
        validate: async (value) => {
            const isValid = await versionExists('typescript', value);
            return isValid || 'Invalid TypeScript version';
        }
    },
    {
        type: 'confirm',
        name: 'useEslint',
        message: chalk.green('📏 Do you want to include ESLint?'),
        initial: true
    }
], {
    onCancel: () => {
        console.log(chalk.red('\n❌ Operation cancelled by user.\n'));
        process.exit(1);
    }
});

const { projectName, typescriptVersion, useEslint } = response;


const projectDir = resolve(process.cwd(), projectName);
mkdirSync(projectDir, { recursive: true });

const write = (file, content) => {
    writeFileSync(join(projectDir, file), content);
};

function versionExists(pkg, version) {
    try {
        execSync(`npm view ${pkg}@${version} version`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function detectPackageManager() {
    const has = (cmd) => {
        try {
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    };
    if (has('pnpm')) return 'pnpm';
    if (has('yarn')) return 'yarn';
    if (has('bun')) return 'bun';
    return 'npm';
}

const packageManager = detectPackageManager();

const scripts = {
    build: "tsc",
    dev: "ts-node-dev --respawn --transpile-only index.ts",
    ...(useEslint && { lint: 'eslint . --ext .ts' }),
    test: "echo \"Error: no test specified\" && exit 1"
};

const devDependencies = {
    "@types/express": "^5.0.3",
    "@types/node": "^22.15.3",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": typescriptVersion,
    ...(useEslint && {
        eslint: '^9.29.0',
        '@typescript-eslint/parser': '^8.34.1',
        '@typescript-eslint/eslint-plugin': '^8.34.1'
    })
};

// package.json
write('package.json', JSON.stringify({
    name: projectName,
    description: '',
    version: '0.1.0',
    main: 'index.js',
    scripts,
    keywords: [],
    author: '',
    license: 'MIT',
    dependencies: {
        '@domusjs/core': '^0.1.0',
        '@domusjs/infrastructure': '^0.1.0',
        'express': "^5.1.0",
        'reflect-metadata': "^0.2.2",
        "tsyringe": "^4.9.1",
    },
    devDependencies
}, null, 2));

// tsconfig.json
write('tsconfig.json', JSON.stringify({
    "compilerOptions": {
        "target": "es2016",
        "lib": [
            "es2022"
        ],
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true,
        "module": "commonjs",
        "resolveJsonModule": true,
        "outDir": "dist",
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "strict": true,
        "skipLibCheck": true
    }
}, null, 2));

// .eslintrc.json
if (useEslint) {
    write('eslint.config.mjs', `
  import eslintPluginTs from '@typescript-eslint/eslint-plugin';
  import parserTs from '@typescript-eslint/parser';
  
  export default [
    {
      files: ['**/*.ts'],
      ignores: ['dist/**', 'node_modules/**'],
      languageOptions: {
        parser: parserTs,
        parserOptions: {
          project: './tsconfig.json',
          sourceType: 'module'
        }
      },
      plugins: {
        '@typescript-eslint': eslintPluginTs
      },
      rules: {
        semi: ['error', 'always'],
        quotes: ['error', 'single'],
        '@typescript-eslint/explicit-module-boundary-types': 'off'
      }
    }
  ];
  `.trim());
  }

// index.ts
write('index.ts', `
import 'reflect-metadata';

import { container } from 'tsyringe';
import { Logger } from '@domusjs/core';
import { registerDomusCore, PinoLogger } from '@domusjs/infrastructure';

import { createServer } from './server';

async function registerDependencies() {
    registerDomusCore({
    logger: new PinoLogger()
    });
}

async function bootstrap() {
    await registerDependencies(); // Register all dependencies before starting the server

    const logger = container.resolve<Logger>('Logger');

    try {
    const app = createServer();
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        logger.info(\`Server running on port \${port}\`);
    });

    process.on('SIGINT', async () => {
        logger.info('Shutting down...');
        process.exit(0);
    });

    } catch (err) {
    logger.error('Error in bootstrap', err);
    }
}

bootstrap();
`);

// server.ts
write('server.ts', `
import express from 'express';
import routes from './routes';
import { errorHandler } from '@domusjs/infrastructure';

export function createServer() {

    const app = express();

    app.use(express.json());
    app.use(routes);
    app.use(errorHandler);

    return app;
}
`);

// routes.ts
write('routes.ts', `
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hello World');
});

export default router;
`);

console.log(chalk.greenBright(`\n✅ Project ${chalk.bold(projectName)} created successfully!\n`));

// Install dependencies
console.log(chalk.cyan(`\n📦 Installing dependencies with ${packageManager}...\n`));
execSync(`${packageManager} install`, { cwd: projectDir, stdio: 'inherit' });

console.log(chalk.yellow('\n👉 Next steps:\n'));
console.log(chalk.blue(`   cd ${projectName}`));
console.log(chalk.blue(`   ${packageManager} run dev\n`));
