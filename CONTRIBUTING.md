# Contributing to Crawlith 🚀

First off, thank you for considering contributing to Crawlith! It's people like you that make Crawlith such a great tool.

## Code of Conduct
By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md) (if applicable) and maintain a respectful, welcoming environment.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/Crawlith/crawlith.git
   cd crawlith
   ```
3. **Install dependencies**:
   This project uses npm workspaces. Run:
   ```bash
   npm install
   ```
4. **Build the packages**:
   ```bash
   npm run build
   ```

## Development Workflow

We use a monorepo structure with `plugins`:
- `packages/core`: The core crawling and graph analysis logic.
- `packages/cli`: The CLI interface and commands.
- `packages/server`: The web server/API.
- `packages/web`: The UI dashboard.

To test your CLI changes locally, you can run:
```bash
npm run crawlith -- [command] [options]
# Or link it globally for testing
cd packages/cli
npm link
```

## Submitting Changes

1. Create a new feature branch from `main`: `git checkout -b feature/my-awesome-feature`.
2. Please make sure all tests pass (`npm test`) and code is linted (`npm run lint`).
3. Commit your changes. Use descriptive commit messages.
4. Push your branch to your fork.
5. Open a Pull Request on the main repository.

### Guidelines
- **Small Commits**: Keep your commits small and focused.
- **Explain Why**: In your PR, explain *why* the change is needed, not just *what* it does.
- **Tests**: Include tests for your changes if applicable.

We look forward to reviewing your PR!
