# @crawlith/architecture-infrastructure 🧱

> **Base layers and shared utilities for the Crawlith architecture.**

`@crawlith/architecture-infrastructure` provides the underlying components and types that unify the different parts of the **Crawlith** monorepo. It ensures that the [core](../core), [cli](../cli), and [server](../server) share a common foundation for diagnostics, configuration, and structural types.

---

## ✨ Features

- **🚩 Shared Types**: Base interfaces for crawl results and engine events.
- **🛠 Utility Functions**: Common pathing, logging, and error handling across packages.
- **🏗 System Architecture**: Defines global constraints and shared workspace patterns.
- **🔍 Diagnostics**: Tools for monitoring engine performance and resource usage.

---

## 🛠 Usage within Workspace

This package is intended as an **internal** dependency for the Crawlith workspace and is not recommended for external use on its own. It allows us to add new packages (like a desktop app or different exporters) without re-implementing core infrastructure logic.

---

## 🛡 License

Apache License 2.0 © [Crawlith](https://github.com/Crawlith)
