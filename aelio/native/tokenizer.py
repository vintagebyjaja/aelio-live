"""AELIO Native byte-level BPE tokenizer, trained from scratch on AELIO datasets.

Byte-level means every possible input is encodable (no unknown tokens).
Merges are learned only from the dataset passed to `train`, so the vocabulary
is AELIO's own.
"""
from __future__ import annotations

import json
import re
from collections import Counter

PRETOKENIZE = re.compile(r"""'s|'t|'re|'ve|'m|'ll|'d| ?[A-Za-z]+| ?[0-9]{1,3}| ?[^\sA-Za-z0-9]+|\s+(?!\S)|\s+""")
EOT = "<|endoftext|>"


class BPETokenizer:
    def __init__(self, merges: list[tuple[int, int]] | None = None):
        self.merges: list[tuple[int, int]] = [tuple(m) for m in (merges or [])]
        self._build()

    def _build(self) -> None:
        self.ranks = {pair: i for i, pair in enumerate(self.merges)}
        self.vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}
        for i, (a, b) in enumerate(self.merges):
            self.vocab[256 + i] = self.vocab[a] + self.vocab[b]
        self.eot_id = 256 + len(self.merges)
        self._cache: dict[str, list[int]] = {}

    @property
    def vocab_size(self) -> int:
        return 256 + len(self.merges) + 1  # + end-of-text

    @classmethod
    def train(cls, text: str, vocab_size: int, max_unique_words: int = 200_000) -> "BPETokenizer":
        n_merges = max(0, vocab_size - 257)
        words = Counter(PRETOKENIZE.findall(text))
        seqs = {w: list(w.encode("utf-8")) for w, _ in words.most_common(max_unique_words)}
        merges: list[tuple[int, int]] = []
        for k in range(n_merges):
            pairs: Counter = Counter()
            for w, s in seqs.items():
                c = words[w]
                for a, b in zip(s, s[1:]):
                    pairs[(a, b)] += c
            if not pairs:
                break
            best, cnt = pairs.most_common(1)[0]
            if cnt < 2:
                break
            new = 256 + k
            merges.append(best)
            for w, s in seqs.items():
                if len(s) < 2:
                    continue
                out, i = [], 0
                while i < len(s):
                    if i < len(s) - 1 and s[i] == best[0] and s[i + 1] == best[1]:
                        out.append(new)
                        i += 2
                    else:
                        out.append(s[i])
                        i += 1
                seqs[w] = out
        return cls(merges)

    def _encode_chunk(self, chunk: str) -> list[int]:
        if chunk in self._cache:
            return self._cache[chunk]
        s = list(chunk.encode("utf-8"))
        while len(s) >= 2:
            best_rank, best_i = None, -1
            for i in range(len(s) - 1):
                r = self.ranks.get((s[i], s[i + 1]))
                if r is not None and (best_rank is None or r < best_rank):
                    best_rank, best_i = r, i
            if best_rank is None:
                break
            s = s[:best_i] + [256 + best_rank] + s[best_i + 2:]
        if len(self._cache) < 100_000:
            self._cache[chunk] = s
        return s

    def encode(self, text: str) -> list[int]:
        out: list[int] = []
        for chunk in PRETOKENIZE.findall(text):
            out.extend(self._encode_chunk(chunk))
        return out

    def decode(self, ids: list[int]) -> str:
        return b"".join(self.vocab.get(i, b"") for i in ids if i != self.eot_id).decode("utf-8", errors="replace")

    def to_json(self) -> str:
        return json.dumps({"type": "aelio-byte-bpe", "merges": self.merges})

    @classmethod
    def from_json(cls, s: str) -> "BPETokenizer":
        return cls([tuple(m) for m in json.loads(s)["merges"]])
