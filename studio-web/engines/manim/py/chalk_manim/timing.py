"""Integer-frame timing. Every animation gets run_time = frames / fps, and the frames
of a scene sum exactly to totalFrames, so there is no float drift between beats."""


def allocate(total, weights, minimum=1):
    """Split `total` frames over `weights` with the largest-remainder method.

    Returns a list of ints summing to `total` exactly, each >= `minimum` when possible.
    """
    n = len(weights)
    if n == 0:
        return []
    total = int(total)
    minimum = min(int(minimum), total // n) if total >= n else 0
    spare = total - minimum * n
    weights = [max(float(w), 0.0) for w in weights]
    s = sum(weights) or float(n)
    if sum(weights) == 0:
        weights = [1.0] * n
    raw = [spare * w / s for w in weights]
    base = [int(r) for r in raw]
    order = sorted(range(n), key=lambda i: raw[i] - base[i], reverse=True)
    for i in order[: spare - sum(base)]:
        base[i] += 1
    return [minimum + b for b in base]


class Budget:
    """Frame budget for one scene. play()/hold() consume frames; fill() burns the rest."""

    def __init__(self, scene, total_frames, fps=30):
        self.scene = scene
        self.fps = fps
        self.total = int(total_frames)
        self.used = 0

    @property
    def remaining(self):
        return self.total - self.used

    def play(self, *animations, frames):
        frames = max(1, min(int(frames), self.remaining))
        if self.remaining <= 0:
            return
        self.scene.play(*animations, run_time=frames / self.fps)
        self.used += frames

    def hold(self, frames):
        frames = min(int(frames), self.remaining)
        if frames < 1:
            return
        self.scene.wait(frames / self.fps)
        self.used += frames

    def fill(self):
        """Hold on the final image for whatever is left (beat-end 'hold')."""
        self.hold(self.remaining)
