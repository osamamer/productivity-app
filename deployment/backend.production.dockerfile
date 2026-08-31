FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace

COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn ./.mvn
RUN chmod +x mvnw

COPY backend/src ./src
RUN ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /app appuser

WORKDIR /app
COPY deployment/set-timezone.sh /usr/local/bin/set-timezone.sh
COPY --from=build /workspace/target/*.jar /app/app.jar
RUN chmod +x /usr/local/bin/set-timezone.sh \
    && chown -R appuser:appuser /app

USER appuser
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/set-timezone.sh"]
