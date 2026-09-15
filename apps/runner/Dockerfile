FROM node:20-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src ./src
COPY tsconfig.json ./
RUN npm install --save-dev tsx typescript
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
