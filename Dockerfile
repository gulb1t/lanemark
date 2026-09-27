# One image serves the API and the built site. The server runs TypeScript directly and uses node:sqlite, so it
# needs a current Node; 26 is what SwimTrack is developed and tested on.
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
# The server shares the curriculum and a few helpers with the frontend.
COPY --from=build /app/src ./src
EXPOSE 8080
CMD ["node", "server/index.ts"]
