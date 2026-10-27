# AELIO Voice: the path from identities to real voices

The six identities (GROOVE, NOVA, SOL, SAGE, ECHO, AURA) are registered with stable IDs (`aelio-voice-groove`, …). Groove Guide and other apps can list them now through `GET /v1/voices` (scope `voices:read`). Synthesis returns **409 awaiting_training** until a voice has an approved native speech checkpoint. Groove Guide hasn't been modified.

## To give each voice a real, owned sound
1. **Voice performer agreements.** Each voice needs a real person whose voice it's based on. Get a written agreement granting Grooveville LLC rights to train and commercially use a synthetic voice, with consent, compensation and revocation terms. Don't imitate celebrities or existing voices.
2. **Recording.** Aim for 2–20 hours of clean studio speech per voice (24 kHz+, quiet room), with scripts covering navigation phrases, numbers, street names and conversation. Register the audio as a `speech` dataset with license `Grooveville-Owned` and the agreement reference in the provenance.
3. **Milestone C: native speech prototype.** Train a small text-to-speech model from scratch on one voice (GPU required). Measure intelligibility with listener transcription and real-time factor.
4. **Approval.** Attach the checkpoint to the voice, review samples in Voice Lab, and approve with fresh MFA. Only then does `/v1/voices/{id}/synthesize` return audio.
