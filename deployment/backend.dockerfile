FROM eclipse-temurin:21-jre-jammy

COPY set-timezone.sh /set-timezone.sh
RUN chmod +x /set-timezone.sh \
    && useradd --system --create-home --home-dir /app appuser

COPY backend/target/*.jar app.jar
RUN chown appuser:appuser /app.jar

USER appuser
EXPOSE 8080

ENTRYPOINT ["/set-timezone.sh"]
