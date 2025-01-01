FROM node:lts-alpine AS prebuild
WORKDIR /usr/src/app
RUN wget https://gitlab.com/api/v4/projects/5024297/packages/generic/pdftk-java/v3.3.3/pdftk-all.jar
RUN apk add openjdk11-jre

FROM node:lts-alpine AS build
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent 
COPY . .
RUN npm run build

FROM prebuild AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY --from=build /usr/src/app/dist ./dist
COPY ./forms ./forms
# RUN chown -R node /usr/src/app
# USER node
CMD ["npm", "start"]
