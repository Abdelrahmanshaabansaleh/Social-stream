# Use official Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy all source files
COPY . .

# Build both React frontend and Express server
RUN npm run build

# Hugging Face Spaces runs on port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Start the Express server
CMD ["npm", "run", "start"]
