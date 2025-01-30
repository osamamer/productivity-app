FROM openjdk:17-ea-3-jdk-slim-buster

COPY set-timezone.sh /set-timezone.sh
RUN chmod +x /set-timezone.sh

COPY target/*.jar app.jar

# Expose both HTTP and WebSocket ports
EXPOSE 8080

ENTRYPOINT ["/set-timezone.sh"]