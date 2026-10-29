"""Protected demo suite: exactly one passing and one intentionally failing test."""


def test_passing_addition():
    assert 2 + 2 == 4


def test_intentionally_failing():
    # This failure is deliberate. The Quality Lab must report it as FAILED.
    assert "AELIO" == "aelio", "intentional failure for first-run verification"
