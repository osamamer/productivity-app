FROM openjdk:17-ea-3-jdk-slim-buster

COPY set-timezone.sh /set-timezone.sh
RUN chmod +x /set-timezone.sh

COPY target/*.jar app.jar
RUN apt-get update && apt-get install -y netcat
# Expose both HTTP and WebSocket ports
EXPOSE 8080
EXPOSE 80
EXPOSE 443

ENTRYPOINT ["/set-timezone.sh"]