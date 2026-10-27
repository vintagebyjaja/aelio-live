import numpy as np
import pytest

from aelio.native.tokenizer import BPETokenizer
from aelio.native.transformer import Config, Model


def test_gradients_match_numerical():
    cfg = Config(vocab_size=11, n_layer=2, n_head=2, n_embd=8, block_size=6, seed=0)
    m = Model(cfg)
    m.p = {k: v.astype(np.float64) for k, v in m.p.items()}
    rng = np.random.default_rng(1)
    for k in m.p:
        m.p[k] += rng.normal(0, 0.1, m.p[k].shape)
    x, y = rng.integers(0, 11, (3, 6)), rng.integers(0, 11, (3, 6))
    m.forward(x, y, train=True)
    g = m.backward()
    worst = 0.0
    for k, w in m.p.items():
        for _ in range(2):
            i = tuple(rng.integers(0, s) for s in w.shape)
            o = w[i]
            w[i] = o + 1e-5; a = m.forward(x, y)[1]
            w[i] = o - 1e-5; b = m.forward(x, y)[1]
            w[i] = o
            num = (a - b) / 2e-5
            worst = max(worst, abs(num - g[k][i]) / max(1e-8, abs(num) + abs(g[k][i])))
    assert worst < 1e-4


def test_tokenizer_roundtrip_and_learns_merges():
    text = "the quick brown fox jumps over the lazy dog. " * 50 + "naïve café ✓"
    tok = BPETokenizer.train(text, 300)
    assert len(tok.merges) > 10
    s = "the lazy fox ✓ café"
    assert tok.decode(tok.encode(s)) == s
    assert BPETokenizer.from_json(tok.to_json()).encode(s) == tok.encode(s)


def test_training_reduces_loss_and_checkpoint_roundtrip(tmp_path):
    from aelio.native.transformer import AdamW
    cfg = Config(vocab_size=20, n_layer=1, n_head=2, n_embd=16, block_size=8, seed=3)
    m = Model(cfg)
    seq = np.tile(np.arange(10), 50)
    opt = AdamW(m.p, lr=1e-2)
    x = np.stack([seq[i:i + 8] for i in range(0, 64, 4)]); y = np.stack([seq[i + 1:i + 9] for i in range(0, 64, 4)])
    first = m.forward(x, y)[1]
    for _ in range(60):
        m.forward(x, y, train=True); opt.step(m.p, m.backward())
    assert m.forward(x, y)[1] < first * 0.5
    m.save(str(tmp_path / "c.npz"))
    m2, meta = Model.load(str(tmp_path / "c.npz"))
    assert meta["external_weights"] is False
    assert np.allclose(m2.forward(x)[0], m.forward(x)[0])


def test_loader_rejects_foreign_checkpoints(tmp_path):
    np.savez(tmp_path / "x.npz", wte=np.zeros((2, 2)))
    with pytest.raises(Exception):
        Model.load(str(tmp_path / "x.npz"))


def test_external_ai_output_never_training_eligible(env):
    from aelio.native import datasets
    row = datasets.ingest_text("x", "text", "MIT", "test", "hello world line\n" * 200, "external-ai-output", "t")
    assert row["training_eligible"] == 0
    row = datasets.ingest_text("y", "text", "Proprietary-Unknown", "test", "hello world line\n" * 200, "licensed-corpus", "t")
    assert row["training_eligible"] == 0
    row = datasets.ingest_text("z", "text", "MIT", "test", "hello world line\n" * 200, "licensed-corpus", "t")
    assert row["training_eligible"] == 1
