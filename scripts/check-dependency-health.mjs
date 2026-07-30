import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

const checks = [
  {
    name: 'esbuild package metadata',
    run: async () => {
      const packagePath = require.resolve('esbuild/package.json');
      await access(packagePath);
      const packageJson = require(packagePath);
      return `${packageJson.name}@${packageJson.version}`;
    },
  },
  {
    name: 'esbuild native transform',
    run: async () => {
      const esbuild = require('esbuild');
      const result = esbuild.transformSync('const answer: number = 42;', {
        format: 'esm',
        loader: 'ts',
      });

      if (!result.code.includes('answer')) {
        throw new Error('transform output did not include expected symbol');
      }

      return `esbuild ${esbuild.version}`;
    },
  },
  {
    name: 'core-js package metadata',
    run: async () => {
      const packagePath = require.resolve('core-js/package.json');
      await access(packagePath);
      const packageJson = require(packagePath);
      return `${packageJson.name}@${packageJson.version}`;
    },
  },
  {
    name: 'core-js module files',
    run: async () => {
      const probes = [
        'core-js/modules/es.regexp.exec.js',
        'core-js/modules/es.array.iterator.js',
        'core-js/modules/es.promise.js',
        'core-js/modules/es.string.split.js',
        'core-js/internals/export.js',
      ];

      for (const probe of probes) {
        const resolvedPath = require.resolve(probe);
        await access(resolvedPath);
        const source = await readFile(resolvedPath, 'utf8');

        if (source.startsWith('MZ')) {
          throw new Error(`${probe} appears to contain binary executable content`);
        }

        try {
          new Function(source);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${probe} is not parseable JavaScript: ${message}`);
        }
      }

      return `${probes.length} probes resolved and parsed`;
    },
  },
];

const results = [];

for (const check of checks) {
  try {
    const detail = await check.run();
    results.push({ ...check, detail, passed: true });
  } catch (error) {
    results.push({
      ...check,
      error: error instanceof Error ? error.message : String(error),
      passed: false,
    });
  }
}

for (const result of results) {
  if (result.passed) {
    console.log(`[ok] ${result.name}: ${result.detail}`);
  } else {
    console.error(`[fail] ${result.name}: ${result.error}`);
  }
}

if (results.some((result) => !result.passed)) {
  console.error('');
  console.error('Dependency health check failed.');
  console.error('Suggested recovery: run npm install, then retry npm run dependency:health.');
  console.error('If only esbuild fails, npm rebuild esbuild is usually enough.');
  process.exit(1);
}

console.log('');
console.log('Dependency health check passed.');
