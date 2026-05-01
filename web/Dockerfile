FROM node:alpine

WORKDIR /home/web

ENV PS1="[web:\W]\$ "

# descomentar esto si uso dependencias !!!
# COPY package*.json ./
# RUN npm install

COPY . .

EXPOSE 3000

CMD [ "bash" ]