#!/bin/sh
# Vercel Ignored Build Step for Opath (Lab): exit 0 skip, exit 1 build.
if git diff --quiet HEAD^ HEAD -- packages/opath-ui packages/opath-ui/.storybook vercel.lab.json package.json package-lock.json 2>/dev/null; then
  echo "Lab Storybook paths unchanged — skip"
  exit 0
fi
echo "Lab Storybook paths changed — build"
exit 1
