FROM openjdk:17-ea-3-jdk-slim-buster
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
