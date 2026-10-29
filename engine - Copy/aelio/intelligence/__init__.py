"""AELIO Intelligence Gateway: provider-independent access to language models.

Product code calls gateway.run()/collect() with a GenRequest. Providers live in
providers.py (OpenAI Responses API, AELIO Native, offline test provider).
AELIO Native training (aelio/native, native/) never reads from this package.
"""
