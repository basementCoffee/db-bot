#!/bin/bash

# Function to get the commit IDs of commits with a given substring in the commit message
get_commit_ids() {
  local substring=$1

  # Use the `git log` command to get a list of all commits, along with their commit IDs and commit messages
  local commit_list=$(git log --format='%H %s')

  # Initialize an array to store the commit IDs that match the substring
  local matching_commit_ids=()

  # Iterate over the list of commits
  while read -r commit; do
    # Split the commit into an array of parts, using the first space as the delimiter
    IFS=' ' read -ra parts <<< "$commit"

    # The first element in the array is the commit ID, and the rest is the commit message
    local commit_id=${parts[0]}
    local commit_message=${parts[@]:1}

    # Check if the commit message contains the substring
    if [[ "$commit_message" == *"$substring"* ]]; then
      # If it does, add the commit ID to the array of matching commit IDs
      matching_commit_ids+=( "$commit_id" )
    fi
  done <<< "$commit_list"

  # Return the array of matching commit IDs
  echo "${matching_commit_ids[0]}"
}

# Example usage:
substring=$1 || release
commit_ids=$(get_commit_ids "$substring")
#echo "Commit IDs that contain \"$substring\" in the commit message:"
echo "$commit_ids"
