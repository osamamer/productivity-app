mvn clean install
docker build . -f deployment/backend.dockerfile -t productivity-app:SNAPSHOT