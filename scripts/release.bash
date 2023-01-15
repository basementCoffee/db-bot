#npx eslint src/ --fix
npm i --package-lock-only
git add package*
git status
echo "release commit template => git commit -m \"chore(release): \""
