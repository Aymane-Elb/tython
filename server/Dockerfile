FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev --workspace=server

COPY --chown=node:node server/src/ ./server/src/

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

USER node
EXPOSE 3001

CMD ["npm", "start", "-w", "server"]
