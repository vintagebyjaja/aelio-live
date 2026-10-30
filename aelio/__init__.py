"""Compatibility entry point. The maintained engine implementation lives in engine/aelio.
Public /aelio/ marketing assets remain unchanged; historical Python copies are not imported.
"""
from pathlib import Path
__path__ = [str(Path(__file__).resolve().parent.parent / 'engine' / 'aelio')]
