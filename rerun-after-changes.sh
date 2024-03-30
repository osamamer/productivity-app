#!/bin/bash
docker-compose down
./build-docker-image.sh
docker-compose up -d
cd frontend/
npm run build
