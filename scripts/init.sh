#!/bin/bash
# =============================================================================
# Initialize devports- Development setup
# =============================================================================
# Use this for local development. For normal usage, just run: npm install -g devports
# =============================================================================

set -e

echo "🚀 Setting up devports for development..."
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from the devports project directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Link globally for testing
echo "🔗 Linking globally..."
npm link

echo ""
echo "✅ devports is now set up for development!"
echo ""
echo "🧪 Test it:"
echo "   devports --version"
echo "   devports --help"
echo ""
echo "🎯 Try it out:"
echo "   devports allocate test postgres --type postgres"
echo "   devports list"
echo "   devports release test postgres"
echo ""
echo "📝 Development workflow:"
echo "   npm run dev          # Watch mode for development"
echo "   npm test             # Run tests"
echo "   npm run build        # Build for distribution"
echo ""
echo "📚 Documentation:"
echo "   README.md                 # User guide"
echo "   AI-ASSISTANT-GUIDE.md     # For AI coding tools"
echo "   QUICKSTART.md             # Quick reference"
echo ""
echo "🚀 To publish:"
echo "   npm version patch    # Bump version"
echo "   npm publish          # Publish to npm"
