FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . ./
COPY --from=build /app/dist ./dist
RUN mkdir -p data/institutional data/marketing data/insights scripts
EXPOSE 8000
CMD ["node", "dist/index.js"]

