set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# Run the app
dev:
    bun run dev

# Format check, lint, types, tests, production build
check:
    bun x biome check .
    bun x tsc -b
    bun test
    bun x vite build

# Fix formatting and autofixable lint
fmt:
    bun x biome check --write .

test *args:
    bun test {{args}}
