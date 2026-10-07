FROM eclipse-temurin:21-jdk-jammy AS build

ARG APP_VERSION=1.2.0

WORKDIR /workspace

COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn ./.mvn
RUN chmod +x mvnw

COPY backend/src ./src
RUN ./mvnw -B clean package -DskipTests "-Drevision=${APP_VERSION}"

FROM eclipse-temurin:21-jre-jammy

ARG APP_VERSION=1.2.0
LABEL org.opencontainers.image.version="${APP_VERSION}"

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /app appuser \
    && mkdir -p /var/lib/claritard/pomodoro-sounds \
    && chown -R appuser:appuser /var/lib/claritard

WORKDIR /app
COPY deployment/set-timezone.sh /usr/local/bin/set-timezone.sh
COPY --from=build /workspace/target/*.jar /app/app.jar
RUN chmod +x /usr/local/bin/set-timezone.sh \
    && chown -R appuser:appuser /app

ENV APP_JAR_PATH=/app/app.jar
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/set-timezone.sh"]
