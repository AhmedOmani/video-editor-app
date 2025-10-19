FROM node:18-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p storage

EXPOSE 3000

CMD ["npm", "run", "cluster"]