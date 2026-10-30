# Beacon on a Hugging Face Docker Space: Node 22, pnpm through corepack, rules snapshot read at
# build time (fails soft), Next.js served on port 7860 as user 1000 (HF requirement).
FROM node:22-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1 \
    PORT=7860 \
    LANGSMITH_HIDE_INPUTS=true \
    LANGSMITH_HIDE_OUTPUTS=true \
    HOSTNAME=0.0.0.0 \
    COREPACK_HOME=/home/node/.cache/corepack \
    PNPM_HOME=/home/node/.local/share/pnpm

# The node image already has user "node" with uid 1000, which is the uid Spaces run as.
WORKDIR /app
RUN corepack enable && chown node:node /app
USER node

# Install from the lockfile only (dev dependencies too: the build needs them).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node packages/rules/package.json packages/rules/
COPY --chown=node:node packages/brain/package.json packages/brain/
COPY --chown=node:node packages/evals/package.json packages/evals/
RUN pnpm install --frozen-lockfile --prod=false

COPY --chown=node:node . .

# Fresh GOV.UK pages when the build can reach them; otherwise the committed snapshot stays.
RUN pnpm snapshot || echo "warning: rules snapshot skipped, using the committed one"

RUN pnpm --filter web build

EXPOSE 7860
WORKDIR /app/apps/web
CMD ["pnpm", "exec", "next", "start", "-p", "7860", "-H", "0.0.0.0"]
