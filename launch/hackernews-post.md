# Show HN: I made state management work like Git

After years of "works on my machine" and unreproducible bugs, I built something different: every state change in your app becomes an event, creating a perfect audit trail you can rewind, replay, and share.

When your app crashes in production, you get a replay link showing exactly what happened - every click, every state change, in order. It's like Loom for debugging.

**Demo**: https://replay.terminals.tech/hn-demo-bug (watch me debug a race condition by rewinding time)

**The core idea is simple:**
- State changes are events (immutable facts)
- Current state is computed from events (deterministic)
- You can navigate to any point in history (time travel)

**What makes this different:**
- 100 lines of core code (seriously, check the source)
- Works with any framework (React, Vue, vanilla)
- Replay links for every error (automatic)
- No performance overhead (<1ms per event)

**The "aha" moment**: A user reported a bug I couldn't reproduce. They sent me a replay link. I watched their exact session, saw the race condition happen, and fixed it in minutes instead of hours.

**Technical details:**
- Event sourcing pattern with ring buffer for memory bounds
- Checkpointing for O(log n) replay performance
- Optional compression for localStorage/network
- MIT licensed core, hosted replay infrastructure

I'm calling it Terminals because each replay is like a terminal session for your app's state.

**Try it**: 
```
npm install @terminals/core
terminals.init() // That's it
```

Code: https://github.com/terminals/core
Docs: https://terminals.tech

Would love feedback on:
1. The replay viewer UX (is it intuitive?)
2. Pricing model (free tier is 1000 replays/month)
3. What other debugging features you'd want

This started as a side project to debug my own app, but I think it could change how we all debug web apps. What do you think?