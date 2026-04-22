# Usa una imagen oficial de Node
FROM node:20-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de configuración de npm
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código
COPY . .

# Expone el puerto del backend
EXPOSE 3001

# Comando para iniciar el servidor
CMD ["node", "server.js"]
