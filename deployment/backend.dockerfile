FROM eclipse-temurin:21-jre-jammy

ARG APP_VERSION=1.2.0
LABEL org.opencontainers.image.version="${APP_VERSION}"

COPY set-timezone.sh /set-timezone.sh
RUN apt-get update \
    && apt-get install --no-install-recommends -y util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /app appuser \
    && mkdir -p /app/data/pomodoro-sounds \
    && chown -R appuser:appuser /app/data

COPY backend/target/*.jar /app/app.jar
RUN chmod +x /set-timezone.sh \
    && chown appuser:appuser /app/app.jar

ENV APP_JAR_PATH=/app/app.jar
ENV APP_POMODORO_SOUNDS_DIRECTORY=/app/data/pomodoro-sounds
EXPOSE 8080

ENTRYPOINT ["/set-timezone.sh"]
