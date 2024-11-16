FROM node:lts-alpine AS build
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent 
COPY . .
RUN npm run build

FROM node:lts-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
