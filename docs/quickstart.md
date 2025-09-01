# 5 Minutes to Time Travel

## Install

```bash
npm install @terminals/core
```

## Add to Your App

```javascript
import terminals from '@terminals/core'

// One line. That's it.
terminals.init()
```

## What You Get Instantly

### ✅ Automatic Replay Links

Any error generates a shareable replay:
```javascript
// Your existing code
throw new Error('Payment failed')

// Automatically becomes:
// 🔗 replay.terminals.tech/pmt_err_42
```

### ✅ Built-in Undo/Redo

```javascript
// Your React component
import { useTerminals } from '@terminals/core/react'

function TodoApp() {
  const { state, dispatch, undo, redo } = useTerminals()
  
  return (
    <>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
    </>
  )
}
```

### ✅ Time Travel Debugging

```javascript
// In browser console
terminals.rewind(30) // Go back 30 events
terminals.replay()   // Watch everything happen
terminals.export()   // Download full history
```

## Your First Replay

1. **Add an error boundary**:
```javascript
window.addEventListener('error', (e) => {
  const replayUrl = terminals.generateReplay()
  console.log(`Debug this error: ${replayUrl}`)
})
```

2. **Trigger any error**
3. **Click the replay link**
4. **Watch your bug happen in slow motion**

## Framework Examples

### React
```javascript
import { TerminalsProvider } from '@terminals/core/react'

function App() {
  return (
    <TerminalsProvider>
      {/* Your app - now with superpowers */}
    </TerminalsProvider>
  )
}
```

### Vue
```javascript
import { terminalsPlugin } from '@terminals/core/vue'

app.use(terminalsPlugin)
```

### Vanilla JS
```javascript
const store = terminals.createStore({
  initialState: { count: 0 },
  reducer: (state, event) => {
    // Your state logic
  }
})
```

## Production Ready

```javascript
terminals.init({
  apiKey: process.env.TERMINALS_KEY,
  environment: 'production',
  redact: ['password', 'ssn', 'creditCard'],
  maxEvents: 10000,
  uploadOn: ['error', 'userReport']
})
```

## FAQ

**Q: How much does it cost?**
Free for 1,000 replays/month. Unlimited local usage.

**Q: Is my data safe?**
Events stay local by default. You control what gets uploaded.

**Q: Performance impact?**
<1ms per event. 100KB memory for 1,000 events.

**Q: Works with Redux/MobX/Zustand?**
Yes! We complement, not replace.

## Get Help

- 🎮 [Interactive Playground](https://play.terminals.tech)
- 💬 [Discord Community](https://discord.gg/terminals)
- 📺 [Video Tutorials](https://youtube.com/@terminals)
- 🐛 [Report Issues](https://github.com/terminals/core)

---

**Ready for production?** Check out [Teams](https://terminals.tech/pricing) for unlimited replays and collaboration.