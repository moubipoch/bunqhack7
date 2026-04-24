Okay this is sharp. The fraud/duress angle is genuinely novel and has real commercial value to Bunq — let me help you pressure-test and expand it fast.

---

## The Core Idea, Sharpened

**Name candidate:** "Verify" / "SafeVoice" / "Pulse" — something that implies liveness + emotional check

**The pitch in one sentence:**
*When a high-value transaction fires, we intercept it, ask you to read a short sentence, and use voice emotion analysis to silently detect duress — blocking the transaction if you're being coerced, and acting as a financial advisor if you're just unsure.*

This is two products in one demo, which is actually good for a hackathon — you have a safety story AND a UX story.

---

## The Two Modes

**Mode 1 — Silent Fraud / Duress Detection**
Transaction over €500 triggers → Bunq webhook → app opens dialogue → user reads a sentence → Hume analyzes prosody in real time → if distress/fear signals exceed threshold → transaction is flagged/blocked → silent alert sent (to Bunq, to a trusted contact)

The key insight that makes this real: the sentence the user reads is **neutral on purpose**. Something like "I confirm this payment to [merchant] for [amount]." You're not asking them how they feel. You're giving a coerced person plausible deniability — they read the sentence, the AI detects the fear they couldn't express, the transaction gets flagged without tipping off whoever is watching them.

**Mode 2 — Financial Advisor**
Same dialogue, but for non-distress cases. While they're reading or after, Claude has already pulled their Bunq data — balance, recent spending in category, upcoming bills. If Hume says they're calm but hesitant, or excited/impulsive, the assistant speaks up with context before they confirm.

---

## The Architecture

```
Bunq webhook → transaction ≥ €500 fired
        │
        ▼
App intercepts (push notification or foreground modal)
        │
        ▼
User reads neutral sentence out loud (5 seconds)
        │
   ┌────┴────┐
   │         │
Hume EVI   Bunq API
(prosody)  (balance, history,
           upcoming debits)
   │         │
   └────┬────┘
        │
      Claude
   (decision engine)
        │
   ┌────┴──────────┐
   │               │
DISTRESS        NORMAL
flag/block     → financial
silent alert     advisor
                 response
                 via EVI voice
```

---

## The Sentence Design — This Is Important

The sentence needs to be:
- Long enough for Hume to get a good prosody read (~5 seconds of speech)
- Neutral in content so it doesn't prime emotion
- Contains the actual transaction details so it feels like a natural confirmation

Suggested template:
*"I'm authorizing a payment of [amount] euros to [merchant] on [date]."*

Why this works: a scared person reading this will show vocal tremor, elevated pitch, compressed rhythm, flattened affect — exactly what Hume's prosody model captures. A normal person reads it flatly or with mild curiosity. The delta is detectable.

You can also add a **liveness check** — randomize one word in the sentence so they can't pre-record it. "I'm authorizing a payment of [amount] euros to [merchant] — please also say today's color: blue." Simple, prevents replay attacks.

---

## What Hume Returns (Concretely)

Hume's prosody model returns continuous scores across ~48 emotional dimensions. The ones you care about:

- `Fear` — direct coercion signal
- `Distress` — general duress
- `Nervousness` / `Anxiety` — softer signal, combine with others
- `Calmness` — your baseline green light
- `Excitement` — impulse buy signal for Mode 2

Your decision logic is simple:

```python
def assess_transaction(prosody_scores, financial_context):
    fear = prosody_scores['fear']
    distress = prosody_scores['distress']
    calmness = prosody_scores['calmness']
    
    # Hard block
    if fear > 0.6 or distress > 0.7:
        return "BLOCK", "silent_alert"
    
    # Soft flag — ask again differently
    if fear > 0.3 and calmness < 0.4:
        return "HOLD", "check_in"
    
    # Financial advisor mode
    if calmness > 0.6:
        return "APPROVE", financial_advice(financial_context)
```

---

## What Makes This Winnable

**It's real.** Banks spend billions on fraud. Coerced transaction fraud ("grandparent scams", robbery, intimate partner financial abuse) has no technical solution today. This is a genuine gap.

**Bunq specifically** is a neobank that markets itself on smart features and user trust. This fits their brand perfectly — they'd actually ship this.

**The demo is visceral.** You show a €600 transaction firing, the dialogue appearing, someone reading the sentence in a scared voice, the transaction getting blocked silently. Judges will feel it.

**The dual mode is clever.** One tech stack, two use cases — safety for the edge case, financial advisor for the everyday case. You're not a niche fraud tool, you're a transaction companion.

---

## What to Build in the Next Few Hours

Prioritize in this order:

1. **Bunq sandbox webhook** → triggers on transaction amount threshold. Get this working first, everything else depends on it.
2. **Hume EVI WebSocket** → open connection, stream mic audio, get prosody scores back. Their quickstart is ~30 lines of JS.
3. **Decision logic** → the three-branch classifier above. Keep it simple.
4. **Claude + Bunq data** → parallel call while Hume is processing. Pull balance and recent transactions, generate advisor text.
5. **UI** → modal that appears on transaction trigger, shows the sentence to read, plays the voice response. Can be a single HTML page.

Don't over-engineer the UI. The logic is the demo, not the design.

---

## The One Risk to Address for Judges

They'll ask: *"What if Hume gives a false positive and blocks a legitimate transaction?"*

Your answer: **it never hard-blocks unilaterally.** It flags and holds for 60 seconds while sending a secondary verification — a push notification to a trusted contact, or a second channel confirmation. The user always has an override path. You're adding friction to fraud, not removing agency from users.

Go build it. This is a real product.