import os
import shutil
import subprocess
import sys

def build_frontend():
    print("--- 1. Building Frontend (Next.js Static Export) ---")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    
    # Ensure node_modules exists
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        print("Installing frontend dependencies...")
        subprocess.run("npm install", shell=True, cwd=frontend_dir, check=True)
        
    # Run Next.js static export build
    # Set NEXT_BUILD_EXPORT=true environment variable
    env = os.environ.copy()
    env["NEXT_BUILD_EXPORT"] = "true"
    
    print("Running npm run build...")
    subprocess.run("npm run build", shell=True, env=env, cwd=frontend_dir, check=True)
    
    out_dir = os.path.join(frontend_dir, "out")
    if not os.path.exists(out_dir):
        raise RuntimeError("Next.js build did not produce an 'out' folder!")
    print(f"Frontend built successfully at {out_dir}")

def build_exe():
    print("--- 2. Packaging Standalone Application using PyInstaller ---")
    # Ensure pywebview and pyinstaller are installed in Python runtime
    try:
        import webview
    except ImportError:
        print("Installing pywebview...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pywebview"], check=True)
        
    try:
        import PyInstaller
    except ImportError:
        print("Installing pyinstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
        
    # Clean previous build directories
    for folder in ["build", "dist"]:
        if os.path.exists(folder):
            print(f"Cleaning {folder}...")
            # Use retry loop in case files are locked
            for _ in range(3):
                try:
                    shutil.rmtree(folder)
                    break
                except Exception:
                    import time
                    time.sleep(1)
            
    # PyInstaller arguments
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onedir",       # Pack as folder directory (fast startup)
        "--windowed",     # No command prompt console window
        "--name=BitkubMiniBot",
        "--add-data=frontend/out;frontend/out",
        "--add-data=strategies;strategies",
        "--collect-submodules=strategies",
        "gui.py"
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    
    # Copy .env config file and other templates to dist folder if they exist
    dist_dir = os.path.join(os.getcwd(), "dist", "BitkubMiniBot")
    if os.path.exists(".env"):
        print("Copying .env file to release folder...")
        shutil.copy(".env", os.path.join(dist_dir, ".env"))
    elif os.path.exists(".env.example"):
        print("Copying .env.example as .env to release folder...")
        shutil.copy(".env.example", os.path.join(dist_dir, ".env"))

    if os.path.exists(".env.example"):
        shutil.copy(".env.example", os.path.join(dist_dir, ".env.example"))
        shutil.copy(".env.example", os.path.join(os.getcwd(), "dist", ".env.example"))

    if os.path.exists("README.md"):
        print("Copying README files to release folder...")
        shutil.copy("README.md", os.path.join(dist_dir, "README.md"))
        shutil.copy("README.md", os.path.join(dist_dir, "README.txt"))
        shutil.copy("README.md", os.path.join(os.getcwd(), "dist", "README.md"))
        shutil.copy("README.md", os.path.join(os.getcwd(), "dist", "README.txt"))
        
    print("\n--- Build Complete ---")
    print(f"Standalone application folder is available at: {dist_dir}")
    print("You can double-click 'BitkubMiniBot.exe' to launch the program!")

if __name__ == "__main__":
    try:
        build_frontend()
        build_exe()
    except Exception as e:
        print(f"\n❌ Build Failed: {e}", file=sys.stderr)
        sys.exit(1)
