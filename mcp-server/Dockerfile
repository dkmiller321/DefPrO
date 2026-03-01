FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

CMD ["node", "dist/index.js"]
