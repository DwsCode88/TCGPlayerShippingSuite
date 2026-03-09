#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Next.js dev server not running on localhost:3000"
  echo "   Run: npm run dev"
  exit 1
fi

if ! curl -s http://localhost:9099 > /dev/null 2>&1; then
  echo "❌ Firebase Auth emulator not running on localhost:9099"
  echo "   Run: firebase emulators:start --only auth,firestore"
  exit 1
fi

if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo "❌ Firebase Firestore emulator not running on localhost:8080"
  echo "   Run: firebase emulators:start --only auth,firestore"
  exit 1
fi

echo "✅ All prerequisites running"
echo ""

# Find Python
PYTHON=""
for candidate in python python3 "/c/Users/RC/AppData/Local/Programs/Python/Python314/python.exe"; do
  if command -v "$candidate" &> /dev/null && "$candidate" --version &> /dev/null; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ Python not found. Install Python 3.11+ and add to PATH."
  exit 1
fi

echo "Using Python: $($PYTHON --version)"
echo ""

# Run tests
cd "$SCRIPT_DIR"
"$PYTHON" -m pytest "$@" -v --tb=short
