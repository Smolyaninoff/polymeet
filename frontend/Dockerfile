# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Ключ JavaScript API Яндекс Карт попадает в сборку (переменные VITE_* встраиваются в бандл)
ARG VITE_YMAPS_API_KEY=""
ENV VITE_YMAPS_API_KEY=$VITE_YMAPS_API_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
