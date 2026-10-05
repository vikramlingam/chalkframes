"""manim-sorting-visualizer: Divide-and-conquer sorting algorithm visualization."""

from manim import (
    FadeIn,
    RIGHT,
    RoundedRectangle,
    Text,
    UP,
    VGroup,
)

from ..common import clean, run_stage, stage_frames, title_text


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

    bar_width = 0.55
    spacing = 0.8
    total_w = n * spacing
    start_x = center[0] - total_w / 2 + spacing / 2

    def build_bars(values, highlight_idx=-1, pivot_idx=-1):
        grp = VGroup()
        for i, val in enumerate(values):
            h = val * 0.28
            bx = start_x + i * spacing
            by = center[1] + h / 2

            if i == pivot_idx:
                c = theme.accent_alt
            elif i == highlight_idx:
                c = theme.accent
            else:
                c = theme.card

            stroke_c = theme.accent if (i == highlight_idx or i == pivot_idx) else theme.border

            bar = RoundedRectangle(
                corner_radius=0.08,
                width=bar_width,
                height=h,
                stroke_width=2,
                stroke_color=stroke_c,
                fill_color=c,
                fill_opacity=0.9,
            ).move_to([bx, by, 0])

            lbl = Text(str(val), font=theme.mono, weight="BOLD", color=theme.text).scale(0.24).next_to(bar, UP, buff=0.08)
            idx_lbl = Text(f"[{i}]", font=theme.mono, color=theme.muted).scale(0.18).next_to(bar, [0, -1, 0], buff=0.1)
            grp.add(VGroup(bar, lbl, idx_lbl))
        return grp

    bars_initial = build_bars(arr, pivot_idx=n - 1)

    # Step 2: Compare and highlight active elements
    bars_compare = build_bars(arr, highlight_idx=0, pivot_idx=n - 1)

    # Step 3: Sorted state
    sorted_arr = sorted(arr)
    bars_sorted = build_bars(sorted_arr)

    badge_bg = RoundedRectangle(corner_radius=0.1, width=5.2, height=0.5, stroke_width=2, stroke_color=theme.border, fill_color=theme.card, fill_opacity=1).move_to([0, 1.9, 0])
    badge_txt1 = Text(f"Array Partition: Pivot = {arr[-1]}", font=theme.mono, weight="BOLD", color=theme.accent_alt).scale(0.25).move_to(badge_bg.get_center())
    badge_txt2 = Text("Compare Elements & Swap with Pivot", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.25).move_to(badge_bg.get_center())
    badge_txt3 = Text("Sorted Invariant Established: O(N log N)", font=theme.mono, weight="BOLD", color=theme.accent).scale(0.25).move_to(badge_bg.get_center())

    stages = 3
    frames = stage_frames(budget.total, [3, 4, 3], beat_frames if beat_frames and len(beat_frames) == stages else None)

    scene.add(title_text(theme, title))

    # Stage 1: Initial unsorted state with pivot selection
    run_stage(budget, frames[0], FadeIn(bars_initial), FadeIn(badge_bg), FadeIn(badge_txt1))

    # Stage 2: Scanning & comparison stage
    run_stage(budget, frames[1], badge_txt1.animate.become(badge_txt2), bars_initial.animate.become(bars_compare))

    # Stage 3: Fully sorted partition
    run_stage(budget, frames[2], badge_txt2.animate.become(badge_txt3), bars_initial.animate.become(bars_sorted))

    budget.fill()
