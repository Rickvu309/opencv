#!/bin/sh
# Vercel Ignored Build Step: exit 0 skip, exit 1 build.
if git diff --quiet HEAD^ HEAD -- packages/opath-ui src/ui src/features .storybook src/styles package.json package-lock.json vercel.json 2>/dev/null; then
  echo "Storybook paths unchanged — skip"
  exit 0
fi
echo "Storybook paths changed — build"
exit 1
