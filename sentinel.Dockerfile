FROM node:9
WORKDIR /backend
COPY ./ /backend
RUN npm install
CMD [ "node", "sentinel.js" ]
