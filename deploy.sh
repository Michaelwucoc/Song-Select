#!/bin/bash

# Check if .git exists, if not, initialize repository
if [ ! -d ".git" ]; then
    git init
    git remote add origin https://github.com/Michaelwucoc/Song-Select.git
    git fetch origin main
    git checkout -b main
    git branch --set-upstream-to=origin/main main
fi

# Pull latest code
git fetch origin main

# Get changed files list
changed_files=$(git diff --name-only origin/main)

# Exit if no changes
if [ -z "$changed_files" ]; then
    echo "No files need to be updated"
    exit 0
fi

# Backup database if exists
if [ -f "database.sqlite" ]; then
    cp database.sqlite database.sqlite.bak
fi

# Apply changes
git merge origin/main

# Reinstall dependencies if package.json changed
if echo "$changed_files" | grep -q "package.json"; then
    npm install
fi

# Rebuild frontend if src files changed
if echo "$changed_files" | grep -q "src/"; then
    npm run build
fi

# Restart service
pm2 restart song-select

echo "Deployment completed"