FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --ignore-scripts || npm install --ignore-scripts
COPY apps/api ./apps/api
EXPOSE 4021
ENV NODE_ENV=production
CMD ["node", "apps/api/src/server.js"]
