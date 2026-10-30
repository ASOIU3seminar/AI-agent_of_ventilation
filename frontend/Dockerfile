FROM nginx:alpine
RUN printf 'server {\n    listen 80;\n    root /usr/share/nginx/html;\n    index index.html;\n    add_header Cache-Control "no-store, no-cache, must-revalidate";\n    location / {\n        try_files $uri$uri/ /index.html;\n    }\n}\n' > /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]