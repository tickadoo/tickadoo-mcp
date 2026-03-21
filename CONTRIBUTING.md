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

Run the local stdio transport:

```bash
node dist/index.js
```

For local HTTP development:

```bash
npm run dev:http
```

## Testing

Run the main checks before opening a pull request:

```bash
npm run build
npm test
npm run e2e:stdio
```

To test against the live hosted MCP endpoint:

```bash
MCP_URL=https://mcp.tickadoo.com/mcp npm run e2e:http
```

## Code Style

- Use TypeScript for application code and tests.
- Keep shared MCP behavior in `src/shared/*`.
- Keep `src/index.ts` and `api/mcp.ts` as thin transport wrappers.
- When changing tool behavior, update tests and user-facing docs in the same pull request.
- Prefer small, focused changes over broad refactors.

## Pull Requests

1. Fork the repo and create a focused branch.
2. Make your change and keep the diff scoped to one task.
3. Run the relevant checks locally.
4. Open a pull request with a clear summary, testing notes, and any user-facing impact.

For MCP-related changes, include example inputs and outputs when that helps reviewers validate behavior quickly.
