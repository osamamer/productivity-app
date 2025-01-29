FROM openjdk:17-ea-3-jdk-slim-buster

# Copy a script that will determine the GMT offset
COPY ./set-timezone.sh /set-timezone.sh
RUN chmod +x /set-timezone.sh

COPY target/*.jar app.jar

# Use the script to set the timezone at runtime
ENTRYPOINT ["/set-timezone.sh"]