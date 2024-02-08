#!/usr/bin/env bash

GIT_DIR=$(git rev-parse --git-dir)

echo "Installing hooks..."
# this command creates symlink to our pre-commit script
ln -s -f ../../scripts/commit-msg.bash $GIT_DIR/hooks/commit-msg
echo "Done"!
