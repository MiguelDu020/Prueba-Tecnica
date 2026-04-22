# Etapa de construcción
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Construye la aplicación React/Vite para producción
RUN npm run build

# Etapa de servidor web (Nginx)
FROM nginx:alpine

# Copia los archivos estáticos construidos al directorio de nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia la configuración de Nginx con el proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Se usa la configuración por defecto de Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
