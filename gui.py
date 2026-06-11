import os
import sys
import time
import threading
import uvicorn
import webview

# Add workspace directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend import app, bot

class WebServer(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = True
        # Set host to 127.0.0.1 to avoid Windows Firewall alerts
        config = uvicorn.Config(app, host="127.0.0.1", port=8282, log_level="warning")
        self.server = uvicorn.Server(config)
        
    def run(self):
        self.server.run()
        
    def stop(self):
        self.server.should_exit = True

def main():
    # Start FastAPI Server in background thread
    server_thread = WebServer()
    server_thread.start()
    
    # Wait for the backend server to start up
    time.sleep(1.5)
    
    # Create the native desktop window using Edge WebView2 (Chromium)
    window = webview.create_window(
        title="Bitkub Mini Bot",
        url="http://127.0.0.1:8282",
        width=1280,
        height=800,
        min_size=(1024, 768),
        resizable=True
    )
    
    def on_closed():
        print("Closing window. Stopping background services...")
        # Stop uvicorn
        server_thread.stop()
        
        # Stop trading bot runner engine threads
        try:
            if bot:
                bot.stop()
        except Exception as e:
            print(f"Error stopping bot runner: {e}")
            
    # Attach closed handler to shut down background server cleanly
    window.events.closed += on_closed
    
    # Launch desktop application GUI
    webview.start()

if __name__ == '__main__':
    main()
