# Contributing

Thanks for your interest in contributing to `tickadoo-mcp`.

This is an official tickadoo project and is released under the MIT license.

## Local Development

Clone the repo, install dependencies, and build the server:

```bash
git clone https://github.com/tickadoo/tickadoo-mcp.git
cd tickadoo-mcp
npm install
npm run build
```

Run the built stdio bridge:

```bash
node dist/index.js
```

Or run it straight from source during development:

```bash
npm run dev
```

Point the bridge at a local remote (e.g. a howard worker running locally) with `TICKADOO_MCP_URL`:

```bash
TICKADOO_MCP_URL=http://127.0.0.1:8787/mcp npm run dev
```

## Testing

Run the main checks before opening a pull request:

```bash
npm run build
npm test
```

To exercise the bridge against the live hosted MCP endpoint:

```bash
LIVE=1 npm test
```

## Code Style

- Use TypeScript for application code and tests.
- This package is a **thin remote bridge** (since v2.0.0): tools, schemas, and results are owned by the canonical remote server in the howard repo. Keep `src/index.ts`/`src/bridge.ts` as thin transport wrappers — do not reintroduce local tool definitions here.
- When changing bridge behavior, update tests and user-facing docs in the same pull request.
- Prefer small, focused changes over broad refactors.

## Pull Requests

1. Fork the repo and create a focused branch.
2. Make your change and keep the diff scoped to one task.
3. Run the relevant checks locally.
4. Open a pull request with a clear summary, testing notes, and any user-facing impact.

For MCP-related changes, include example inputs and outputs when that helps reviewers validate behavior quickly.
