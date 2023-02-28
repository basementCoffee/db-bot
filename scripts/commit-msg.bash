#!/usr/bin/env bash

commit_msg_file=$1

release_check=$(grep -i "release" $commit_msg_file)

echo "Running commit hook"
if [ -n "$release_check" ]; then
  bash scripts/tests/test-release.bash
  # $? stores exit value of the last command
  if [ $? -ne 0 ]; then
   echo "Tests must pass before commit! (try fixing the above errors)"
   git restore --staged package*
   exit 1
  fi
fi

echo "Tests passed!"
