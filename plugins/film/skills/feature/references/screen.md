# Screen rules

Each rule exists because a draft broke it and a viewer said so.

## Picture and text

- **Picture first.** The mechanism is shown, on the running example. Text is a caption to the picture:
  at most 8 words a caption, one caption on screen at a time. Long text belongs in a document, not a film.
- **Never still.** Something new reaches the screen at least every 3 s: an object appears, a value changes,
  a step lights up. A camera drift alone is not new. `shoot.mjs --pace` lists every stretch that breaks
  this; only the closing invitation may hold, up to 6 s.
- **Detail is events, not holds.** A detailed film has more events, not longer screens: two to four small
  events per showcase station, each with its outcome, rather than one event and a long pause. Explain a
  long point as several short captions on several events.
- **Tempo.** At most two captions per showcase step; the picture carries the rest. A caption that retells
  what is already visible is cut. One caption on screen at a time.
- **No fact twice.** What an animation shows is not retold by a caption and not repeated by a diagram.
  A screen that only repeats what was shown is removed, even if the plan had it.
- **Terms once, in plain words.** The main term is introduced in chapter 1 through an everyday analogy.
  Internal project words ("engine", "node", "proxy") are replaced, or explained the first time they appear.
- **One screen, one idea**, in the viewer's language. No field names or file paths inside the story, except
  as a real object (a commit line, a form field) the viewer reads as a thing, not as jargon.
- **No blunt questions** to the viewer ("is this the problem?", "what would you do differently?").
- **Sources as quiet footnotes** in plain words, never as raw tags.
- **Copy passes `voice.md`** before review.

## Look

- **Palette and font, in this order.** (1) The design system of the company the film is made in, when it
  is in the project or the user gave it. (2) Else the project's own style: its UI tokens (CSS variables, the
  chart palette), its site, its docs. (3) Else ask which colours to use, the way Claude Motion asks.
  The font must cover the viewer's language: a brand font without Cyrillic, for example, gives way to the
  second brand font or a system one.
- **A warm accent is required.** A cold monochrome palette with no warm accent is a defect, brand colours
  included: the film looks lifeless. Keep a light, warm background and spend the warm colour on what the
  screen is about right now. The brand colours stay; their balance changes.
- **The hero is the running example.** Its objects travel through the whole film. A mascot appears only
  when the subject or the company already has one; it is drawn original, never borrowed, and footnoted as
  drawn for the film. The skill has no mascot of its own.
- **Varied layouts.** The same "header, boxes, caption" grid on every screen is a defect.

## Motion

- **Title first.** 3–4 s, once per film: "FEATURE BRIEFING · <product>", the feature's name, one line of
  what it does. Without it the viewer feels they joined in the middle.
- **Chapter 4 is one camera ride.** One scene: the camera travels a road between stations, a rail of steps
  sits at the top with the current one lit, a progress counter under it. The viewer sees one path of one
  request, not a stack of slides.
- **Accents move.** Proof numbers count up, a "passed" check flashes a ring, a rejected value shakes once,
  a stamp lands ("ROLLED BACK", "SAVED"). Nothing flashes more than three times a second.
- **Music** is composed with the film (Claude Motion's score API); a short sound marks each station's event.

## Honesty

- No answer in the source or from the author → it is an open question for chapter 7, not an empty screen.
- Nothing is invented without a footnote. An example is marked as an example. A number that was counted
  but not run says so ("tests counted in the test classes, not run for this film").
- Document and code disagree → show both with their sources: "the spec says X, the code does Y".
- A briefing, not an ad: neutral tone, no "only strengths" framing, no superlatives without a number from
  the source, no promises about the future — a goal from the spec is labelled "goal".
