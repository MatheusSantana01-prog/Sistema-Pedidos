"""Compatibility entrypoint.

The backend implementation lives in ``backend/main.py``.  This thin module
keeps existing commands such as ``uvicorn main:app`` and tests that import
``main`` working without maintaining two copies of the API.
"""

import sys

from backend import main as _backend_main

sys.modules[__name__] = _backend_main
