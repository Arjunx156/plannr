set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# Run the app
dev:
    bun run dev

# Format check, lint, types, file sizes and import cycles, duplicated code, tests, production build
check:
    bun x biome check .
    bun x tsc -b
    bun scripts/structure.ts
    bun x jscpd@4.3.0 src server scripts --silent
    bun test
    bun x vite build

# Fix formatting and autofixable lint
fmt:
    bun x biome check --write .

test *args:
    bun test {{args}}

# Score the AI against real cases in four languages (calls Gemini; needs GEMINI_API_KEY)
eval:
    bun run ai:eval

# Browser journeys and accessibility checks against the production build
e2e *args:
    bun x playwright test {{args}}
