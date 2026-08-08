#!/bin/bash

# NHRC Hybrid RAG - Setup and Run Script

echo ""
echo "======================================"
echo "NHRC Hybrid RAG - Auto Setup & Run"
echo "======================================"
echo ""

# Change to project directory
cd "$(dirname "$0")" || exit

echo "📊 Checking index..."
if [ ! -f "data/nhrc_index.json" ]; then
    echo "❌ Index not found. Creating..."
    python setup_obsidian_index.py
fi

echo ""
echo "📦 Setting up web app..."
cd web || exit

if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi

echo ""
echo "======================================"
echo "🚀 Starting development server..."
echo "======================================"
echo ""
echo "Website will be available at:"
echo "  🔍 Search:    http://localhost:3000/knowledge/search"
echo "  📊 Dashboard: http://localhost:3000/knowledge/dashboard"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
