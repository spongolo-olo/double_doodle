#!/bin/bash
# Start our custom no-cache HTTP server on port 8003 in the background
cd /workspace/double_doodle
# Kill any existing server running on port 8003
pkill -f "python3 -m http.server 8003"
pkill -f "python3 server.py"
nohup python3 server.py > game_server.log 2>&1 &
echo "Double Doodle server started on port 8003 with zero browser caching"
