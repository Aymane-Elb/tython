FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

COPY client/ ./client/
RUN npm run build -w client

FROM nginx:stable-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
