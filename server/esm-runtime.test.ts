import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
let output: string;
const emitted: string[] = [];

function sourceFiles(directory: string) {
  return fs
    .readdirSync(path.join(root, directory), { recursive: true })
    .map(String)
    .filter(
      file =>
        file.endsWith(".ts") &&
        !file.endsWith(".d.ts") &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".spec.ts")
    )
    .map(file => path.join(directory, file));
}

function imports(file: string) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const specifiers: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers;
}

beforeAll(() => {
  const temporaryRoot = path.join(root, "tmp");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  output = fs.mkdtempSync(path.join(temporaryRoot, "civicfix-esm-"));
  fs.writeFileSync(
    path.join(output, "package.json"),
    JSON.stringify({ type: "module" })
  );
  // Preserve imports, matching an unbundled TypeScript -> JavaScript deployment.
  for (const file of [
    "index.ts",
    "vite.config.ts",
    ...["server", "shared", "drizzle", "scripts"].flatMap(sourceFiles),
  ]) {
    const target = path.join(output, file.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText
    );
    emitted.push(target);
  }
});
afterAll(() => {
  if (!output) return;
  const relative = path.relative(path.join(root, "tmp"), path.resolve(output));
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.startsWith("civicfix-esm-")
  )
    throw new Error("Refusing to remove an unexpected ESM test directory.");
  fs.rmSync(output, { recursive: true, force: true });
});

function environment() {
  return {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: "mysql://test:test@127.0.0.1:3306/civicfix_test",
    JWT_SECRET: "dummy-runtime-test-secret-at-least-thirty-two-characters",
    STORAGE_DRIVER: "s3",
    S3_BUCKET: "civicfix-evidence",
    S3_REGION: "ap-northeast-1",
    S3_ENDPOINT: "https://audit-project.storage.supabase.co/storage/v1/s3",
    S3_ACCESS_KEY_ID: "dummy-runtime-access-key",
    S3_SECRET_ACCESS_KEY: "dummy-runtime-secret-key",
    AWS_REQUEST_CHECKSUM_CALCULATION: "WHEN_REQUIRED",
    S3_PUBLIC_URL: "",
    AI_API_KEY: "",
    AI_BASE_URL: "",
    AI_MODEL: "",
    // Never load workspace secrets or contact external services in this test.
    DOTENV_CONFIG_PATH: path.join(output, "missing-test.env"),
    DOTENV_CONFIG_QUIET: "true",
    NODE_OPTIONS: "",
  };
}

describe("backend native ESM resolution", () => {
  it("emits explicit, existing relative imports without backend bundler aliases", () => {
    for (const file of emitted) {
      for (const specifier of imports(file)) {
        expect(specifier, file).not.toMatch(/^@(?:shared|assets)?\//);
        if (!specifier.startsWith(".")) continue;
        expect(specifier, file).toMatch(/\.js$/);
        expect(
          fs.existsSync(path.resolve(path.dirname(file), specifier)),
          `${file} -> ${specifier}`
        ).toBe(true);
      }
    }
  });

  it("loads the emitted Vercel handler in plain Node without a TS loader or bundler", () => {
    const entrypoint = pathToFileURL(path.join(output, "index.js")).href;
    const script = `const { default: app } = await import(${JSON.stringify(entrypoint)}); if (typeof app !== 'function' || process.env.NODE_ENV !== 'production') throw new Error('Invalid serverless entrypoint'); process.stdout.write('native-esm-ok');`;
    expect(
      execFileSync(
        process.execPath,
        ["--input-type=module", "--eval", script],
        {
          cwd: root,
          env: environment(),
          encoding: "utf8",
          timeout: 15000,
        }
      )
    ).toBe("native-esm-ok");
  });

  it("keeps tsx resolving .js source imports and the local Vite development module", () => {
    const appUrl = pathToFileURL(path.join(root, "server/_core/app.ts")).href;
    const viteUrl = pathToFileURL(path.join(root, "server/_core/vite.ts")).href;
    const script = `const { createApp } = await import(${JSON.stringify(appUrl)}); const { setupVite } = await import(${JSON.stringify(viteUrl)}); if (typeof createApp() !== 'function' || typeof setupVite !== 'function') throw new Error('Invalid local development modules'); process.stdout.write('tsx-ok');`;
    expect(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "--eval", script],
        {
          cwd: root,
          env: {
            ...environment(),
            STORAGE_DRIVER: "local",
            TSX_DISABLE_CACHE: "1",
          },
          encoding: "utf8",
          timeout: 15000,
        }
      )
    ).toBe("tsx-ok");
  });
});
