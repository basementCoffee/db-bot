#!/bin/bash

echo "compiling js..."
tsc
echo "running pm2 script..."
NAME=${1:-vibe}

if pm2 restart $NAME ; then
  pm2 reset $NAME
  echo restarted $NAME
else
  pm2 start ./dist/index.js --name $NAME
fi

node ./scripts/pm2-monitor.js $NAME
