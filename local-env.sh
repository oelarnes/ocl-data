#!/bin/bash
mkdir -p data
mkdir -p google-auth
export PATH="./node_modules/.bin:${PATH}"
export SQLITE3="./data/ocl-data-dev.db"
touch $SQLITE3