FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ dist/
COPY public/ public/
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/index.js"]
