#!/bin/bash
# Start both server and worker concurrently

echo "Starting OverDrive AI Agent..."
echo "Server running on http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start server and worker in parallel
node server.js &
SERVER_PID=$!

# Give server time to initialize
sleep 2

# Start worker
node -e "const {initAllEngines,getEngines}=require('./agent-db');const {startWorker}=require('./task-worker');(async()=>{await initAllEngines();await startWorker(0);})();" &
WORKER_PID=$!

# Handle shutdown
trap "kill $SERVER_PID $WORKER_PID" EXIT

# Wait for processes
wait
