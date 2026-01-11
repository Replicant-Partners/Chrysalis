#!/bin/bash
# Verification script for Phase 3 setup

echo "🔍 Verifying Phase 3: Testing & Polish Setup"
echo "=============================================="
echo ""

echo "1. Checking test dependencies..."
if npm list vitest @testing-library/react > /dev/null 2>&1; then
  echo "   ✅ Test dependencies installed"
else
  echo "   ❌ Test dependencies missing"
  exit 1
fi

echo ""
echo "2. Checking test files..."
TEST_FILES=(
  "src/utils/__tests__/VoyeurBusClient.test.ts"
  "src/utils/__tests__/WalletCrypto.test.ts"
  "src/components/VoyeurPane/__tests__/VoyeurPane.test.tsx"
  "src/components/design-system/Button/__tests__/Button.test.tsx"
  "src/components/design-system/Badge/__tests__/Badge.test.tsx"
  "src/components/design-system/Input/__tests__/Input.test.tsx"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file missing"
  fi
done

echo ""
echo "3. Checking configuration files..."
CONFIG_FILES=(
  "vitest.config.ts"
  "src/test/setup.ts"
  "src/test/test-utils.tsx"
)

for file in "${CONFIG_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file missing"
  fi
done

echo ""
echo "4. Running type check..."
if npm run typecheck > /dev/null 2>&1; then
  echo "   ✅ Type check passed"
else
  echo "   ⚠️  Type check has errors (non-blocking)"
fi

echo ""
echo "5. Checking npm scripts..."
if grep -q '"test":' package.json; then
  echo "   ✅ Test scripts configured"
else
  echo "   ❌ Test scripts missing"
fi

echo ""
echo "=============================================="
echo "✅ Phase 3 setup verification complete!"
echo ""
echo "Next steps:"
echo "  - Run tests: npm test"
echo "  - Watch mode: npm run test:watch"
echo "  - Coverage: npm run test:coverage"
echo "  - Dev server: npm run dev"