#!/bin/bash
export PATH="/home/thoth/.nvm/versions/node/v24.16.0/bin:$PATH"
cd /home/thoth/postera-crescam-laude/frontend
exec node ./node_modules/.bin/vite --port 3000 --host 0.0.0.0 2>&1
