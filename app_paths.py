import sys
from pathlib import Path


def get_app_dir():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def get_data_path(filename):
    return get_app_dir() / filename


def get_bundled_path(*parts):
    base_dir = Path(getattr(sys, "_MEIPASS", get_app_dir()))
    return base_dir.joinpath(*parts)
