# Syntax: docker/dockerfile:1

# 1. Base stage: install dependencies with pinned lockfile
FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Development stage: run Vite dev server on port 5173
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# 3. Build stage: type-check and build production bundle
FROM base AS build
COPY . .
RUN npm run build

# 4. Production stage: serve static files with Nginx
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
