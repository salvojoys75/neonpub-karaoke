#!/usr/bin/env python3

import asyncio
import websockets
import json
import sys

async def test_websocket_connection():
    """Test WebSocket connection to the NeonPub server"""
    
    # Use the pub code from our backend test
    pub_code = "D1B55823"
    ws_url = "wss://karaokehub-5.preview.emergentagent.com/ws/" + pub_code
    
    print(f"🔌 Testing WebSocket connection to: {ws_url}")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket connection established!")
            
            # Send ping to test connection
            await websocket.send("ping")
            print("📤 Sent ping message")
            
            # Wait for pong response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            if response == "pong":
                print("✅ Received pong response - connection is working!")
            else:
                print(f"📥 Received: {response}")
            
            # Keep connection alive for a few seconds to test
            print("⏳ Keeping connection alive for 10 seconds...")
            
            # Send periodic pings
            for i in range(3):
                await asyncio.sleep(3)
                await websocket.send("ping")
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    print(f"✅ Ping {i+1}: {response}")
                except asyncio.TimeoutError:
                    print(f"⚠️ Ping {i+1}: No response (timeout)")
            
            print("✅ WebSocket test completed successfully!")
            return True
            
    except websockets.exceptions.ConnectionClosed as e:
        print(f"❌ WebSocket connection closed: {e}")
        return False
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False

async def main():
    """Main test function"""
    print("=== WebSocket Connection Test ===")
    
    success = await test_websocket_connection()
    
    if success:
        print("🎉 WebSocket functionality is working!")
        return 0
    else:
        print("💥 WebSocket functionality has issues!")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))