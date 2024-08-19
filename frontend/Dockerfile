# Use the official Node image as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages
RUN npm install

# Build the React app
RUN npm run build

# Use an NGINX image to serve the React app
FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html

# Expose the port on which the app will run
EXPOSE 80

# Command to start the NGINX server
CMD ["nginx", "-g", "daemon off;"]
