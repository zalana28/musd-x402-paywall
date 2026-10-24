FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN npm ci --ignore-scripts || npm install --ignore-scripts
COPY apps ./apps
# NEXT_PUBLIC_* are baked at build time — pass them as --build-arg (see docker-compose.yml)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RPC_URL=https://rpc.test.mezo.org
ARG NEXT_PUBLIC_MUSD_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
ARG NEXT_PUBLIC_SELLER_ADDRESS=0x2d31C9d84812E009A362C8caE6F3F3e17E5C78b9
ARG NEXT_PUBLIC_NETWORK=eip155:31611
ARG NEXT_PUBLIC_EXPLORER=https://explorer.test.mezo.org
ARG NEXT_PUBLIC_FACILITATOR=https://facilitator.vativ.io
ARG NEXT_PUBLIC_SETTLEMENT_PROXY=0x402085c248EeA27D92E8b30b2C58ed07f9E20001
ARG NEXT_PUBLIC_MEZO_ADDRESS
ARG NEXT_PUBLIC_DEMO_SPONSOR=true
RUN npm run build --workspace apps/web
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm","start","--workspace","apps/web","--","-p","3000"]
