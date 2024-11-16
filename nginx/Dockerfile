FROM nginx:latest

RUN rm /etc/nginx/conf.d/default.conf
COPY ./html/ /var/www/rodiservice/
COPY ./rodiservice /etc/nginx/conf.d/rodiservice.conf