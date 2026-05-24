# PPTX Deck Design Guidance

Use this reference when creating a new deck, redesigning a deck, or when the
first draft looks plain.

## Default Workflow

1. Write a tiny design brief before coding:
   - audience and stakes
   - tone: executive, technical, sales, educational, editorial
   - visual system: light/dark base, accent color, support color
2. Choose slide archetypes:
   - title hero: opens the deck or a major section
   - section divider: resets attention between chapters
   - two column: narrative plus proof, contrast, or steps
   - metric grid: 2-4 numbers, takeaways, or decisions
   - recap/action: final recommendation or next steps
3. Build from templates, then customize color and copy.
4. Run `build_deck.js --validate-only` before creating the final pptx.
5. Fix overflow by cutting words, splitting slides, or changing layout.

## Visual Rules

- Every slide needs one clear headline, not a generic label.
- Do not center every slide. Centering is fine for title slides only.
- Avoid empty white slides with black Arial text.
- Use whitespace deliberately: one large content area is better than many tiny boxes.
- Use panels and rules to organize content, but avoid heavy borders everywhere.
- Keep border radius subtle, usually 4-8pt.
- Avoid `border-radius: 999pt` pill shapes; they can become oversized rounded
  rectangles after HTML-to-PPTX conversion.
- Use shadows sparingly; prefer soft contrast from background colors.
- Use at most two accent colors in a deck.
- Keep letter spacing at 0 unless the brand requires otherwise.

## Multi-Page Decks

- For 6-12 slides, define chapters before writing HTML. A stable default rhythm:
  title hero, two column, metric grid, section divider, two column, metric grid,
  recap.
- Repeat the same visual system, not the same slide composition. Alternate
  light/dark emphasis, panel placement, and data density.
- Insert a section divider every 4-6 content slides when the topic shifts.
- Use `metric_grid` for evidence, principles, tradeoffs, or comparisons even
  when the content is not numeric. Short words or phrases work as the metric.
- Use `recap` only when the deck needs a decision, recommendation, or next step.
- For `metric_grid`, prefer `METRIC_*`, `METRIC_LABEL_*`, and `METRIC_TEXT_*`.
  `HEADER_*`, `TEXT_*`, `PANEL_*_TITLE`, and `PANEL_*_TEXT` are accepted
  aliases.
- For `recap`, prefer `TAKEAWAY_*`. `BULLET_*` is accepted as an alias.

## Lightweight Styling

- Prefer JSON-driven templates over custom CSS for every slide.
- Change the deck feel by editing CSS variables: `--bg`, `--ink`, `--muted`,
  `--accent`, `--support`, `--panel`, and `--line`.
- Keep shape vocabulary small: panels, rules, square accents, and one dark callout.
- Do not add decorative gradients, complex shadows, or large images unless they
  carry real content.
- If a user wants explicit theme exploration, use the sibling `theme-factory`
  skill when available. For Anthropic-branded deliverables, use
  `brand-guidelines`.

## Typography

- Title: 34-44pt, line-height around 1.05-1.12.
- Subtitle or lead: 17-22pt.
- Body: 14-18pt.
- Labels: 8-11pt, uppercase only for short labels.
- Use bold for hierarchy, not for whole paragraphs.

## Content Density

- One slide should contain one idea.
- Good slide limits:
  - title slide: title + subtitle + one short context line
  - narrative slide: 1 lead sentence + 3-5 bullets
  - metric slide: 2-4 metrics, each with one supporting phrase
- If a bullet wraps to 3 lines, shorten it or split the slide.

## HTML/PPTX Constraints

- `html` and `body` must be exactly 720pt x 405pt with no margin or padding.
- Put all page spacing inside `.safe`.
- Do not use CSS gradients; rasterize them to images first if needed.
- Do not use DIV background images; use `<img>` elements for images.
- Wrap all visible text in `h1`-`h6`, `p`, `ul`, `ol`, or `li`.
- Replace or delete every `{{PLACEHOLDER}}` before building.

## When The User Gives No Style

Use a restrained editorial system:

- background: `#f4f7f8`
- ink: `#172026`
- muted text: `#5f6b73`
- accent: `#d95d39`
- support: `#1f7a8c`

This looks professional without feeling like a default office template.
