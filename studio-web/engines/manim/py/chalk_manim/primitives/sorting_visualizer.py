"""manim-sorting-visualizer: Divide-and-conquer sorting algorithm visualization."""

from manim import (
    FadeIn,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
)

from ..common import clean, info_badge, run_stage, stage_frames, title_text


def run(scene, theme, brief, budget, beat_frames):
    title = clean(brief.get("title") or "Algorithm Visualizer: QuickSort Partitioning", 60)
    raw_arr = brief.get("array")
    if isinstance(raw_arr, (list, tuple)) and len(raw_arr) >= 3:
        try:
            arr = [max(1, min(10, int(x))) for x in raw_arr[:7]]
        except (ValueError, TypeError):
            arr = [6, 2, 8, 4, 9, 3, 5]
    else:
        arr = [6, 2, 8, 4, 9, 3, 5]

    n = len(arr)
    center = [0, -0.8, 0]

    bar_width = 0.65
    spacing = 0.95
    total_w = n * spacing
    start_x = center[0] - total_w / 2 + spacing / 2

    def build_bars(values, highlight_idx=-1, pivot_idx=-1):
        grp = VGroup()
        for i, val in enumerate(values):
            h = val * 0.28
            bx = start_x + i * spacing
            by = center[1] + h / 2

            if i == pivot_idx:
                c = getattr(theme, "gold", theme.accent_alt)
            elif i == highlight_idx:
                c = getattr(theme, "yellow", theme.accent)
            else:
                c = theme.card

            stroke_c = getattr(theme, "yellow", theme.accent) if (i == highlight_idx or i == pivot_idx) else getattr(theme, "border", "#56627a")

            bar = RoundedRectangle(
                corner_radius=0.1,
                width=bar_width,
                height=h,
                stroke_width=2.5,
                stroke_color=stroke_c,
                fill_color=c,
                fill_opacity=0.9,
            ).move_to([bx, by, 0])

            lbl = Text(str(val), font=theme.mono, weight="BOLD", color=theme.text).scale(0.40).next_to(bar, UP, buff=0.1)
            idx_lbl = Text(f"[{i}]", font=theme.mono, weight="BOLD", color=getattr(theme, "axis", theme.muted)).scale(0.28).next_to(bar, [0, -1, 0], buff=0.12)
            grp.add(VGroup(bar, lbl, idx_lbl))
        return grp

    bars_initial = build_bars(arr, pivot_idx=n - 1)

    # Step 2: Compare and highlight active elements
    bars_compare = build_bars(arr, highlight_idx=0, pivot_idx=n - 1)

    # Step 3: Sorted state
    sorted_arr = sorted(arr)
    bars_sorted = build_bars(sorted_arr)

    badge1 = info_badge(theme, f"Array Partition: Pivot = {arr[-1]}", pos=[0, 1.9, 0], font_size=0.34, color=theme.accent_alt)
    badge2 = info_badge(theme, "Compare Elements & Swap with Pivot", pos=[0, 1.9, 0], font_size=0.34, color=theme.accent)
    badge3 = info_badge(theme, "Sorted Invariant Established: O(N log N)", pos=[0, 1.9, 0], font_size=0.34, color=getattr(theme, "gold", theme.accent))

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Initial unsorted state with pivot selection
    run_stage(budget, frames[0], FadeIn(bars_initial), FadeIn(badge1))

    # Stage 2: Scanning & comparison stage
    run_stage(budget, frames[1], badge1.animate.become(badge2), bars_initial.animate.become(bars_compare))

    # Stage 3: Fully sorted partition
    run_stage(budget, frames[2], badge2.animate.become(badge3), bars_initial.animate.become(bars_sorted))

    budget.fill()
